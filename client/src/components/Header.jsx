import React from 'react'
import { NavLink } from 'react-router-dom'
import { IconHome, IconTools, IconLogin, IconLogout, IconCalendarStats, IconShieldLock } from '@tabler/icons-react'
import { supabase, adminEmail } from '../lib/supabase.js'

export default function Header(){
  const [user, setUser] = React.useState(null)
  React.useEffect(()=>{
    let sub = null
    ;(async()=>{
      const { data } = await supabase.auth.getUser()
      setUser(data?.user || null)
      sub = supabase.auth.onAuthStateChange((_e, sess)=>{
        setUser(sess?.user || null)
      })
    })()
    return ()=>{ try{ sub?.data?.subscription?.unsubscribe?.() }catch{} }
  },[])
  const isAdmin = !!user && (user.email?.trim().toLowerCase() === (adminEmail||'').trim().toLowerCase())
  const isUser = !!user && !isAdmin
  const logout = async ()=>{ await supabase.auth.signOut(); window.location.href='/' }
  return (
    <header className="header">
      <div className="container header-inner">
        <NavLink to="/" className="brand">
          <img src="/logo.png" alt="Logo" className="logo" />
          <span>KEITRESIDENCES</span>
        </NavLink>
        <nav>
          <NavLink to="/" className={({isActive})=>isActive? 'active' : ''}><IconHome size={18}/> Accueil</NavLink>
          {isUser && <NavLink to="/mes-reservations" className={({isActive})=>isActive? 'active' : ''}><IconCalendarStats size={18}/> Mes réservations</NavLink>}
          {isAdmin && <NavLink to="/admin" className={({isActive})=>isActive? 'active' : ''}><IconTools size={18}/> Admin</NavLink>}
          {!isAdmin && <NavLink to="/admin-login" className={({isActive})=>isActive? 'active' : ''}><IconShieldLock size={18}/> Admin</NavLink>}
          {!user && <NavLink to="/login" className={({isActive})=>isActive? 'active' : ''}><IconLogin size={18}/> Se connecter</NavLink>}
          {!!user && (
            <button className="btn" onClick={logout} style={{padding:'6px 10px'}}><IconLogout size={18}/> Se déconnecter</button>
          )}
        </nav>
      </div>
    </header>
  )
}
