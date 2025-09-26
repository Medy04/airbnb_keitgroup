import React, { useEffect, useRef, useState } from 'react'
import AirDatepicker from 'air-datepicker'
import fr from 'air-datepicker/locale/fr'
import { supabase } from '../lib/supabase.js'

export default function BookingWidget({ property, onBooked }){
  const [ranges, setRanges] = useState([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guests, setGuests] = useState(1)
  const [loading, setLoading] = useState(false)
  const calRef = useRef(null)

  useEffect(()=>{
    (async ()=>{
      try{
        const [{ data: bookings }, { data: unav }] = await Promise.all([
          supabase.from('bookings').select('startDate,endDate,status').eq('propertyId', property.id).in('status', ['pending','confirmed']),
          supabase.from('availability').select('id,startDate,endDate').eq('propertyId', property.id)
        ])
        const arr = []
        ;(bookings||[]).forEach(b=> arr.push({ startDate: b.startDate, endDate: b.endDate, source:'booking' }))
        ;(unav||[]).forEach(r=> arr.push({ id: r.id, startDate: r.startDate, endDate: r.endDate, source:'unavailable' }))
        setRanges(arr)
      }catch{ setRanges([]) }
    })()
  }, [property.id])

  useEffect(()=>{
    if (!calRef.current) return
    const dp = new AirDatepicker(calRef.current, {
      inline: true,
      range: true,
      locale: fr,
      dateFormat: 'yyyy-MM-dd',
      onRenderCell: ({ date }) => {
        const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
        // Enforce available window if defined
        if (property.availableFrom && property.availableTo){
          const wStart = new Date(property.availableFrom).setHours(0,0,0,0)
          const wEnd = new Date(property.availableTo).setHours(0,0,0,0)
          if (!(t >= wStart && t <= wEnd)) return { disabled: true, classes: 'blocked-day' }
        }
        const blocked = (ranges||[]).some(r => {
          const bs = new Date(r.startDate).setHours(0,0,0,0)
          const be = new Date(r.endDate).setHours(0,0,0,0)
          return t >= bs && t <= be
        })
        return blocked ? { disabled: true, classes: 'blocked-day' } : {}
      },
      onSelect({ formattedDate }){
        if (Array.isArray(formattedDate)){
          setStart(formattedDate[0] || '')
          setEnd(formattedDate[1] || '')
        }
      }
    })
    return ()=>{ try{ dp.destroy() }catch{} }
  }, [JSON.stringify(ranges), property.availableFrom, property.availableTo])

  async function submit(e){
    e.preventDefault()
    if (!start || !end){ alert('Sélectionnez une période'); return }
    // hard-guard client-side window
    if (property.availableFrom && property.availableTo){
      if (new Date(start) < new Date(property.availableFrom) || new Date(end) > new Date(property.availableTo)){
        alert('Dates hors de la fenêtre disponible'); return
      }
    }
    setLoading(true)
    try{
      const nights = Math.max(1, Math.ceil((new Date(end) - new Date(start)) / (1000*60*60*24)))
      const total = nights * (Number(property.pricePerNight)||0)
      const { error } = await supabase.from('bookings').insert({
        propertyId: property.id,
        startDate: start,
        endDate: end,
        guestName,
        guestEmail,
        guests: Number(guests)||1,
        status: 'pending',
        total,
        createdAt: new Date().toISOString(),
        paymentLink: ''
      })
      if (error) throw new Error(error.message)
      onBooked?.()
      setGuestName(''); setGuestEmail(''); setGuests(1); setStart(''); setEnd('')
      alert('Réservation créée ! Un email de confirmation va être envoyé.')
    }catch(e){ alert(e.message) }
    finally{ setLoading(false) }
  }

  return (
    <div className="card" style={{padding:12}}>
      <h4 style={{marginTop:0}}>Réserver</h4>
      <div ref={calRef} className="inline-calendar" />
      <form onSubmit={submit}>
        <div className="row">
          <input className="input" value={guestName} onChange={e=>setGuestName(e.target.value)} placeholder="Nom" required />
          <input className="input" value={guestEmail} onChange={e=>setGuestEmail(e.target.value)} type="email" placeholder="Email" required />
          <input className="input" value={guests} onChange={e=>setGuests(Number(e.target.value)||1)} type="number" min="1" placeholder="Voyageurs" />
        </div>
        <div className="row">
          <input className="input" value={start} onChange={e=>setStart(e.target.value)} placeholder="Début (YYYY-MM-DD)" />
          <input className="input" value={end} onChange={e=>setEnd(e.target.value)} placeholder="Fin (YYYY-MM-DD)" />
        </div>
        <button className="btn" disabled={loading}>{loading? 'Envoi...' : 'Confirmer'}</button>
      </form>
    </div>
  )
}
