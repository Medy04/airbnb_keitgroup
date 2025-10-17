import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { dict, LANGS } from './translations'

const LanguageContext = createContext({ lang: 'fr', setLang: ()=>{}, t: (k,p)=>k, LANGS })

function interpolate(str, params){
  if (!params) return str
  return Object.keys(params).reduce((acc, key)=> acc.replace(`{${key}}`, params[key]), str)
}

export function LanguageProvider({ children }){
  const [lang, setLang] = useState(()=> localStorage.getItem('lang') || 'fr')
  useEffect(()=>{ localStorage.setItem('lang', lang) }, [lang])

  const t = useMemo(()=> (key, params)=>{
    const d = dict[lang] || dict.fr
    const raw = d[key] || dict.fr[key] || key
    return interpolate(raw, params)
  }, [lang])

  const value = useMemo(()=> ({ lang, setLang, t, LANGS }), [lang, t])
  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  )
}

export function useI18n(){
  return useContext(LanguageContext)
}
