import React, { useEffect, useState } from 'react'
import { IconBuilding } from '@tabler/icons-react'
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
    </div>
  )
}
