import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE not set. Please configure your .env');
}
const supabase = createClient(supabaseUrl || '', supabaseKey || '');
const supabaseAnon = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Express setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
}));

// Make session available to EJS views
app.use((req, res, next) => { res.locals.session = req.session || {}; next(); });

// Upload media to Supabase Storage (bucket 'media')
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const ext = path.extname(req.file.originalname) || '';
    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const { error } = await supabase.storage.from('media').upload(key, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) return res.status(500).json({ error: error.message });
    const { data } = supabase.storage.from('media').getPublicUrl(key);
    res.json({ url: data.publicUrl, path: key });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Seed admin user from env on startup (one-time idempotent)
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const { data: existing } = await supabase.from('users').select('id,email').eq('email', email).maybeSingle();
  if (existing) return;
  const password_hash = await bcrypt.hash(password, 10);
  await supabase.from('users').insert({ email, password_hash, role: 'admin' });
  console.log('Admin seeded:', email);
}
seedAdmin().catch(()=>{});

// Auth helpers
function requireUser(req, res, next){
  if (req.session?.user && req.session.user.role === 'user') return next();
  return res.redirect('/login');
}
function requireAdmin(req, res, next){
  if (req.session?.user && req.session.user.role === 'admin') return next();
  return res.redirect('/admin/login');
}

// Helpers
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || '';
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ADMIN = process.env.EMAILJS_TEMPLATE_ADMIN || '';
const EMAILJS_TEMPLATE_CLIENT_RECAP = process.env.EMAILJS_TEMPLATE_CLIENT_RECAP || '';
const EMAILJS_TEMPLATE_CLIENT_PAYMENT = process.env.EMAILJS_TEMPLATE_CLIENT_PAYMENT || '';
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_EMAIL || '';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

async function sendEmail({ service_id, template_id, user_id, template_params }) {
  if (!service_id || !template_id || !user_id) throw new Error('EmailJS configuration missing');
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_id, template_id, user_id, template_params })
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>'');
    throw new Error('EmailJS send failed: ' + txt);
  }
  return true;
}
const isDateRangeAvailable = async (propertyId, startDate, endDate) => {
  const s = new Date(startDate).getTime();
  const e = new Date(endDate).getTime();
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id,startDate,endDate,status')
    .eq('propertyId', propertyId)
    .in('status', ['pending', 'confirmed']);
  if (error) return false;
  return !(bookings || []).some(b => {
    const bs = new Date(b.startDate).getTime();
    const be = new Date(b.endDate).getTime();
    return !(be <= s || bs >= e);
  });
};

// Routes - Views
app.get('/', async (req, res) => {
  const { data: properties, error } = await supabase.from('properties').select('*').order('createdAt', { ascending: false });
  res.render('index', { properties: properties || [], title: 'Logements disponibles' });
});

app.get('/admin', requireAdmin, async (req, res) => {
  const [{ data: properties }, { data: bookings }] = await Promise.all([
    supabase.from('properties').select('*').order('createdAt', { ascending: false }),
    supabase.from('bookings').select('*').order('createdAt', { ascending: false })
  ]);
  res.render('admin', { properties: properties || [], bookings: bookings || [], title: 'Espace Admin' });
});

// Auth routes - USER
app.get('/login', (req, res) => {
  res.render('login', { title: 'Connexion' });
});
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).render('login', { title: 'Connexion', error: 'Email et mot de passe requis' });
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return res.status(401).render('login', { title: 'Connexion', error: 'Identifiants invalides ou email non confirmé' });
  // ensure app-level user row exists
  await supabase.from('users').upsert({ email, role: 'user', email_verified: true }, { onConflict: 'email' });
  req.session.user = { email, role: 'user' };
  res.redirect('/');
});
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Signup (USER)
app.get('/signup', (req, res) => {
  res.render('signup', { title: 'Créer un compte' });
});
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).render('signup', { title: 'Créer un compte', error: 'Email et mot de passe requis' });
    const { data, error } = await supabaseAnon.auth.signUp({
      email, password,
      options: { emailRedirectTo: APP_BASE_URL }
    });
    if (error) return res.status(400).render('signup', { title: 'Créer un compte', error: error.message });
    // show info message
    res.status(200).render('signup', { title: 'Créer un compte', info: 'Un email de confirmation vous a été envoyé par Supabase. Merci de cliquer sur le lien pour activer votre compte.' });
  } catch (e) {
    res.status(500).render('signup', { title: 'Créer un compte', error: 'Erreur serveur' });
  }
});

