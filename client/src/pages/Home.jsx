import React, { useEffect, useState } from 'react'
import { IconBuilding, IconShieldLock } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import PropertyCard from '../components/PropertyCard.jsx'
import { useI18n } from '../i18n/LanguageProvider.jsx'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'

export default function Home(){
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const { t } = useI18n()

  useEffect(()=>{
    (async ()=>{
      try{
        // Load auth user for greeting
        try{
          const { data: auth } = await supabase.auth.getUser()
          const email = auth?.user?.email || ''
          setUserEmail(email)
        }catch{}

        const { data, error } = await supabase.from('properties').select('*').order('createdat', { ascending: false })
        if (error) throw new Error(error.message)
        let list = (data||[]).map(d => ({
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
        // Fetch reviews to compute avg rating and count for each property
        const ids = list.map(p=>p.id).filter(Boolean)
        if (ids.length){
          const { data: revs } = await supabase
            .from('reviews')
            .select('propertyid, rating')
            .in('propertyid', ids)
          const agg = {}
          ;(revs||[]).forEach(r=>{
            if (!agg[r.propertyid]) agg[r.propertyid] = { sum:0, count:0 }
            agg[r.propertyid].sum += Number(r.rating)||0
            agg[r.propertyid].count += 1
          })
          list = list.map(p=>{
            const a = agg[p.id]
            return a? { ...p, reviewCount: a.count, avgRating: +(a.sum/a.count).toFixed(1) }: { ...p, reviewCount: 0, avgRating: 0 }
          })
        }
        setProperties(list)
      }catch(e){ setError(e.message) }
      finally{ setLoading(false) }
    })()
  },[])

  return (
    <div>
      <div className="row" style={{justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <div />
        <LanguageSwitcher />
      </div>
      {userEmail && (
        <div className="card" style={{padding:12, marginBottom:12}}>
          {t('welcome', { email: userEmail })}
        </div>
      )}
      <h1 className="page-title">{t('our_properties')}</h1>
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
