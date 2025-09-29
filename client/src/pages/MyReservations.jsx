import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal.jsx'
import BackButton from '../components/BackButton.jsx'

export default function MyReservations(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [userEmail, setUserEmail] = useState('')

  async function load(email){
    setLoading(true)
    try{
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('guestemail', email)
        .order('createdat', { ascending: false })
      if (error) throw error
      const list = Array.isArray(data)? data:[]
      const ids = [...new Set(list.map(b=> b.propertyid).filter(Boolean))]
      let pmap = {}
      if (ids.length){
        const { data: props } = await supabase.from('properties').select('*').in('id', ids)
        ;(props||[]).forEach(p=>{ pmap[p.id] = { id:p.id, title:p.title, address:p.address, imageUrl:p.imageurl||'' } })
      }
      setItems(list.map(b=> ({...b, _property: pmap[b.propertyid]})))
    }catch(e){ setError(e.message) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{
    (async ()=>{
      try{
        const { data: auth } = await supabase.auth.getUser()
        const email = auth?.user?.email || ''
        if (!email){ setError("Veuillez vous connecter pour voir vos réservations."); return }
        setUserEmail(email)
        await load(email)

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
      finally{ /* loading handled in load */ }
    })()
  },[])

  return (
    <div>
      <div className="row" style={{justifyContent:'space-between',alignItems:'center'}}>
        <div className="row" style={{alignItems:'center',gap:12}}>
          <BackButton />
          <h1 className="page-title" style={{margin:0}}>Mes réservations</h1>
        </div>
        <button className="btn" onClick={()=> userEmail && load(userEmail)}>Actualiser</button>
      </div>
      {loading && <div className="empty">Chargement...</div>}
      {error && <div className="empty">{error}</div>}
      {!loading && !error && (
        items.length ? (
          <div className="card" style={{padding:16}}>
            {items.map(b => (
              <div key={b.id} className="row" style={{borderBottom:'1px solid #e5e7eb',padding:'8px 0',cursor:'pointer',gap:12}} onClick={()=>{ setCurrent(b); setOpen(true) }}>
                {b._property?.imageUrl ? (
                  <img src={b._property.imageUrl} alt="" style={{width:56,height:56,objectFit:'cover',borderRadius:8}} />
                ) : (
                  <div style={{width:56,height:56,borderRadius:8,background:'#f3f4f6'}} />
                )}
                <div style={{flex:1}}>
                  <div>
                    <strong>#{String(b.id).slice(0,8)}</strong> • {b.startdate} → {b.enddate}
                  </div>
                  <div className="small muted">{b._property?.title||'Logement'} • {b._property?.address||''}</div>
                  <div className="small muted">
                    <span className={`badge status ${b.status}`}>
                      {(b.status==='pending'?'En attente': b.status==='paying'?'Paiement en cours': b.status==='finalized'?'Finalisée': b.status==='cancelled'?'Annulée': b.status)}
                    </span>
                    {' '}• Voyageurs: {b.guests} • Total: {b.total} €
                  </div>
                </div>
                {b.status==='pending' && (
                  <div className="row" style={{marginTop:6}} onClick={e=>e.stopPropagation()}>
                    <button className="btn" onClick={async ()=>{
                      if (!confirm('Voulez-vous annuler cette réservation ?')) return
                      const { error } = await supabase
                        .from('bookings')
                        .update({ status: 'cancelled' })
                        .eq('id', b.id)
                        .eq('guestemail', userEmail)
                      if (error){ alert('Annulation échouée: '+error.message); return }
                      await load(userEmail)
                    }}>Annuler</button>
                  </div>
                )}
              </div>
            ))}
            <Modal open={open} onClose={()=>setOpen(false)} title={`Réservation #${String(current?.id||'').slice(0,8)}`} width={680}>
              {current && (
                <div className="row" style={{flexDirection:'column'}}>
                  <div className="small muted">Logement</div>
                  <div className="row" style={{gap:12,alignItems:'center'}}>
                    {current._property?.imageUrl && (
                      <img src={current._property.imageUrl} alt="" style={{width:72,height:72,objectFit:'cover',borderRadius:8}} />
                    )}
                    <div>
                      <div><strong>{current._property?.title||'Logement'}</strong></div>
                      <div className="small muted">{current._property?.address||''}</div>
                    </div>
                  </div>
                  <div className="small muted" style={{marginTop:6}}>Période</div>
                  <div>{current.startdate} → {current.enddate} • {current.guests} voyageurs</div>
                  <div className="small muted" style={{marginTop:6}}>Total</div>
                  <div><strong>{current.total} €</strong></div>
                  <div className="small muted" style={{marginTop:6}}>Statut</div>
                  <div><strong>{(current.status==='pending'?'En attente': current.status==='paying'?'Paiement en cours': current.status==='finalized'?'Finalisée': current.status==='cancelled'?'Annulée': current.status)}</strong></div>
                  {current.status==='pending' && (
                    <div style={{marginTop:12}}>
                      <button className="btn" onClick={async ()=>{
                        if (!confirm('Voulez-vous annuler cette réservation ?')) return
                        const { error } = await supabase
                          .from('bookings')
                          .update({ status:'cancelled' })
                          .eq('id', current.id)
                          .eq('guestemail', userEmail)
                        if (error){ alert('Annulation échouée: '+error.message); return }
                        await load(userEmail)
                        setOpen(false)
                      }}>Annuler</button>
                    </div>
                  )}
                  {current.paymentlink && current.status==='paying' && (
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
