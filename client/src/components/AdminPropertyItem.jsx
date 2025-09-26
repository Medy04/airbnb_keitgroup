import React, { useEffect, useMemo, useRef, useState } from 'react'
import AirDatepicker from 'air-datepicker'
import fr from 'air-datepicker/locale/fr'
import Sortable from 'sortablejs'
import { supabase } from '../lib/supabase.js'

export default function AdminPropertyItem({ p, onUpdated, onDeleted }){
  const [form, setForm] = useState({
    title: p.title || '',
    pricePerNight: p.pricePerNight || 0,
    capacity: p.capacity || 1,
    address: p.address || '',
    imageUrl: p.imageUrl || '',
    videoUrl: p.videoUrl || '',
    description: p.description || ''
  })
  const [ranges, setRanges] = useState([])
  const [loadingRanges, setLoadingRanges] = useState(true)
  const [media, setMedia] = useState([])
  const mediaListRef = useRef(null)
  const avStartRef = useRef(null)
  const avEndRef = useRef(null)

  async function loadBlocked(){
    setLoadingRanges(true)
    const [{ data: bookings }, { data: unav }] = await Promise.all([
      supabase.from('bookings').select('startDate,endDate,status').eq('propertyId', p.id).in('status', ['pending','confirmed']),
      supabase.from('availability').select('id,startDate,endDate').eq('propertyId', p.id)
    ])
    const arr = []
    ;(bookings||[]).forEach(b=> arr.push({ startDate: b.startDate, endDate: b.endDate, source:'booking' }))
    ;(unav||[]).forEach(r=> arr.push({ id: r.id, startDate: r.startDate, endDate: r.endDate, source:'unavailable' }))
    setRanges(arr)
    setLoadingRanges(false)
  }
  async function loadMedia(){
    const { data, error } = await supabase.from('property_media').select('*').eq('propertyId', p.id).order('position', { ascending: true })
    setMedia(data||[])
  }
  useEffect(()=>{ loadBlocked(); loadMedia(); },[p.id])

  useEffect(()=>{
    if (!mediaListRef.current || mediaListRef.current._sortableInit) return
    mediaListRef.current._sortableInit = true
    new Sortable(mediaListRef.current, {
      animation: 150,
      ghostClass: 'drag-ghost',
      onEnd: async () => {
        const order = Array.from(mediaListRef.current.children).map((ch, idx) => ({ id: ch.dataset.id, pos: idx+1})).filter(x=>x.id)
        for (const it of order){
          await supabase.from('property_media').update({ position: it.pos }).eq('id', it.id).eq('propertyId', p.id)
        }
      }
    })
  }, [media])

  useEffect(()=>{
    const startEl = avStartRef.current
    const endEl = avEndRef.current
    if (!startEl || !endEl) return
    const dp1 = new AirDatepicker(startEl, { autoClose:true, dateFormat:'yyyy-MM-dd', locale: fr })
    const dp2 = new AirDatepicker(endEl, { autoClose:true, dateFormat:'yyyy-MM-dd', locale: fr })
    return ()=>{ try{dp1.destroy()}catch{} try{dp2.destroy()}catch{} }
  }, [p.id]) // Add p.id as a dependency

  async function save(){
    const updates = {
      title: form.title,
      description: form.description,
      address: form.address,
      pricepernight: Number(form.pricePerNight)||0,
      imageurl: form.imageUrl,
      videourl: form.videoUrl,
      capacity: Number(form.capacity)||1,
    }
    const { error } = await supabase.from('properties').update(updates).eq('id', p.id)
    if (error){ alert('Erreur mise à jour: '+error.message); return }
    onUpdated?.()
  }
  async function del(){
    if (!confirm('Supprimer ce logement ?')) return
    const { error } = await supabase.from('properties').delete().eq('id', p.id)
    if (error){ alert('Erreur suppression'); return }
    onDeleted?.()
  }

  async function addUnavailable(){
    const start = avStartRef.current?.value?.trim()
    const end = avEndRef.current?.value?.trim()
    if (!start || !end) { alert('Sélectionnez une période'); return }
    const { error } = await supabase.from('availability').insert({ propertyId: p.id, startDate: start, endDate: end })
    if (error){ alert('Ajout indisponible échoué: '+error.message); return }
    avStartRef.current.value=''; avEndRef.current.value=''
    await loadBlocked()
  }
  async function removeUnavailable(rangeId){
    const { error } = await supabase.from('availability').delete().eq('id', rangeId).eq('propertyId', p.id)
    if (error){ alert('Suppression échouée'); return }
    await loadBlocked()
  }

  async function uploadAndSet(input, key){
    const file = input?.files?.[0]
    if (!file){ alert('Choisissez un fichier'); return }
    const ext = file.name.split('.').pop() || ''
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, upsert:false })
    if (error){ alert('Upload échoué: '+error.message); return }
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    setForm(f=>({...f, [key]: data.publicUrl }))
  }
  async function addMedia(type){
    const url = (type==='image'? form.imageUrl : form.videoUrl) || ''
    if (!url){ alert('Renseignez une URL ou uploadez avant'); return }
    const { error } = await supabase.from('property_media').insert({ propertyId: p.id, url, type })
    if (error){ alert('Ajout media échoué'); return }
    await loadMedia()
  }
  async function removeMedia(id){
    const { error } = await supabase.from('property_media').delete().eq('id', id).eq('propertyId', p.id)
    if (error){ alert('Suppression media échouée'); return }
    await loadMedia()
  }

  return (
    <div className="card" style={{padding:16, marginBottom:16}}>
      <div className="row">
        <input className="input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
        <input className="input" type="number" min="0" value={form.pricePerNight} onChange={e=>setForm(f=>({...f,pricePerNight:e.target.value}))} />
        <input className="input" type="number" min="1" value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:e.target.value}))} />
      </div>
      <div className="row">
        <input className="input" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} />
        <input className="input" value={form.imageUrl} onChange={e=>setForm(f=>({...f,imageUrl:e.target.value}))} placeholder="Image URL" />
      </div>
      <div className="row">
        <input className="input" value={form.videoUrl} onChange={e=>setForm(f=>({...f,videoUrl:e.target.value}))} placeholder="Vidéo URL" />
      </div>
      <textarea className="input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
      <div className="row">
        <input type="file" accept="image/*" onChange={e=>uploadAndSet(e.target, 'imageUrl')} />
        <button type="button" className="btn" onClick={()=>addMedia('image')}>Ajouter à la galerie</button>
        <input type="file" accept="video/*" onChange={e=>uploadAndSet(e.target, 'videoUrl')} />
        <button type="button" className="btn" onClick={()=>addMedia('video')}>Ajouter la vidéo</button>
      </div>
      <div className="row">
        <button className="btn" onClick={save}>Enregistrer</button>
        <button className="btn" onClick={del} style={{background:'#ef4444'}}>Supprimer</button>
      </div>

      <hr style={{opacity:.2, margin:'12px 0'}}/>
      <div className="muted small" style={{marginBottom:6}}>Disponibilités (admin):</div>
      <div className="row">
        <input className="input" ref={avStartRef} placeholder="Début (YYYY-MM-DD)" />
        <input className="input" ref={avEndRef} placeholder="Fin (YYYY-MM-DD)" />
        <button className="btn" onClick={addUnavailable}>Bloquer la période</button>
      </div>
      {loadingRanges ? <div className="empty">Chargement calendrier...</div> : (
        <ul className="small" style={{paddingLeft:16}}>
          {ranges.filter(r=>r.source==='unavailable').map(r => (
            <li key={r.id} style={{margin:'4px 0'}}>
              <code>{r.startDate} → {r.endDate}</code> <button className="btn" onClick={()=>removeUnavailable(r.id)} style={{padding:'4px 8px'}}>Retirer</button>
            </li>
          ))}
          {!ranges.filter(r=>r.source==='unavailable').length && <div className="empty">Aucune plage indisponible</div>}
        </ul>
      )}

      <hr style={{opacity:.2, margin:'12px 0'}}/>
      <div className="muted small" style={{marginBottom:6}}>Galerie (glisser-déposer pour réordonner)</div>
      <div ref={mediaListRef}>
        {media.map(m => (
          <div key={m.id} data-id={m.id} className="row" style={{alignItems:'center',gap:8,margin:'6px 0'}}>
            {m.type==='image' ? (
              <img src={m.url} alt="" style={{width:60,height:40,objectFit:'cover',borderRadius:6,border:'1px solid #e5e7eb'}}/>
            ) : (
              <span className="badge">vidéo</span>
            )}
            <a href={m.url} target="_blank" rel="noreferrer" className="small">{m.url}</a>
            <button className="btn" onClick={()=>removeMedia(m.id)} style={{padding:'6px 10px'}}>Supprimer</button>
          </div>
        ))}
        {!media.length && <div className="empty">Aucun média</div>}
      </div>
    </div>
  )
}
