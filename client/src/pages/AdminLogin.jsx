import React, { useState } from 'react'
import { supabase, adminEmail } from '../lib/supabase.js'

export default function AdminLogin(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e){
    e.preventDefault()
    setLoading(true)
    setError('')
    try{
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const user = data?.user
      const u = user?.email?.trim().toLowerCase()
      const a = (adminEmail||'').trim().toLowerCase()
      if (u !== a){
        throw new Error("Cet utilisateur n'est pas autorisé en tant qu'admin")
      }
      window.location.href = '/admin'
    }catch(e){ setError(e.message) }
    finally{ setLoading(false) }
  }

  return (
    <div>
      <h1 className="page-title">Connexion Admin</h1>
      <form onSubmit={onSubmit} className="card" style={{padding:16,maxWidth:420}}>
        {error && <div className="empty" style={{marginBottom:10}}>{error}</div>}
        <div className="row">
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Email admin" required />
          <input className="input" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Mot de passe" required />
        </div>
        <button className="btn" disabled={loading}>{loading? 'Connexion...' : 'Se connecter'}</button>
      </form>
    </div>
  )
}
