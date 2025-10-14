// Tabs behavior
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  panels.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById(`tab-${t.dataset.tab}`).classList.add('active');
}));

function q(id){ return document.getElementById(id); }

function saveEmailJSConfig(){
  const pub = q('emailjs_public_key').value.trim();
  const service = q('emailjs_service_id').value.trim();
  const tplAdmin = q('emailjs_template_admin').value.trim();
  const tplClientRecap = q('emailjs_template_client_recap')?.value.trim() || '';
  const tplClient = q('emailjs_template_client').value.trim();
  const adminEmail = q('admin_email').value.trim();
  localStorage.setItem('emailjs_public_key', pub);
  localStorage.setItem('emailjs_service_id', service);
  localStorage.setItem('emailjs_template_admin', tplAdmin);
  localStorage.setItem('emailjs_template_client_recap', tplClientRecap);
  localStorage.setItem('emailjs_template_client', tplClient);
  localStorage.setItem('admin_email', adminEmail);
  alert('Configuration enregistrée.');
  // refresh emailjs init
  if (window.emailjs && pub){ emailjs.init(pub); }
}

async function fetchBookings(){
  const res = await fetch('/api/bookings');
  return res.json();
}
async function fetchProperties(){
  const res = await fetch('/api/properties');
  return res.json();
}

async function renderBookings(){
  const bookings = await fetchBookings();
  const el = q('bookings-list');
  el.innerHTML = '';
  bookings.slice().reverse().forEach(b => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div><strong>Réservation #${b.id}</strong></div>
      <div>Propriété: ${b.propertyId}</div>
      <div>Période: ${b.startDate} ➜ ${b.endDate}</div>
      <div>Client: ${b.guestName} (${b.guestEmail})</div>
      <div>Total: ${b.total} €</div>
      <div>Statut: <span class="badge ${b.status}">${b.status}</span></div>
      <div class="row">
        <button class="btn" data-action="confirm">Marquer confirmé</button>
        <button class="btn" data-action="pending">Marquer en attente</button>
        <button class="btn" data-action="cancel">Annuler</button>
      </div>
      <div class="row">
        <input class="input" placeholder="Coller le lien Revolut" value="${b.paymentLink || ''}" />
        <button class="btn" data-action="save-link">Enregistrer lien</button>
        <button class="btn" data-action="send">Envoyer le lien de paiement</button>
      </div>
    `;
    div.querySelector('[data-action="confirm"]').onclick = ()=> updateBookingStatus(b.id, 'confirmed');
    div.querySelector('[data-action="pending"]').onclick = ()=> updateBookingStatus(b.id, 'pending');
    div.querySelector('[data-action="cancel"]').onclick = ()=> updateBookingStatus(b.id, 'cancelled');
    const input = div.querySelector('input');
    div.querySelector('[data-action="save-link"]').onclick = async ()=>{
      await fetch(`/api/bookings/${b.id}/payment-link`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ paymentLink: input.value }) });
      alert('Lien enregistré.');
    };
    div.querySelector('[data-action="send"]').onclick = ()=> sendRevolutLinkToClient(b, input.value);
    el.appendChild(div);
  });
}

async function updateBookingStatus(id, status){
  await fetch(`/api/bookings/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  renderBookings();
  renderPayments();
}

async function renderPayments(){
  const bookings = await fetchBookings().catch(()=>[]);
  const el = q('payments-list');
  el.innerHTML = '';
  if (!Array.isArray(bookings)) {
    console.warn('Failed to load bookings for payments:', bookings);
    el.innerHTML = '<div class="empty">Impossible de charger les paiements (voir console). Réessayez plus tard.</div>';
    return;
  }
  bookings.filter(b => b.status === 'pending').slice().reverse().forEach(b => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div><strong>Réservation #${b.id}</strong> — ${b.guestName} (${b.guestEmail})</div>
      <div>Période: ${b.startDate} ➜ ${b.endDate} | Total: <strong>${b.total} €</strong> | Statut: <span class="badge ${b.status}">${b.status}</span></div>
      <div class="row">
        <input class="input" placeholder="Coller le lien Revolut" value="${b.paymentLink || ''}" />
        <button class="btn" data-action="save-link">Enregistrer lien</button>
        <button class="btn" data-action="send">Envoyer le lien de paiement</button>
      </div>
    `;
    const input = div.querySelector('input');
    div.querySelector('[data-action="save-link"]').onclick = async ()=>{
      await fetch(`/api/bookings/${b.id}/payment-link`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ paymentLink: input.value }) });
      alert('Lien enregistré.');
    };
    div.querySelector('[data-action="send"]').onclick = ()=> sendRevolutLinkToClient(b, input.value);
    el.appendChild(div);
  });
}

function sendRevolutLinkToClient(booking, link){
  if (!link) { alert('Veuillez saisir le lien Revolut'); return; }
  fetch('/api/notify/payment-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking, link })
  }).then(async (r)=>{
    if (!r.ok) throw new Error('Erreur envoi email');
    await fetch(`/api/bookings/${booking.id}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'confirmed' }) });
    alert('Lien envoyé au client. Statut confirmé.');
    renderBookings();
    renderPayments();
  }).catch(()=> alert('Erreur envoi email'));
}

