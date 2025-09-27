import React, { useEffect, useRef, useState } from 'react'
import AirDatepicker from 'air-datepicker'
import fr from 'air-datepicker/locale/fr'
import { supabase } from '../lib/supabase.js'
import { useToast } from './ToastProvider.jsx'
import emailjs from 'emailjs-com'
import Modal from './Modal.jsx'

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
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState('')

  async function loadRanges(){
    try{
      const [{ data: bookings }, { data: unav }] = await Promise.all([
        supabase.from('bookings').select('startdate,enddate,status').eq('propertyid', property.id).in('status', ['pending','paying','finalized']),
        supabase.from('availability').select('id,startdate,enddate').eq('propertyid', property.id)
      ])
      const arr = []
      ;(bookings||[]).forEach(b=> arr.push({ startDate: b.startdate, endDate: b.enddate, source:'booking' }))
      ;(unav||[]).forEach(r=> arr.push({ id: r.id, startDate: r.startdate, endDate: r.enddate, source:'unavailable' }))
      setRanges(arr)
    }catch{ setRanges([]) }
  }

  useEffect(()=>{ loadRanges() }, [property.id])

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
    // must be logged in
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user){ toast.error('Veuillez vous connecter pour réserver'); return }
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
      const { data: rows, error } = await supabase.from('bookings').insert(payload).select('*')
      if (error) throw new Error(error.message)
      const booking = Array.isArray(rows)? rows[0] : null
      onBooked?.()
      setFirstName(''); setLastName(''); setGuestEmail(''); setPhone(''); setGuests(1); setStart(''); setEnd('')
      toast.success('Réservation créée !')
      // refresh calendar to reflect new blocked dates
      await loadRanges()

      // Prepare and send confirmation email via EmailJS
      try{
        const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
        const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
        const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
        const templateParams = {
          to_email: guestEmail,
          email: guestEmail,
          to_name: guestName,
          reservation_id: booking?.id || '',
          property_title: property.title || '',
          property_address: property.address || '',
          startdate: payload.startdate,
          enddate: payload.enddate,
          total: String(total),
          // Common optional fields many EmailJS templates expect
          from_name: 'LINERESIDENCES',
          from_email: 'keitgroup@yahoo.com',
          reply_to: 'keitgroup@yahoo.com',
          message: `Merci pour votre réservation N°${booking?.id || ''} concernant ${property.title || ''} à ${property.address || ''} du ${payload.startdate} au ${payload.enddate} (Total: ${total} €). Vous allez recevoir un lien de paiement Revolut sur cet adresse mail lorsque votre commande aura été traitée par notre équipe. Merci de votre confiance !`,
        }
        await emailjs.send(serviceId, templateId, templateParams, publicKey)
        toast.success('Email de confirmation envoyé')
      }catch(err){
        const detail = [err?.status, err?.text || err?.message].filter(Boolean).join(' ')
        toast.error('Echec envoi email: ' + (detail || 'Erreur inconnue'))
      }

      // Show confirmation popup with same message
      const msg = `Merci pour votre réservation N°${booking?.id || ''} concernant ${property.title || ''} à ${property.address || ''} du ${payload.startdate} au ${payload.enddate} (Total: ${total} €).\n\nVous allez recevoir un lien de paiement Revolut sur cet adresse mail lorsque votre commande aura été traitée par notre équipe.\n\nMerci de votre confiance !`
      setConfirmMsg(msg)
      setShowConfirm(true)
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
      <Modal open={showConfirm} onClose={()=>setShowConfirm(false)} title="Confirmation de réservation" width={640}>
        <pre style={{whiteSpace:'pre-wrap'}}>{confirmMsg}</pre>
      </Modal>
    </div>
  )
}
