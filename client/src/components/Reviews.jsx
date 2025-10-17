import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n/LanguageProvider.jsx'

export default function Reviews({ propertyId }){
  const { t } = useI18n()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [canReview, setCanReview] = useState(false)

  const avg = useMemo(()=>{
    if (!items.length) return 0
    return (items.reduce((s, it)=> s + (Number(it.rating)||0), 0) / items.length).toFixed(1)
  }, [items])

  async function load(){
    setLoading(true)
    try{
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('propertyid', propertyId)
        .order('createdat', { ascending: false })
      if (error) throw error
      setItems(Array.isArray(data)? data:[])
    }catch(e){ setError(e.message) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ load() }, [propertyId])
  useEffect(()=>{
    (async()=>{
      try{
        const { data } = await supabase.auth.getUser()
        const email = data?.user?.email || ''
        setUserEmail(email)
        setUserName(data?.user?.user_metadata?.full_name || email?.split('@')[0] || '')
        if (email){
          // user can review only if they have a finalized booking for this property
          const { data: bookings, error } = await supabase
            .from('bookings')
            .select('id')
            .eq('guestemail', email)
            .eq('propertyid', propertyId)
            .eq('status', 'finalized')
            .limit(1)
          setCanReview((bookings||[]).length>0)
        } else {
          setCanReview(false)
        }
      }catch{}
    })()
  },[])

  async function submit(e){
    e.preventDefault()
    if (!userEmail){ alert(t('sign_in_required')); return }
    if (!rating || rating<1 || rating>5){ alert('Rating 1-5'); return }
    try{
      setSubmitting(true)
      const payload = {
        propertyid: propertyId,
        useremail: userEmail,
        username: userName || userEmail,
        rating: Number(rating),
        comment: comment || '',
        createdat: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('reviews').insert(payload).select('*').single()
      if (error) throw error
      setItems(list => [data, ...list])
      setRating(5)
      setComment('')
    }catch(e){ alert(e.message) }
    finally{ setSubmitting(false) }
  }

  return (
    <section id="reviews" className="card" style={{padding:16}}>
      <div className="row" style={{justifyContent:'space-between',alignItems:'center'}}>
        <h3 style={{margin:0}}>{t('reviews')}</h3>
        <div className="small muted">{items.length} · ⭐ {avg}</div>
      </div>
      {loading && <div className="empty">Chargement...</div>}
      {error && <div className="empty">{error}</div>}
      {!loading && !error && (
        <>
          {canReview ? (
            <form onSubmit={submit} className="row" style={{gap:8, alignItems:'center', marginBottom:12}}>
              <label className="small" htmlFor="rating" style={{minWidth:60}}>{t('rating')}</label>
              <select id="rating" className="input" value={rating} onChange={e=>setRating(Number(e.target.value))} style={{maxWidth:100}}>
                {[5,4,3,2,1].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input className="input" placeholder={t('comment')} value={comment} onChange={e=>setComment(e.target.value)} style={{flex:1}} />
              <button className="btn" disabled={submitting}>{t('submit')}</button>
            </form>
          ) : (
            <div className="empty">{userEmail? t('review_requires_finalized') : t('sign_in_required')}</div>
          )}
          {items.length? items.map(r => (
            <div key={r.id} className="row" style={{borderTop:'1px solid #e5e7eb', padding:'8px 0', gap:8}}>
              <div style={{fontWeight:600}}>{r.username||r.useremail}</div>
              <div className="small muted">⭐ {r.rating}</div>
              <div className="small" style={{opacity:.8}}>{new Date(r.createdat).toLocaleDateString()}</div>
              <div style={{flex:1}}>{r.comment}</div>
            </div>
          )) : <div className="empty">Aucun avis pour le moment</div>}
        </>
      )}
    </section>
  )
}
