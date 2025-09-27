import React, { useEffect, useState } from 'react'
import { IconBuilding, IconShieldLock } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import PropertyCard from '../components/PropertyCard.jsx'

export default function Home(){
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(()=>{
    (async ()=>{
      try{
        const { data, error } = await supabase.from('properties').select('*').order('createdat', { ascending: false })
        if (error) throw new Error(error.message)
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
        setProperties(list)
      }catch(e){ setError(e.message) }
      finally{ setLoading(false) }
    })()
  },[])

  return (
    <div>
      <h1 className="page-title">Nos logements</h1>
      {loading && <div className="empty">Chargement...</div>}
      {error && <div className="empty">{error}</div>}
      <div className="grid">
        {properties.map(p => (
          <PropertyCard key={p.id} p={p} />
        ))}
      </div>
      {/* Admin login floating tab (bottom-left) */}
      <Link to="/admin-login" style={{
        position:'fixed',
        left:16,
        bottom:16,
        display:'inline-flex',
        alignItems:'center',
        gap:8,
        textDecoration:'none',
        background:'#111827',
        color:'#fff',
        padding:'10px 12px',
        borderRadius:999,
        boxShadow:'0 8px 20px rgba(0,0,0,.2)'
      }}>
        <IconShieldLock size={18} /> Admin
      </Link>
    </div>
  )
}
