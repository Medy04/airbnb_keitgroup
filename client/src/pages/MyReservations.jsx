import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MyReservations(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
              <div key={b.id} className="row" style={{borderBottom:'1px solid #e5e7eb',padding:'8px 0'}}>
                <div>
                  <strong>#{String(b.id).slice(0,8)}</strong> • {b.startdate} → {b.enddate}
                </div>
                <div className="small muted">Statut: {b.status} • Voyageurs: {b.guests} • Total: {b.total} €</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">Aucune réservation</div>
        )
      )}
    </div>
  )
}
