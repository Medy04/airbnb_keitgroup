import React, { useState } from 'react'

export default function Signup(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e){
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    try{
      const r = await fetch('/signup', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ email, password }) })
      const html = await r.text()
      if (!r.ok) throw new Error('Erreur lors de la création')
      setInfo("Un email de confirmation vous a été envoyé par Supabase. Merci de cliquer sur le lien pour activer votre compte.")
    }catch(e){ setError(e.message) }
    finally{ setLoading(false) }
  }

  return (
    <div>
      <h1 className="page-title">Créer un compte</h1>
      <form onSubmit={onSubmit} className="card" style={{padding:16,maxWidth:420}}>
        {error && <div className="empty" style={{marginBottom:10}}>{error}</div>}
        {info && <div className="empty" style={{marginBottom:10}}>{info}</div>}
        <div className="row">
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Email" required />
          <input className="input" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Mot de passe" required />
        </div>
        <button className="btn" disabled={loading}>{loading? 'Création...' : 'Créer mon compte'}</button>
      </form>
    </div>
  )
}
