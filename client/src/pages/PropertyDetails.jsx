import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BookingWidget from '../components/BookingWidget.jsx'
import BackButton from '../components/BackButton.jsx'
import Modal from '../components/Modal.jsx'
import Reviews from '../components/Reviews.jsx'

export default function PropertyDetails(){
  const { id } = useParams()
  const [p, setP] = useState(null)
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')

  useEffect(()=>{
    (async ()=>{
      try{
        const API = import.meta.env.VITE_API_BASE || ''
        const res = await fetch(`${API}/api/properties/${id}`)
        if (!res.ok) throw new Error('Property not found')
        const property = await res.json()
        setP(property)
        const mres = await fetch(`${API}/api/properties/${id}/media`)
        const items = await mres.json().catch(()=>[])
        setMedia(Array.isArray(items)? items: [])
      }catch(e){ setError(e.message) }
      finally{ setLoading(false) }
    })()
  }, [id])

  if (loading) return <div className="empty">Chargement...</div>
  if (error) return <div className="empty">{error}</div>
  if (!p) return <div className="empty">Logement introuvable</div>

  const gallery = media.length ? media : (p.imageUrl? [{ id:'cover', type:'image', url:p.imageUrl }]: [])

  return (
    <div>
      <div className="row" style={{alignItems:'center',gap:12}}>
        <BackButton />
        <h1 className="page-title" style={{margin:0}}>{p.title}</h1>
      </div>
      <div className="row between">
        <div className="small muted">{p.address}</div>
        <div><strong>{p.pricePerNight} €</strong> <span className="small muted">/ nuit</span></div>
      </div>
      {(p.availableFrom && p.availableTo) && (
        <div className="badge" style={{marginBottom:12}}>Disponible du {p.availableFrom} au {p.availableTo}</div>
      )}

      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', marginBottom:16}}>
        {gallery.map(m => (
          <div key={m.id} className="card" style={{overflow:'hidden'}}>
            {m.type==='video' ? (
              <video src={m.url} controls style={{width:'100%'}} />
            ) : (
              <img
                src={m.url}
                alt=""
                style={{width:'100%',height:160,objectFit:'cover',cursor:'zoom-in'}}
                onClick={()=>setPreview(m.url)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{padding:16, marginBottom:16}}>
        <h3 style={{marginTop:0}}>À propos du logement</h3>
        <div className="row">
          <div className="small muted">Capacité</div>
          <div>{p.capacity} voyageurs</div>
        </div>
        <p style={{whiteSpace:'pre-wrap'}}>{p.description || 'Aucune description'}</p>
      </div>

      <BookingWidget property={p} onBooked={()=>{}} />

      <Reviews propertyId={p.id} />

      <Modal open={!!preview} onClose={()=>setPreview('')} title={p.title} width={900}>
        {preview && (
          <div style={{textAlign:'center'}}>
            <img src={preview} alt="preview" style={{maxWidth:'100%',maxHeight:'70vh',objectFit:'contain'}} />
          </div>
        )}
      </Modal>
    </div>
  )
}
