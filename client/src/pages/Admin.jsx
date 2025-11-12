import React, { useEffect, useState } from 'react'
import { IconListDetails, IconCreditCard, IconBuilding } from '@tabler/icons-react'
import AdminPropertyItem from '../components/AdminPropertyItem.jsx'
import DateRangeInputs from '../components/DateRangeInputs.jsx'
import { supabase } from '../lib/supabase.js'
import { requireAdmin } from '../lib/supabaseAuth.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import emailjs from 'emailjs-com'
import BackButton from '../components/BackButton.jsx'
import { useI18n } from '../i18n/LanguageProvider.jsx'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'

function Tabs({ tabs, value, onChange }){
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.id} className={`tab ${value===t.id? 'active':''}`} onClick={()=>onChange(t.id)}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  )
}

function Bookings(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [purging, setPurging] = useState(false)
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const toast = useToast()

  // Fonction pour exporter les commandes en CSV
  const exportToCSV = (bookings) => {
    if (!bookings.length) return;
    
    // Créer un nom de fichier avec le mois et l'année
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const filename = `commandes_${month}_${year}.csv`;
    
    // En-têtes CSV
    let csvContent = 'ID,Client,Email,Logement,Date début,Date fin,Statut,Montant (€),Date de création\n';
    
    // Ajouter chaque commande au CSV
    bookings.forEach(booking => {
      const row = [
        booking.id,
        `"${booking.guestname || ''}"`,
        `"${booking.guestemail || ''}"`,
        `"${booking._property?.title || 'Inconnu'}"`,
        booking.startdate,
        booking.enddate,
        booking.status,
        booking.total || '0',
        new Date(booking.createdat).toLocaleDateString('fr-FR')
      ];
      csvContent += row.join(',') + '\n';
    });
    
    // Créer et déclencher le téléchargement
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Fonction pour purger les commandes de plus de 2 mois
  const purgeOldBookings = async () => {
    if (!window.confirm('Voulez-vous vraiment purger les commandes traitées de plus de 2 mois ? Une sauvegarde CSV sera créée avant la suppression.')) {
      return;
    }
    
    setPurging(true);
    try {
      // Calculer la date d'il y a 2 mois
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      
      // Récupérer les commandes finalisées de plus de 2 mois
      const { data: oldBookings, error } = await supabase
        .from('bookings')
        .select('*')
        .lte('createdat', twoMonthsAgo.toISOString())
        .in('status', ['finalized', 'cancelled']);
      
      if (error) throw error;
      
      if (!oldBookings || oldBookings.length === 0) {
        toast.info('Aucune commande à purger');
        return;
      }
      
      // Exporter les anciennes commandes en CSV
      exportToCSV(oldBookings);
      
      // Supprimer les commandes de la base de données
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .in('id', oldBookings.map(b => b.id));
      
      if (deleteError) throw deleteError;
      
      // Mettre à jour l'interface
      setItems(prev => prev.filter(item => !oldBookings.some(b => b.id === item.id)));
      toast.success(`${oldBookings.length} commandes purgées avec succès`);
      
    } catch (error) {
      console.error('Erreur lors de la purge des commandes:', error);
      toast.error('Erreur lors de la purge: ' + (error.message || 'Erreur inconnue'));
    } finally {
      setPurging(false);
    }
  };
  useEffect(()=>{(async()=>{
    try{
      const { data, error } = await supabase.from('bookings').select('*').order('createdat', { ascending:false })
      const list = Array.isArray(data)? data:[]
      const ids = [...new Set(list.map(b=> b.propertyid).filter(Boolean))]
      let pmap = {}
      if (ids.length){
        const { data: props } = await supabase.from('properties').select('*').in('id', ids)
        ;(props||[]).forEach(p=>{ pmap[p.id] = {
          id: p.id, title: p.title, address: p.address,
          imageUrl: p.imageurl || '',
        } })
      }
      setItems(list.map(b=> ({...b, _property: pmap[b.propertyid] })))
    } finally{ setLoading(false) }
  })()},[])
  useEffect(()=>{
    const channel = supabase.channel('admin-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload)=>{
        const row = payload.new
        setItems(prev => {
          const list = prev.slice()
          const idx = list.findIndex(x => x.id === row.id)
          if (idx >= 0) list[idx] = { ...list[idx], ...row };
          else list.unshift(row)
          return list.sort((a,b)=> new Date(b.createdat) - new Date(a.createdat))
        })
        if (row?.status === 'cancelled'){
          try{ toast.info?.(`Réservation #${String(row.id).slice(0,8)} annulée par le client`) }catch{}
        }
      })
      .subscribe()
    return () => { try { supabase.removeChannel(channel) } catch{} }
  },[])

  async function save(b){
    const { id, status, paymentlink } = b || {}
    const { error } = await supabase.from('bookings').update({ status, paymentlink }).eq('id', id)
    if (error){ toast.error('Erreur sauvegarde: '+error.message); return }
    toast.success('Commande mise à jour')
    setItems(list => list.map(x => x.id===id? { ...x, status, paymentlink }: x))
    setOpen(false)
  }
  function openBooking(b){ setCurrent(b); setOpen(true) }
  return (
    <section className="card" style={{padding:16}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
        <h3 style={{margin: 0}}>Commandes</h3>
        <button 
          className="btn btn-danger" 
          onClick={purgeOldBookings}
          disabled={purging}
          style={{backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer'}}
        >
          {purging ? 'Traitement...' : 'Purger les anciennes commandes'}
        </button>
      </div>
      {loading? <div className="empty">Chargement...</div> :
        items.map(b => (
          <div key={b.id} className="row" style={{borderBottom:'1px solid #e5e7eb',padding:'8px 0',cursor:'pointer',gap:12}} onClick={()=>openBooking(b)}>
            {b._property?.imageUrl ? (
              <img src={b._property.imageUrl} alt="" style={{width:56,height:56,objectFit:'cover',borderRadius:8}} />
            ) : (
              <div style={{width:56,height:56,borderRadius:8,background:'#f3f4f6'}} />
            )}
            <div style={{flex:1}}>
              <div><strong>#{String(b.id).slice(0,8)}</strong> {b.guestname} ({b.guestemail})</div>
              <div className="small muted">
                {(b._property?.title||'Logement')} • {b._property?.address||''}
              </div>
              <div className="small muted">{b.startdate} → {b.enddate} • <span className={`badge status ${b.status}`}>{(b.status==='pending'?'En attente': b.status==='paying'?'Paiement en cours': b.status==='finalized'?'Finalisée': b.status==='cancelled'?'Annulée': b.status)}</span></div>
            </div>
          </div>
        ))
      }
      <Modal open={open} onClose={()=>setOpen(false)} title={`Commande #${String(current?.id||'').slice(0,8)}`} width={680}>
        {current && (
          <div className="row" style={{flexDirection:'column'}}>
            <div className="small muted">Logement</div>
            <div className="row" style={{gap:12,alignItems:'center'}}>
              {current._property?.imageUrl && (
                <img src={current._property.imageUrl} alt="" style={{width:72,height:72,objectFit:'cover',borderRadius:8}} />
              )}
              <div>
                <div><strong>{current._property?.title||'Logement'}</strong></div>
                <div className="small muted">{current._property?.address||''}</div>
              </div>
            </div>
            <div className="small muted" style={{marginTop:6}}>Client</div>
            <div><strong>{current.guestname}</strong> • {current.guestemail}</div>
            <div className="small muted" style={{marginTop:6}}>Période</div>
            <div>{current.startdate} → {current.enddate} • {current.guests} voyageurs</div>
            <div className="small muted" style={{marginTop:6}}>Total</div>
            <div><strong>{current.total} €</strong></div>
            <hr style={{opacity:.2, width:'100%'}}/>
            <div className="row">
              <input className="input" placeholder="Lien de paiement" value={current.paymentlink||''} onChange={e=>setCurrent(c=>({...c,paymentlink:e.target.value}))} />
              <button className="btn" onClick={async ()=>{
                if(!current.paymentlink){ toast.error('Ajoutez un lien'); return }
                const { error } = await supabase.from('bookings').update({ paymentlink: current.paymentlink }).eq('id', current.id)
                if (error){ toast.error('Erreur sauvegarde: '+error.message); return }
                setItems(list => list.map(x => x.id===current.id? { ...x, paymentlink: current.paymentlink }: x))
                // Send payment link via EmailJS
                try{
                  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
                  const templateId = import.meta.env.VITE_EMAILJS_PAYMENT_TEMPLATE_ID || import.meta.env.VITE_EMAILJS_TEMPLATE_ID
                  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
                  const templateParams = {
                    to_email: current.guestemail,
                    email: current.guestemail,
                    to_name: current.guestname || 'Client',
                    reservation_id: current.id,
                    payment_link: current.paymentlink,
                    from_name: 'LineResidences',
                    from_email: 'keitgroup@yahoo.com',
                    reply_to: 'keitgroup@yahoo.com',
                    message: `Bonjour ${current.guestname||''},\n\nVoici votre lien de paiement Revolut pour la réservation N°${String(current.id)}.\n\nLien de paiement: ${current.paymentlink}\n\nMerci de votre confiance !`,
                  }
                  await emailjs.send(serviceId, templateId, templateParams, publicKey)
                  toast.success('Lien de paiement envoyé par email')
                }catch(err){
                  const detail = [err?.status, err?.text || err?.message].filter(Boolean).join(' ')
                  toast.error('Echec envoi email: '+(detail||'Erreur inconnue'))
                }
              }}>Envoyer lien de paiement</button>
            </div>
            <div className="row">
              <select className="input" value={current.status} onChange={e=>setCurrent(c=>({...c,status:e.target.value}))}>
                <option value="pending">En attente</option>
                <option value="paying">Paiement en cours</option>
                <option value="finalized">Finalisé</option>
              </select>
              <button className="btn" onClick={async ()=>{
                const { error } = await supabase.from('bookings').update({ status: current.status }).eq('id', current.id)
                if (error){ toast.error('Erreur mise à jour statut: '+error.message); return }
                setItems(list => list.map(x => x.id===current.id? { ...x, status: current.status }: x))
                toast.success('Statut mis à jour')
              }}>Mettre à jour le statut</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

function Payments(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const toast = useToast()
  useEffect(()=>{(async()=>{
    try{
      const { data, error } = await supabase.from('bookings').select('*').eq('status','finalized').order('createdat',{ascending:false})
      const list = Array.isArray(data)? data:[]
      const ids = [...new Set(list.map(b=> b.propertyid).filter(Boolean))]
      let pmap = {}
      if (ids.length){
        const { data: props } = await supabase.from('properties').select('*').in('id', ids)
        ;(props||[]).forEach(p=>{ pmap[p.id] = { id:p.id, title:p.title, address:p.address, imageUrl:p.imageurl||'' } })
      }
      setItems(list.map(b=> ({...b, _property: pmap[b.propertyid]})))
    } finally{ setLoading(false) }
  })()},[])
  async function save(b){
    const { id, status, paymentlink } = b || {}
    const { error } = await supabase.from('bookings').update({ status, paymentlink }).eq('id', id)
    if (error){ toast.error('Erreur sauvegarde: '+error.message); return }
    toast.success('Commande mise à jour')
    setItems(list => list.map(x => x.id===id? { ...x, status, paymentlink }: x))
    setOpen(false)
  }
  function openBooking(b){ setCurrent(b); setOpen(true) }
  return (
    <section className="card" style={{padding:16}}>
      <h3>Paiements</h3>
      {loading? <div className="empty">Chargement...</div> :
        items.map(b => (
          <div key={b.id} className="row" style={{borderBottom:'1px solid #e5e7eb',padding:'8px 0',cursor:'pointer',gap:12}} onClick={()=>openBooking(b)}>
            {b._property?.imageUrl ? (
              <img src={b._property.imageUrl} alt="" style={{width:56,height:56,objectFit:'cover',borderRadius:8}} />
            ) : (
              <div style={{width:56,height:56,borderRadius:8,background:'#f3f4f6'}} />
            )}
            <div style={{flex:1}}>
              <div><strong>#{String(b.id).slice(0,8)}</strong> {b.guestname} ({b.guestemail})</div>
              <div className="small muted">{b._property?.title||'Logement'} • {b._property?.address||''}</div>
              <div className="small muted">{b.startdate} → {b.enddate} • <span className={`badge status ${b.status}`}>{(b.status==='pending'?'En attente': b.status==='paying'?'Paiement en cours': b.status==='finalized'?'Finalisée': b.status)}</span></div>
            </div>
          </div>
        ))
      }
      <Modal open={open} onClose={()=>setOpen(false)} title={`Commande #${String(current?.id||'').slice(0,8)}`} width={680}>
        {current && (
          <div className="row" style={{flexDirection:'column'}}>
            <div className="small muted">Logement</div>
            <div className="row" style={{gap:12,alignItems:'center'}}>
              {current._property?.imageUrl && (
                <img src={current._property.imageUrl} alt="" style={{width:72,height:72,objectFit:'cover',borderRadius:8}} />
              )}
              <div>
                <div><strong>{current._property?.title||'Logement'}</strong></div>
                <div className="small muted">{current._property?.address||''}</div>
              </div>
            </div>
            <div className="small muted" style={{marginTop:6}}>Client</div>
            <div><strong>{current.guestname}</strong> • {current.guestemail}</div>
            <div className="small muted" style={{marginTop:6}}>Période</div>
            <div>{current.startdate} → {current.enddate} • {current.guests} voyageurs</div>
            <div className="small muted" style={{marginTop:6}}>Total</div>
            <div><strong>{current.total} €</strong></div>
            <hr style={{opacity:.2, width:'100%'}}/>
            <div className="row">
              <input className="input" placeholder="Lien de paiement" value={current.paymentlink||''} onChange={e=>setCurrent(c=>({...c,paymentlink:e.target.value}))} />
              <button className="btn" onClick={async ()=>{
                if(!current.paymentlink){ toast.error('Ajoutez un lien'); return }
                const { error } = await supabase.from('bookings').update({ paymentlink: current.paymentlink }).eq('id', current.id)
                if (error){ toast.error('Erreur sauvegarde: '+error.message); return }
                setItems(list => list.map(x => x.id===current.id? { ...x, paymentlink: current.paymentlink }: x))
                // Send payment link via EmailJS
                try{
                  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
                  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
                  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
                  const templateParams = {
                    to_email: current.guestemail,
                    email: current.guestemail,
                    to_name: current.guestname || 'Client',
                    reservation_id: current.id,
                    payment_link: current.paymentlink,
                    from_name: 'LINERESIDENCES',
                    from_email: 'keitgroup@yahoo.com',
                    reply_to: 'keitgroup@yahoo.com',
                    message: `Bonjour ${current.guestname||''},\n\nVoici votre lien de paiement Revolut pour la réservation N°${String(current.id)}.\n\nLien de paiement: ${current.paymentlink}\n\nMerci de votre confiance !`,
                  }
                  await emailjs.send(serviceId, templateId, templateParams, publicKey)
                  toast.success('Lien de paiement envoyé par email')
                }catch(err){
                  const detail = [err?.status, err?.text || err?.message].filter(Boolean).join(' ')
                  toast.error('Echec envoi email: '+(detail||'Erreur inconnue'))
                }
              }}>Envoyer lien de paiement</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

function Properties(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title:'', pricePerNight:'', capacity:'', address:'', imageUrl:'', videoUrl:'', description:'' })
  const [av, setAv] = useState({ start:'', end:'' })
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  async function uploadAndSet(file, key){
    if (!file){ alert('Choisissez un fichier'); return }
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method:'POST', body: fd })
    if (!res.ok){ alert('Upload échoué'); return }
    const json = await res.json().catch(()=>null)
    if (!json?.url){ alert('Upload échoué'); return }
    setForm(f=>({...f, [key]: json.url }))
  }
  async function load(){
    const res = await fetch('/api/properties')
    const list = await res.json().catch(()=>[])
    setItems(Array.isArray(list)? list: [])
    setLoading(false)
  }
  useEffect(()=>{ load() },[])
  async function onSubmit(e){
    e.preventDefault()
    const payload = {
      title: form.title,
      description: form.description || '',
      address: form.address || '',
      pricePerNight: Number(form.pricePerNight) || 0,
      imageUrl: form.imageUrl || '',
      videoUrl: form.videoUrl || '',
      capacity: Number(form.capacity) || 1,
      availableFrom: av.start || null,
      availableTo: av.end || null,
    }
    const res = await fetch('/api/properties', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    if (!res.ok){
      let msg = 'Erreur ajout logement'
      try{ const j = await res.json(); if (j?.error) msg += ': '+j.error }catch{}
      alert(msg); return
    }
    await res.json().catch(()=>null)
    setForm({ title:'', pricePerNight:'', capacity:'', address:'', imageUrl:'', videoUrl:'', description:'' })
    setAv({ start:'', end:'' })
    await load()
  }
  return (
    <section>
      <form onSubmit={onSubmit} className="card" style={{padding:16, marginBottom:16}}>
        <h3>Ajouter un logement</h3>
        <div className="row">
          <input className="input" placeholder="Titre" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required />
          <input className="input" placeholder="Prix/nuit (€)" type="number" value={form.pricePerNight} onChange={e=>setForm(f=>({...f,pricePerNight:e.target.value}))} required />
          <input className="input" placeholder="Capacité" type="number" value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:e.target.value}))} />
        </div>
        <div className="row">
          <input className="input" placeholder="Adresse" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} />
          <input className="input" placeholder="Image URL" value={form.imageUrl} onChange={e=>setForm(f=>({...f,imageUrl:e.target.value}))} />
        </div>
        <div className="row">
          <input className="input" placeholder="Vidéo URL" value={form.videoUrl} onChange={e=>setForm(f=>({...f,videoUrl:e.target.value}))} />
        </div>
        <div className="row">
          <input type="file" accept="image/*" onChange={e=>uploadAndSet(e.target.files?.[0], 'imageUrl')} />
          <input type="file" accept="video/*" onChange={e=>uploadAndSet(e.target.files?.[0], 'videoUrl')} />
        </div>
        <textarea className="input" placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
        <hr style={{opacity:.15, margin:'12px 0'}}/>
        <div className="muted small" style={{marginBottom:6}}>Disponibilité initiale (optionnel)</div>
        <DateRangeInputs start={av.start} end={av.end} onChange={({start,end})=>setAv({start,end})} />
        <button className="btn">Ajouter</button>
      </form>
      <section className="card" style={{padding:16}}>
        <h3 style={{marginTop:0}}>Logements</h3>
        {loading? (
          <div className="empty">Chargement...</div>
        ) : items.length? (
          <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12}}>
            {items.map(p => (
              <div key={p.id} className="card clickable" style={{overflow:'hidden'}} onClick={()=>{ setCurrent(p); setOpen(true) }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" style={{width:'100%', height:140, objectFit:'cover'}} />
                ) : (
                  <div style={{width:'100%', height:140, background:'#f3f4f6'}} />
                )}
                <div style={{padding:12}}>
                  <div style={{fontWeight:700, marginBottom:4}}>{p.title}</div>
                  <div className="small muted" style={{marginBottom:6}}>{p.address||'—'}</div>
                  <div className="row between" style={{alignItems:'center'}}>
                    <div className="small"><strong>{p.pricePerNight} €</strong><span className="muted">/nuit</span></div>
                    {p.availableFrom && p.availableTo ? (
                      <span className="badge">{p.availableFrom} → {p.availableTo}</span>
                    ) : <span className="badge" style={{opacity:.6}}>Dispo non définie</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">Aucun logement pour le moment</div>
        )}
      </section>

      <Modal open={open} onClose={()=>setOpen(false)} title={current? current.title : 'Logement'} width={800}>
        {current && (
          <AdminPropertyItem key={current.id} p={current} onUpdated={async()=>{ await load(); setOpen(false) }} onDeleted={async()=>{ await load(); setOpen(false) }} />
        )}
      </Modal>
    </section>
  )
}

export default function Admin(){
  const { t } = useI18n()
  const [tab, setTab] = useState('bookings')
  const [stats, setStats] = useState({ total: 0, pending: 0, paying: 0, finalized: 0 })
  useEffect(()=>{
    requireAdmin().catch(()=>{ window.location.href = '/admin-login' })
  },[])
  async function loadStats(){
    try{
      const [t, p, y, f] = await Promise.all([
        supabase.from('bookings').select('*', { count:'exact', head:true }),
        supabase.from('bookings').select('*', { count:'exact', head:true }).eq('status','pending'),
        supabase.from('bookings').select('*', { count:'exact', head:true }).eq('status','paying'),
        supabase.from('bookings').select('*', { count:'exact', head:true }).eq('status','finalized'),
      ])
      setStats({ total: t.count||0, pending: p.count||0, paying: y.count||0, finalized: f.count||0 })
    }catch{}
  }
  useEffect(()=>{ loadStats() },[])
  const tabs = [
    { id:'bookings', label:'Commandes', icon:<IconListDetails size={18}/> },
    { id:'payments', label:'Paiements', icon:<IconCreditCard size={18}/> },
    { id:'properties', label:'Logements', icon:<IconBuilding size={18}/> },
  ]
  return (
    <div>
      <div className="row" style={{alignItems:'center',gap:12,marginBottom:8}}>
        <BackButton />
        <h1 className="page-title" style={{margin:0}}>{t('app_title_admin')}</h1>
        <div style={{marginLeft:'auto'}}>
          <LanguageSwitcher />
        </div>
      </div>
      <div className="row" style={{justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <h2 style={{margin:0,fontSize:18}}>{t('dashboard')}</h2>
        <button className="btn" onClick={loadStats}>Actualiser</button>
      </div>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',marginBottom:12}}>
        <div className="card" style={{padding:12}}>
          <div className="small muted">Commandes reçues</div>
          <div style={{fontSize:24,fontWeight:700}}>{stats.total}</div>
        </div>
        <div className="card" style={{padding:12}}>
          <div className="small muted">En attente</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span className="badge status pending">En attente</span>
            <div style={{fontSize:20,fontWeight:700}}>{stats.pending}</div>
          </div>
        </div>
        <div className="card" style={{padding:12}}>
          <div className="small muted">Paiement en cours</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span className="badge status paying">Paiement en cours</span>
            <div style={{fontSize:20,fontWeight:700}}>{stats.paying}</div>
          </div>
        </div>
        <div className="card" style={{padding:12}}>
          <div className="small muted">Traitées</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span className="badge status finalized">Finalisée</span>
            <div style={{fontSize:20,fontWeight:700}}>{stats.finalized}</div>
          </div>
        </div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab==='bookings' && <Bookings />}
      {tab==='payments' && <Payments />}
      {tab==='properties' && <Properties />}
    </div>
  )
}
