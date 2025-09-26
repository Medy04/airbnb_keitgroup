import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal.jsx'

export default function MyReservations(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(null)

  useEffect(()=>{
    (async ()=>{
      try{
        const { data: auth } = await supabase.auth.getUser()
        const email = auth?.user?.email || ''
        if (!email){ setError("Veuillez vous connecter pour voir vos réservations."); return }
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('guestemail', email)
          .order('createdat', { ascending: false })
        if (error) throw error
        setItems(Array.isArray(data)? data:[])

        // Realtime updates to reflect admin status changes live
        const channel = supabase.channel('bookings-user-'+email)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `guestemail=eq.${email}` }, (payload) => {
            const row = payload.new
            setItems(prev => {
              const list = prev.slice()
              const idx = list.findIndex(x => x.id === row.id)
              if (idx >= 0) list[idx] = row; else list.unshift(row)
              return list
            })
          })
          .subscribe()
        return () => { try { supabase.removeChannel(channel) } catch {} }
      }catch(e){ setError(e.message) }
      finally{ setLoading(false) }
    })()
  },[])

  return (
    <div>
      <h1 className="page-title">Mes réservations</h1>
      {loading && <div className="empty">Chargement...</div>}
      {error && <div className="empty">{error}</div>}
      {!loading && !error && (
        items.length ? (
          <div className="card" style={{padding:16}}>
            {items.map(b => (
              <div key={b.id} className="row" style={{borderBottom:'1px solid #e5e7eb',padding:'8px 0',cursor:'pointer'}} onClick={()=>{ setCurrent(b); setOpen(true) }}>
                <div>
                  <strong>#{String(b.id).slice(0,8)}</strong> • {b.startdate} → {b.enddate}
                </div>
                <div className="small muted">Statut: {(b.status==='pending'?'En attente': b.status==='paying'?'Paiement en cours': b.status==='finalized'?'Finalisée': b.status)} • Voyageurs: {b.guests} • Total: {b.total} €</div>
              </div>
            ))}
            <Modal open={open} onClose={()=>setOpen(false)} title={`Réservation #${String(current?.id||'').slice(0,8)}`} width={680}>
              {current && (
                <div className="row" style={{flexDirection:'column'}}>
                  <div className="small muted">Période</div>
                  <div>{current.startdate} → {current.enddate} • {current.guests} voyageurs</div>
                  <div className="small muted" style={{marginTop:6}}>Total</div>
                  <div><strong>{current.total} €</strong></div>
                  <div className="small muted" style={{marginTop:6}}>Statut</div>
                  <div><strong>{(current.status==='pending'?'En attente': current.status==='paying'?'Paiement en cours': current.status==='finalized'?'Finalisée': current.status)}</strong></div>
                  {current.paymentlink && (
                    <div style={{marginTop:10}}>
                      <a className="btn" href={current.paymentlink} target="_blank" rel="noreferrer">Payer maintenant</a>
                    </div>
                  )}
                </div>
              )}
            </Modal>
          </div>
        ) : (
          <div className="empty">Aucune réservation</div>
        )
      )}
    </div>
  )
}
