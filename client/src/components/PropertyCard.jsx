import React, { useEffect, useState } from 'react'
import InlineCalendar from './InlineCalendar.jsx'
import { IconBuilding } from '@tabler/icons-react'
import BookingWidget from './BookingWidget.jsx'
import { supabase } from '../lib/supabase.js'

export default function PropertyCard({ p }){
  const [ranges, setRanges] = useState(null)
  const [openCal, setOpenCal] = useState(false)
  const [windowInfo, setWindowInfo] = useState(null)

  useEffect(()=>{
    if (!openCal) return
    (async ()=>{
      try{
        const [{ data: bookings }, { data: unav }] = await Promise.all([
          supabase.from('bookings').select('startDate,endDate,status').eq('propertyId', p.id).in('status', ['pending','confirmed']),
          supabase.from('availability').select('id,startDate,endDate').eq('propertyId', p.id)
        ])
        const arr = []
        ;(bookings||[]).forEach(b=> arr.push({ startDate: b.startDate, endDate: b.endDate, source:'booking' }))
        ;(unav||[]).forEach(r=> arr.push({ id: r.id, startDate: r.startDate, endDate: r.endDate, source:'unavailable' }))
        setRanges(arr)
      }catch{ setRanges([]) }
    })()
  }, [openCal, p.id])

  return (
    <article className="card">
      {p.imageUrl ? (
        <img src={p.imageUrl} alt="" className="card-image"/>
      ) : (
        <div className="card-image" style={{display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af'}}><IconBuilding/></div>
      )}
      <div className="card-body">
        <h3 style={{margin:'0 0 6px'}}>{p.title}</h3>
        <div className="muted small" style={{marginBottom:8}}>{p.address || 'Adresse non renseignée'}</div>
        {(p.availableFrom && p.availableTo) && (
          <div className="badge" style={{marginBottom:8}}>Disponible du {p.availableFrom} au {p.availableTo}</div>
        )}
        <div className="row between">
          <div className="price"><strong>{p.pricePerNight} €</strong><span className="muted small">/ nuit</span></div>
          <div className="row">
            <button className="btn" onClick={()=>setOpenCal(v=>!v)}>{openCal? 'Masquer calendrier':'Voir calendrier'}</button>
          </div>
        </div>
        {openCal && (
          <div style={{marginTop:10}}>
            <InlineCalendar ranges={ranges||[]} />
            <div style={{marginTop:10}}>
              <BookingWidget property={p} onBooked={()=>{}} />
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
