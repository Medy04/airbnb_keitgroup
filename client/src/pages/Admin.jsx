import React, { useEffect, useState } from 'react'
import { IconListDetails, IconCreditCard, IconBuilding } from '@tabler/icons-react'
import AdminPropertyItem from '../components/AdminPropertyItem.jsx'
import DateRangeInputs from '../components/DateRangeInputs.jsx'
import { supabase } from '../lib/supabase.js'
import { requireAdmin } from '../lib/supabaseAuth.js'

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
  useEffect(()=>{(async()=>{
    try{
      const { data, error } = await supabase.from('bookings').select('*').order('createdat', { ascending:false })
      setItems(Array.isArray(data)? data:[])
    } finally{ setLoading(false) }
  })()},[])
  return (
    <section className="card" style={{padding:16}}>
      <h3>Commandes</h3>
      {loading? <div className="empty">Chargement...</div> :
        items.map(b => (
          <div key={b.id} className="row" style={{borderBottom:'1px solid #e5e7eb',padding:'8px 0'}}>
            <div><strong>#{String(b.id).slice(0,8)}</strong> {b.guestname} ({b.guestemail})</div>
            <div className="small muted">{b.startdate} → {b.enddate} • {b.status}</div>
          </div>
        ))
      }
    </section>
  )
}

function Payments(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(()=>{(async()=>{
    try{
      const { data, error } = await supabase.from('bookings').select('*').eq('status','pending').order('createdat',{ascending:false})
      setItems(Array.isArray(data)? data:[])
    } finally{ setLoading(false) }
  })()},[])
  return (
    <section className="card" style={{padding:16}}>
      <h3>Paiements</h3>
      {loading? <div className="empty">Chargement...</div> :
        items.map(b => (
          <div key={b.id} className="row" style={{borderBottom:'1px solid #e5e7eb',padding:'8px 0'}}>
            <div><strong>#{String(b.id).slice(0,8)}</strong> {b.guestname} ({b.guestemail})</div>
            <div className="small muted">{b.startdate} → {b.enddate} • {b.status}</div>
          </div>
        ))
      }
    </section>
  )
}

function Properties(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title:'', pricePerNight:'', capacity:'', address:'', imageUrl:'', videoUrl:'', description:'' })
  const [av, setAv] = useState({ start:'', end:'' })
  async function uploadAndSet(file, key){
    if (!file){ alert('Choisissez un fichier'); return }
    const ext = file.name.split('.').pop() || ''
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, upsert: false })
    if (error){ alert('Upload échoué: '+error.message); return }
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    setForm(f=>({...f, [key]: data.publicUrl }))
  }
  async function load(){
    const { data, error } = await supabase.from('properties').select('*').order('createdat', { ascending:false })
    const list = (data||[]).map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      address: d.address,
      pricePerNight: d.pricepernight,
      imageUrl: d.imageurl,
      videoUrl: d.videourl,
      capacity: d.capacity,
      createdAt: d.createdat,
      availableFrom: d.available_from,
      availableTo: d.available_to,
    }))
    setItems(list); setLoading(false)
  }
  useEffect(()=>{ load() },[])
  async function onSubmit(e){
    e.preventDefault()
    const payload = {
      title: form.title,
      description: form.description || '',
      address: form.address || '',
      pricepernight: Number(form.pricePerNight) || 0,
      imageurl: form.imageUrl || '',
      videourl: form.videoUrl || '',
      capacity: Number(form.capacity) || 1,
      available_from: av.start || null,
      available_to: av.end || null,
      createdat: new Date().toISOString(),
    }
    const { data: created, error } = await supabase.from('properties').insert(payload).select('*').single()
    if (error){ alert('Erreur ajout logement: '+error.message); return }
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
        <h3>Logements</h3>
        {loading? <div className="empty">Chargement...</div> : (
          items.length? items.map(p => (
            <AdminPropertyItem key={p.id} p={p} onUpdated={load} onDeleted={load} />
          )) : <div className="empty">Aucun logement pour le moment</div>
        )}
      </section>
    </section>
  )
}

export default function Admin(){
  const [tab, setTab] = useState('bookings')
  useEffect(()=>{
    requireAdmin().catch(()=>{ window.location.href = '/admin-login' })
  },[])
  const tabs = [
    { id:'bookings', label:'Commandes', icon:<IconListDetails size={18}/> },
    { id:'payments', label:'Paiements', icon:<IconCreditCard size={18}/> },
    { id:'properties', label:'Logements', icon:<IconBuilding size={18}/> },
  ]
  return (
    <div>
      <h1 className="page-title">Espace Admin</h1>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab==='bookings' && <Bookings />}
      {tab==='payments' && <Payments />}
      {tab==='properties' && <Properties />}
    </div>
  )
}
