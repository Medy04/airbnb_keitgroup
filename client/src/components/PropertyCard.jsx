import React from 'react'
import { IconBuilding } from '@tabler/icons-react'
import { Link } from 'react-router-dom'

export default function PropertyCard({ p }){
  return (
    <Link to={`/property/${p.id}`} className="card clickable" style={{display:'block', textDecoration:'none', color:'inherit'}}>
      {p.imageUrl ? (
        <img src={p.imageUrl} alt="" className="card-image"/>
      ) : (
        <div className="card-image" style={{display:'flex',alignItems:'center',justifyContent:'center',background:'#f3f4f6',color:'#6b7280'}}>
          <IconBuilding/>
        </div>
      )}
      <div className="card-body">
        <div className="row between">
          <h3 style={{margin:'6px 0'}}>{p.title}</h3>
        </div>
        <div className="muted small" style={{marginBottom:8}}>{p.address || 'Adresse non renseignée'}</div>
        {(p.availableFrom && p.availableTo) && (
          <div className="badge" style={{marginBottom:8}}>Disponible du {p.availableFrom} au {p.availableTo}</div>
        )}
        <div className="row between">
          <div className="price"><strong>{p.pricePerNight} €</strong><span className="muted small">/ nuit</span></div>
        </div>
        <div className="small muted" style={{marginTop:6}}>Voir détails →</div>
      </div>
    </Link>
  )
}
