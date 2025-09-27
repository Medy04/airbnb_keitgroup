import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function BackButton({ label = 'Retour' }){
  const navigate = useNavigate()
  return (
    <button
      className="btn"
      onClick={()=> navigate(-1)}
      style={{display:'inline-flex',alignItems:'center',gap:8}}
      aria-label="Revenir à la page précédente"
    >
      <span style={{fontWeight:700}}>{'<--'}</span> {label}
    </button>
  )
}
