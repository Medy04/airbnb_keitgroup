import React, { useEffect, useRef } from 'react'
import AirDatepicker from 'air-datepicker'
import fr from 'air-datepicker/locale/fr'

// Popup range calendar bound to the start input; fills both start and end inputs
export default function DateRangeInputs({ start, end, onChange }){
  const startRef = useRef(null)
  const endRef = useRef(null)

  useEffect(()=>{
    const el = startRef.current
    if (!el) return
    const dp = new AirDatepicker(el, {
      locale: fr,
      range: true,
      autoClose: true,
      dateFormat: 'yyyy-MM-dd',
      onSelect({ formattedDate }){
        if (Array.isArray(formattedDate)){
          const s = formattedDate[0] || ''
          const e = formattedDate[1] || ''
          onChange?.({ start: s, end: e })
        }
      }
    })
    // Show calendar when focusing either input
    const show = ()=> dp.show()
    const hide = ()=> dp.hide()
    startRef.current?.addEventListener('focus', show)
    endRef.current?.addEventListener('focus', show)
    // keep inputs in sync when props change (simple assignment)
    if (startRef.current && start !== undefined) startRef.current.value = start || ''
    if (endRef.current && end !== undefined) endRef.current.value = end || ''
    return ()=>{ try{ dp.destroy() }catch{} }
  }, [])

  return (
    <div className="row">
      <input ref={startRef} className="input" value={start} onChange={e=>onChange?.({start:e.target.value,end})} placeholder="Début (YYYY-MM-DD)" />
      <input ref={endRef} className="input" value={end} onChange={e=>onChange?.({start,end:e.target.value})} placeholder="Fin (YYYY-MM-DD)" />
    </div>
  )
}
