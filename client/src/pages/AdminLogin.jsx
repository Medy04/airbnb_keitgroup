import React, { useState } from 'react'
import { signInAdmin } from '../lib/supabaseAuth.js'

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
      await signInAdmin(email, password)
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
