import React, { useState } from 'react'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e){
    e.preventDefault()
    setLoading(true)
    setError('')
    try{
      const r = await fetch('/login', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ email, password }) })
      if (r.redirected) { window.location.href = r.url; return }
      const html = await r.text()
      if (!r.ok) throw new Error('Identifiants invalides')
    }catch(e){ setError(e.message) }
    finally{ setLoading(false) }
  }

  return (
    <div>
      <h1 className="page-title">Connexion</h1>
      <form onSubmit={onSubmit} className="card" style={{padding:16,maxWidth:420}}>
        {error && <div className="empty" style={{marginBottom:10}}>{error}</div>}
        <div className="row">
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Email" required />
          <input className="input" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Mot de passe" required />
        </div>
        <button className="btn" disabled={loading}>{loading? 'Connexion...' : 'Se connecter'}</button>
        <div className="small muted" style={{marginTop:8}}>Pas encore de compte ? <a href="/signup">Créer un compte</a></div>
      </form>
    </div>
  )
}
