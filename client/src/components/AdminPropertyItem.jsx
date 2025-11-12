import React, { useEffect, useMemo, useRef, useState } from 'react'
import Sortable from 'sortablejs'
import DateRangeInputs from './DateRangeInputs.jsx'
import { useToast } from './ToastProvider.jsx'

export default function AdminPropertyItem({ p, onUpdated, onDeleted }){
  const toast = useToast()
  const API = import.meta.env.VITE_API_BASE || ''
  const [form, setForm] = useState({
    title: p.title || '',
    pricePerNight: p.pricePerNight || 0,
    capacity: p.capacity || 1,
    address: p.address || '',
    imageUrl: p.imageUrl || '',
    videoUrl: p.videoUrl || '',
    description: p.description || '',
    availableFrom: p.availableFrom || '',
    availableTo: p.availableTo || ''
  })
  const [ranges, setRanges] = useState([])
  const [loadingRanges, setLoadingRanges] = useState(true)
  const [media, setMedia] = useState([])
  const mediaListRef = useRef(null)
  const [av, setAv] = useState({ start:'', end:'' })

  async function loadBlocked(){
    setLoadingRanges(true)
    try{
      const res = await fetch(`${API}/api/properties/${p.id}/blocked`)
      const ranges = await res.json().catch(()=>[])
      setRanges(Array.isArray(ranges)? ranges: [])
    }catch{ setRanges([]) }
    setLoadingRanges(false)
  }
  async function loadMedia(){
    try{
      const res = await fetch(`${API}/api/properties/${p.id}/media`)
      const items = await res.json().catch(()=>[])
      setMedia(Array.isArray(items)? items: [])
    }catch{ setMedia([]) }
  }
  useEffect(()=>{ loadBlocked(); loadMedia(); },[p.id])

  useEffect(()=>{
    if (!mediaListRef.current || mediaListRef.current._sortableInit) return
    mediaListRef.current._sortableInit = true
    new Sortable(mediaListRef.current, {
      animation: 150,
      ghostClass: 'drag-ghost',
      onEnd: async () => {
        const order = Array.from(mediaListRef.current.children).map(ch => ch.dataset.id).filter(Boolean)
        await fetch(`${API}/api/properties/${p.id}/media/reorder`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ order }) })
      }
    })
  }, [media])

  // Date inputs handled by DateRangeInputs component

  async function save(){
    const updates = {
      title: form.title,
      description: form.description,
      address: form.address,
      pricePerNight: Number(form.pricePerNight)||0,
      imageUrl: form.imageUrl,
      videoUrl: form.videoUrl,
      capacity: Number(form.capacity)||1,
      availableFrom: form.availableFrom || null,
      availableTo: form.availableTo || null,
    }
    const res = await fetch(`${API}/api/properties/${p.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updates) })
    if (!res.ok){ toast.error('Erreur mise à jour'); return }
    toast.success('Logement mis à jour')
    onUpdated?.()
  }
  async function del(){
    if (!confirm('Supprimer ce logement ?')) return
    const res = await fetch(`${API}/api/properties/${p.id}`, { method:'DELETE' })
    if (!res.ok){ toast.error('Erreur suppression'); return }
    toast.success('Logement supprimé')
    onDeleted?.()
  }

  async function addUnavailable(){
    const start = av.start?.trim()
    const end = av.end?.trim()
    if (!start || !end) { toast.error('Sélectionnez une période'); return }
    const res = await fetch(`${API}/api/properties/${p.id}/availability`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ startDate: av.start, endDate: av.end }) })
    if (!res.ok){ toast.error('Ajout indisponible échoué'); return }
    toast.success('Période bloquée')
    setAv({ start:'', end:'' })
    await loadBlocked()
  }
  async function removeUnavailable(rangeId){
    const res = await fetch(`${API}/api/properties/${p.id}/availability/${rangeId}`, { method:'DELETE' })
    if (!res.ok){ toast.error('Suppression échouée'); return }
    toast.success('Période retirée')
    await loadBlocked()
  }

  async function uploadAndSet(input, key){
    const file = input?.files?.[0]
    if (!file){ toast.error('Choisissez un fichier'); return }
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API}/api/upload`, { method:'POST', body: fd })
    if (!res.ok){ toast.error('Upload échoué'); return }
    const json = await res.json().catch(()=>null)
    if (!json?.url){ toast.error('Upload échoué'); return }
    setForm(f=>({...f, [key]: json.url }))
    toast.success('Media uploadé')
  }
  async function addMedia(type){
    const url = (type==='image'? form.imageUrl : form.videoUrl) || ''
    if (!url){ toast.error('Renseignez une URL ou uploadez avant'); return }
    const res = await fetch(`${API}/api/properties/${p.id}/media`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url, type }) })
    if (!res.ok){ toast.error('Ajout media échoué'); return }
    toast.success('Média ajouté à la galerie')
    await loadMedia()
  }
  async function removeMedia(id){
    const res = await fetch(`${API}/api/properties/${p.id}/media/${id}`, { method:'DELETE' })
    if (!res.ok){ toast.error('Suppression media échouée'); return }
    toast.success('Média supprimé')
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

      <hr style={{opacity:.2, margin:'12px 0'}}/>
      <div className="muted small" style={{marginBottom:6}}>Fenêtre de disponibilité (affichée sur le site)</div>
      <DateRangeInputs start={form.availableFrom} end={form.availableTo} onChange={({start,end})=>setForm(f=>({...f, availableFrom:start, availableTo:end }))} />

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
      <DateRangeInputs start={av.start} end={av.end} onChange={setAv} />
      <div className="row">
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
