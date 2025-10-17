import React from 'react'
import { useI18n } from '../i18n/LanguageProvider.jsx'

export default function LanguageSwitcher(){
  const { lang, setLang, LANGS } = useI18n()
  return (
    <select className="input" value={lang} onChange={e=>setLang(e.target.value)} aria-label="Choisir la langue" style={{maxWidth:180}}>
      {Object.entries(LANGS).map(([code, label])=> (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  )
}