// Optional confirm landing page (Supabase handles verification)
app.get('/confirm', (req, res) => {
  res.render('confirm-result', { title: 'Confirmation', success: 'Votre adresse e-mail est confirmée. Vous pouvez maintenant vous connecter.' });
});

// Auth routes - ADMIN
app.get('/admin/login', (req, res) => {
  res.render('admin-login', { title: 'Admin - Connexion' });
});
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).render('admin-login', { title: 'Admin - Connexion', error: 'Email et mot de passe requis' });
  const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
  if (error || !user || user.role !== 'admin') return res.status(401).render('admin-login', { title: 'Admin - Connexion', error: 'Identifiants invalides' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).render('admin-login', { title: 'Admin - Connexion', error: 'Identifiants invalides' });
  req.session.user = { email: user.email, role: 'admin' };
  res.redirect('/admin');
});
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// User: Mes réservations
app.get('/mes-reservations', async (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'user') return res.redirect('/login');
  const email = req.session.user.email;
  const { data: bookings } = await supabase.from('bookings').select('*').eq('guestEmail', email).order('createdAt', { ascending: false });
  res.render('my-bookings', { title: 'Mes réservations', bookings: bookings || [] });
});

// API - Properties
app.get('/api/properties', async (req, res) => {
  const { data, error } = await supabase.from('properties').select('*').order('createdAt', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Notifications - backend EmailJS
app.post('/api/notify/booking', async (req, res) => {
  try {
    const booking = req.body;
    if (!booking || !booking.id) return res.status(400).json({ error: 'Invalid booking payload' });
    // Admin email
    if (ADMIN_NOTIFY_EMAIL && EMAILJS_TEMPLATE_ADMIN) {
      await sendEmail({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ADMIN,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          admin_email: ADMIN_NOTIFY_EMAIL,
          booking_id: booking.id,
          property_id: booking.propertyId,
          start_date: booking.startDate,
          end_date: booking.endDate,
          guest_name: booking.guestName,
          guest_email: booking.guestEmail,
          total: booking.total
        }
      });
    }
    // Client recap
    if (booking.guestEmail && EMAILJS_TEMPLATE_CLIENT_RECAP) {
      await sendEmail({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_CLIENT_RECAP,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: booking.guestEmail,
          guest_name: booking.guestName,
          booking_id: booking.id,
          property_id: booking.propertyId,
          start_date: booking.startDate,
          end_date: booking.endDate,
          total: booking.total,
          payment_instructions: 'Vous recevrez un lien de paiement Revolut sous 24h pour confirmer votre réservation.'
        }
      });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/notify/payment-link', async (req, res) => {
  try {
    const { booking, link } = req.body;
    if (!booking || !booking.id || !link) return res.status(400).json({ error: 'Invalid payload' });
    await sendEmail({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_CLIENT_PAYMENT,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: booking.guestEmail,
        guest_name: booking.guestName,
        booking_id: booking.id,
        total: booking.total,
        start_date: booking.startDate,
        end_date: booking.endDate,
        revolut_link: link
      }
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/properties', async (req, res) => {
  const { title, description, address, pricePerNight, imageUrl, videoUrl, capacity } = req.body;
  if (!title || !pricePerNight) return res.status(400).json({ error: 'title and pricePerNight are required' });
  const property = { title, description: description || '', address: address || '', pricePerNight: Number(pricePerNight) || 0, imageUrl: imageUrl || '', videoUrl: videoUrl || '', capacity: Number(capacity) || 1, createdAt: new Date().toISOString() };
  const { data, error } = await supabase.from('properties').insert(property).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.put('/api/properties/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, address, pricePerNight, imageUrl, videoUrl, capacity } = req.body;
  const updates = { title, description, address, pricePerNight: Number(pricePerNight), imageUrl, videoUrl, capacity: Number(capacity) };
  const { data, error } = await supabase.from('properties').update(updates).eq('id', id).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/properties/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('properties').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Property media (gallery)
app.get('/api/properties/:id/media', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('property_media').select('*').eq('propertyId', id).order('createdAt', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/properties/:id/media', async (req, res) => {
  const { id } = req.params;
  const { url, type } = req.body; // type: 'image' | 'video'
  if (!url || !type) return res.status(400).json({ error: 'url and type are required' });
  const { data, error } = await supabase.from('property_media').insert({ propertyId: id, url, type }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.delete('/api/properties/:id/media/:mediaId', async (req, res) => {
  const { id, mediaId } = req.params;
  const { error } = await supabase.from('property_media').delete().eq('id', mediaId).eq('propertyId', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Availability / blocked ranges
// GET combined blocked ranges: bookings (pending/confirmed) + admin unavailable ranges
app.get('/api/properties/:id/blocked', async (req, res) => {
  const { id } = req.params;
  try {
    const [{ data: bookings }, { data: unav }] = await Promise.all([
      supabase.from('bookings').select('startDate,endDate,status').eq('propertyId', id).in('status', ['pending','confirmed']),
      supabase.from('availability').select('id,startDate,endDate').eq('propertyId', id)
    ]);
    const ranges = [];
    (bookings || []).forEach(b => ranges.push({ startDate: b.startDate, endDate: b.endDate, source: 'booking' }));
    (unav || []).forEach(r => ranges.push({ id: r.id, startDate: r.startDate, endDate: r.endDate, source: 'unavailable' }));
    res.json(ranges);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load blocked ranges' });
  }
});

// POST add an unavailable range (admin)
app.post('/api/properties/:id/availability', async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.body;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });
  const { data, error } = await supabase.from('availability').insert({ propertyId: id, startDate, endDate }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE an unavailable range
app.delete('/api/properties/:id/availability/:rangeId', async (req, res) => {
  const { id, rangeId } = req.params;
  const { error } = await supabase.from('availability').delete().eq('id', rangeId).eq('propertyId', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// API - Bookings
app.get('/api/bookings', async (req, res) => {
  const { data, error } = await supabase.from('bookings').select('*').order('createdAt', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/bookings', async (req, res) => {
  const { propertyId, startDate, endDate, guestName, guestEmail, guests } = req.body;
  if (!propertyId || !startDate || !endDate || !guestName || !guestEmail) {
    return res.status(400).json({ error: 'propertyId, startDate, endDate, guestName, guestEmail are required' });
  }
  // fetch property to compute total
  const { data: prop, error: propErr } = await supabase.from('properties').select('*').eq('id', propertyId).single();
  if (propErr || !prop) return res.status(404).json({ error: 'Property not found' });
  const available = await isDateRangeAvailable(propertyId, startDate, endDate);
  if (!available) return res.status(409).json({ error: 'Dates not available' });
  const nights = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)));
  const total = nights * (prop.pricePerNight || 0);
  const booking = { propertyId, startDate, endDate, guestName, guestEmail, guests: Number(guests) || 1, status: 'pending', total, createdAt: new Date().toISOString(), paymentLink: '' };
  const { data, error } = await supabase.from('bookings').insert(booking).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.patch('/api/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'pending' | 'confirmed' | 'cancelled'
  if (!['pending', 'confirmed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const { data, error } = await supabase.from('bookings').update({ status, updatedAt: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) return res.status(404).json({ error: 'Booking not found' });
  res.json(data);
});

app.post('/api/bookings/:id/payment-link', async (req, res) => {
  const { id } = req.params;
  const { paymentLink } = req.body;
  const { data, error } = await supabase.from('bookings').update({ paymentLink: paymentLink || '', updatedAt: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) return res.status(404).json({ error: 'Booking not found' });
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
