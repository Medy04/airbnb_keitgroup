import React, { useEffect, useRef, useState } from 'react'
import AirDatepicker from 'air-datepicker'
import fr from 'air-datepicker/locale/fr'
import { supabase } from '../lib/supabase.js'
import { useToast } from './ToastProvider.jsx'

export default function BookingWidget({ property, onBooked }){
  const toast = useToast()
  const [ranges, setRanges] = useState([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [guests, setGuests] = useState(1)
  const [loading, setLoading] = useState(false)
  const calRef = useRef(null)

  useEffect(()=>{
    (async ()=>{
      try{
        const [{ data: bookings }, { data: unav }] = await Promise.all([
          supabase.from('bookings').select('startdate,enddate,status').eq('propertyid', property.id).in('status', ['pending','confirmed']),
          supabase.from('availability').select('id,startdate,enddate').eq('propertyid', property.id)
        ])
        const arr = []
        ;(bookings||[]).forEach(b=> arr.push({ startDate: b.startdate, endDate: b.enddate, source:'booking' }))
        ;(unav||[]).forEach(r=> arr.push({ id: r.id, startDate: r.startdate, endDate: r.enddate, source:'unavailable' }))
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
    if (!start || !end){ toast.error('Sélectionnez une période'); return }
    // hard-guard client-side window
    if (property.availableFrom && property.availableTo){
      if (new Date(start) < new Date(property.availableFrom) || new Date(end) > new Date(property.availableTo)){
        toast.error('Dates hors de la fenêtre disponible'); return
      }
    }
    setLoading(true)
    try{
      const nights = Math.max(1, Math.ceil((new Date(end) - new Date(start)) / (1000*60*60*24)))
      const total = nights * (Number(property.pricePerNight)||0)
      const guestName = `${firstName} ${lastName}`.trim()
      const payload = {
        propertyid: property.id,
        startdate: start,
        enddate: end,
        guestname: guestName,
        guestemail: guestEmail,
        guests: Number(guests)||1,
        status: 'pending',
        total,
        createdat: new Date().toISOString(),
      }
      const { error } = await supabase.from('bookings').insert(payload)
      if (error) throw new Error(error.message)
      onBooked?.()
      setFirstName(''); setLastName(''); setGuestEmail(''); setPhone(''); setGuests(1); setStart(''); setEnd('')
      toast.success('Réservation créée !')
    }catch(e){ toast.error(e.message) }
    finally{ setLoading(false) }
  }

  return (
    <div className="card" style={{padding:12}}>
      <h4 style={{marginTop:0}}>Réserver</h4>
      <div className="small muted" style={{marginBottom:8}}>
        {start && end ? <>Période sélectionnée: <strong>{start}</strong> → <strong>{end}</strong></> : 'Sélectionnez vos dates sur le calendrier'}
      </div>
      <div ref={calRef} />
      <form onSubmit={submit} className="row" style={{marginTop:10}}>
        <input className="input" placeholder="Prénom" value={firstName} onChange={e=>setFirstName(e.target.value)} required />
        <input className="input" placeholder="Nom" value={lastName} onChange={e=>setLastName(e.target.value)} required />
        <input className="input" type="email" placeholder="Email" value={guestEmail} onChange={e=>setGuestEmail(e.target.value)} required />
        <input className="input" type="tel" placeholder="Téléphone" value={phone} onChange={e=>setPhone(e.target.value)} />
        <input className="input" type="number" min="1" placeholder="Voyageurs" value={guests} onChange={e=>setGuests(e.target.value)} />
        <button className="btn" disabled={loading || !start || !end}>{loading? 'Envoi...' : 'Réserver'}</button>
      </form>
    </div>
  )
}