async function addProperty(e){
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const res = await fetch('/api/properties', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
  let created = null;
  if (!res.ok){
    let msg = 'Erreur ajout logement';
    try { const j = await res.json(); if (j && j.error) msg += `: ${j.error}`; } catch {}
    alert(msg);
    return false;
  }
  try { created = await res.json(); } catch {}
  // If admin provided an availability range at creation, push it now
  const avStart = (form.querySelector('[name="avStart"]')?.value||'').trim();
  const avEnd = (form.querySelector('[name="avEnd"]')?.value||'').trim();
  if (created && created.id && avStart && avEnd) {
    await fetch(`/api/properties/${created.id}/availability`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ startDate: avStart, endDate: avEnd }) });
  }
  form.reset();
  alert('Logement ajouté.');
  // optional refresh
  renderProperties();
  return false;
}

// Initialize add-property inline calendar and inputs
document.addEventListener('DOMContentLoaded', () => {
  const start = document.querySelector('#add-property-form [name="avStart"]');
  const end = document.querySelector('#add-property-form [name="avEnd"]');
  const cal = document.getElementById('add-availability-calendar');
  if (window.AirDatepicker && cal) {
    new AirDatepicker(cal, {
      inline: true,
      range: true,
      locale: AirDatepicker.locales.fr,
      onSelect({date, formattedDate}){
        if (Array.isArray(formattedDate)){
          start.value = formattedDate[0] || '';
          end.value = formattedDate[1] || '';
        }
      },
      dateFormat: 'yyyy-MM-dd'
    });
  }
});

async function renderProperties(){
  const res = await fetch('/api/properties');
  const props = await res.json();
  const el = q('properties-list');
  el.innerHTML = '';
  props.slice().reverse().forEach(p => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div><strong>${p.title}</strong> — ${p.pricePerNight} € / nuit — Capacité: ${p.capacity || 1}</div>
      <div class="row">
        <input class="input" data-k="title" value="${p.title}" />
        <input class="input" data-k="pricePerNight" type="number" min="0" value="${p.pricePerNight}" />
        <input class="input" data-k="capacity" type="number" min="1" value="${p.capacity || 1}" />
      </div>
      <div class="row">
        <input class="input" data-k="address" value="${p.address || ''}" />
        <input class="input" data-k="imageUrl" value="${p.imageUrl || ''}" placeholder="Image URL" />
      </div>
      <div class="row">
        <input class="input" data-k="videoUrl" value="${p.videoUrl || ''}" placeholder="Vidéo URL (optionnel)" />
      </div>
      <textarea class="input" data-k="description">${p.description || ''}</textarea>
      <div class="row">
        <input type="file" accept="image/*" data-upload="image" />
        <button class="btn" data-action="upload-image"><i class="ti ti-upload"></i> Uploader image</button>
        <input type="file" accept="video/*" data-upload="video" />
        <button class="btn" data-action="upload-video"><i class="ti ti-upload"></i> Uploader vidéo</button>
      </div>
      <div class="row">
        <button class="btn" data-action="update">Enregistrer</button>
        <button class="btn" data-action="delete" style="background:linear-gradient(90deg,#ef4444,#f97316)">Supprimer</button>
      </div>
      <hr style="opacity:.15;margin:12px 0" />
      <div>
        <div class="muted small" style="margin-bottom:6px"><i class="ti ti-calendar"></i> Disponibilités (plages indisponibles définies par l'admin + réservations en cours)</div>
        <div class="row">
          <input class="input" placeholder="Début" data-av-start />
          <input class="input" placeholder="Fin" data-av-end />
          <button class="btn" data-action="add-unavailable"><i class="ti ti-calendar-plus"></i> Bloquer la période</button>
        </div>
        <div class="small muted">Périodes indisponibles (admin):</div>
        <div data-av-list class="small"></div>
      </div>
      <hr style="opacity:.15;margin:12px 0" />
      <div>
        <div class="muted small" style="margin-bottom:6px"><i class="ti ti-photo"></i> Galerie média</div>
        <div class="row">
          <button class="btn" data-action="add-media-image"><i class="ti ti-plus"></i> Ajouter l'image ci-dessus</button>
          <button class="btn" data-action="add-media-video"><i class="ti ti-plus"></i> Ajouter la vidéo ci-dessus</button>
        </div>
        <div data-media-list class="small"></div>
      </div>
    `;
    const getPayload = () => {
      const o = {};
      div.querySelectorAll('[data-k]').forEach(inp => {
        o[inp.dataset.k] = inp.tagName === 'TEXTAREA' ? inp.value : inp.value;
      });
      return o;
    };
    div.querySelector('[data-action="update"]').onclick = async () => {
      const payload = getPayload();
      const res = await fetch(`/api/properties/${p.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (!res.ok) { alert('Erreur mise à jour'); return; }
      alert('Logement mis à jour');
    };
    div.querySelector('[data-action="delete"]').onclick = async () => {
      if (!confirm('Supprimer ce logement ?')) return;
      const res = await fetch(`/api/properties/${p.id}`, { method:'DELETE' });
      if (!res.ok) { alert('Erreur suppression'); return; }
      div.remove();
    };
    el.appendChild(div);

    // Upload handlers
    div.querySelector('[data-action="upload-image"]').onclick = async () => {
      const fileInput = div.querySelector('[data-upload="image"]');
      const url = await uploadMediaFile(fileInput);
      if (url) { div.querySelector('[data-k="imageUrl"]').value = url; alert('Image uploadée.'); }
    };
    div.querySelector('[data-action="upload-video"]').onclick = async () => {
      const fileInput = div.querySelector('[data-upload="video"]');
      const url = await uploadMediaFile(fileInput);
      if (url) { div.querySelector('[data-k="videoUrl"]').value = url; alert('Vidéo uploadée.'); }
    };

    // Availability: load list and setup add
    const avList = div.querySelector('[data-av-list]');
    const startInput = div.querySelector('[data-av-start]');
    const endInput = div.querySelector('[data-av-end]');
    let dpStart = null, dpEnd = null;
    if (window.AirDatepicker) {
      dpStart = new AirDatepicker(startInput, { autoClose: true, dateFormat: 'yyyy-MM-dd', locale: AirDatepicker.locales.fr });
      dpEnd = new AirDatepicker(endInput, { autoClose: true, dateFormat: 'yyyy-MM-dd', locale: AirDatepicker.locales.fr });
    }
    let cachedRanges = [];
    async function refreshBlocked(){
      const r = await fetch(`/api/properties/${p.id}/blocked`);
      const ranges = await r.json();
      cachedRanges = ranges || [];
      const adminRanges = cachedRanges.filter(x=>x.source==='unavailable');
      avList.innerHTML = '';
      if (!adminRanges.length){ avList.innerHTML = '<div class="empty">Aucune plage indisponible</div>'; return; }
      adminRanges.forEach(rg => {
        const row = document.createElement('div');
        row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px'; row.style.margin='6px 0';
        row.innerHTML = `<code>${rg.startDate} → ${rg.endDate}</code> <button class="btn" data-range="${rg.id}"><i class="ti ti-calendar-x"></i> Retirer</button>`;
        row.querySelector('button').onclick = async ()=>{
          const res = await fetch(`/api/properties/${p.id}/availability/${rg.id}`, { method:'DELETE' });
          if (!res.ok){ alert('Suppression échouée'); return; }
          refreshBlocked();
    // Inline availability calendar visualization
    const avInline = document.createElement('div');
    avInline.className = 'inline-calendar';
    div.appendChild(avInline);
    function renderInlineCalendar(ranges){
      if (!window.AirDatepicker) return;
      new AirDatepicker(avInline, {
        inline: true,
        range: false,
        locale: AirDatepicker.locales.fr,
        onRenderCell: ({date}) => {
          const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
          const blocked = (ranges||[]).some(r => {
            const bs = new Date(r.startDate).setHours(0,0,0,0);
            const be = new Date(r.endDate).setHours(0,0,0,0);
            return t >= bs && t <= be;
          });
          return blocked ? { disabled: true, classes: 'blocked-day' } : {};
        }
      });
    }
    (async ()=>{
      const r = await fetch(`/api/properties/${p.id}/blocked`);
      const ranges = await r.json();
      renderInlineCalendar(ranges||[]);
    })();
        };
        avList.appendChild(row);
      });
    }
    refreshBlocked();
    div.querySelector('[data-action="add-unavailable"]').onclick = async ()=>{
      const start = (startInput.value||'').trim();
      const end = (endInput.value||'').trim();
      if (!start || !end){ alert('Sélectionnez une période'); return; }
      if (new Date(start) > new Date(end)) { alert('La date de début doit être avant la date de fin'); return; }
      // Traiter le chevauchement côté UX
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      const overlap = (cachedRanges||[]).some(r => {
        const rs = new Date(r.startDate).getTime();
        const re = new Date(r.endDate).getTime();
        return !(e < rs || s > re);
      });
      if (overlap) { alert('Chevauchement détecté avec des périodes existantes'); return; }
      const res = await fetch(`/api/properties/${p.id}/availability`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ startDate:start, endDate:end }) });
      if (!res.ok){ alert('Ajout échoué'); return; }
      startInput.value=''; endInput.value='';
      refreshBlocked();
    };

    // Media gallery
    const mediaList = div.querySelector('[data-media-list]');
    async function refreshMedia(){
      const r = await fetch(`/api/properties/${p.id}/media`);
      const items = await r.json();
      mediaList.innerHTML = '';
      if (!items.length){ mediaList.innerHTML = '<div class="empty">Aucun média</div>'; return; }
      items.forEach(m => {
        const row = document.createElement('div');
        row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px'; row.style.margin='6px 0';
        row.dataset.id = m.id;
        const thumb = m.type === 'image' ? `<img src="${m.url}" alt="" style="width:60px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #253048"/>` : `<span class="badge">vidéo</span>`;
        row.innerHTML = `${thumb} <a href="${m.url}" target="_blank" rel="noopener">${m.url}</a> <button class="btn" data-id="${m.id}"><i class="ti ti-trash"></i> Supprimer</button>`;
        row.querySelector('button').onclick = async ()=>{
          const res = await fetch(`/api/properties/${p.id}/media/${m.id}`, { method:'DELETE' });
          if (!res.ok){ alert('Suppression media échouée'); return; }
          refreshMedia();
        };
        mediaList.appendChild(row);
      });
      // Enable drag & drop reorder if Sortable is available
      if (window.Sortable && mediaList && !mediaList._sortableInit) {
        mediaList._sortableInit = true;
        new Sortable(mediaList, {
          animation: 150,
          ghostClass: 'drag-ghost',
          onEnd: async () => {
            const order = Array.from(mediaList.children).map(ch => ch.dataset.id).filter(Boolean);
            await fetch(`/api/properties/${p.id}/media/reorder`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ order }) });
          }
        });
      }
    }
    refreshMedia();
    div.querySelector('[data-action="add-media-image"]').onclick = async () => {
      const url = (div.querySelector('[data-k="imageUrl"]').value||'').trim();
      if (!url){ alert("Renseignez d'abord l'Image URL ou uploadez une image"); return; }
      const res = await fetch(`/api/properties/${p.id}/media`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url, type:'image' }) });
      if (!res.ok){ alert('Ajout image échoué'); return; }
      refreshMedia();
    };
    div.querySelector('[data-action="add-media-video"]').onclick = async () => {
      const url = (div.querySelector('[data-k="videoUrl"]').value||'').trim();
      if (!url){ alert("Renseignez d'abord la Vidéo URL ou uploadez une vidéo"); return; }
      const res = await fetch(`/api/properties/${p.id}/media`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url, type:'video' }) });
      if (!res.ok){ alert('Ajout vidéo échoué'); return; }
      refreshMedia();
    };
  });
}

async function uploadMediaFile(fileInput){
  const file = fileInput?.files?.[0];
  if (!file){ alert('Choisissez un fichier'); return null; }
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', { method:'POST', body: fd });
  if (!res.ok){ alert('Upload échoué'); return null; }
  const json = await res.json();
  return json.url;
}

// Used by add-property form (onclick in admin.ejs)
window.uploadMedia = async function(selector, targetField){
  const input = document.querySelector(selector);
  if (!input){ alert('Champ fichier introuvable'); return; }
  const url = await uploadMediaFile(input);
  if (!url) return;
  const form = document.getElementById('add-property-form');
  if (!form){ alert('Formulaire non trouvé'); return; }
  const target = form.querySelector(`[name="${targetField}"]`);
  if (target){ target.value = url; alert('Fichier uploadé. Champ mis à jour.'); }
}

// Initial render
renderBookings();
renderPayments();
renderProperties();
