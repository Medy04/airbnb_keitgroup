import React, { useEffect, useRef } from 'react'
import AirDatepicker from 'air-datepicker'
import fr from 'air-datepicker/locale/fr'

export default function RangePicker({ onChange, valueStart = '', valueEnd = '' }){
  const ref = useRef(null)
  useEffect(()=>{
    if (!ref.current) return
    const dp = new AirDatepicker(ref.current, {
      inline: true,
      range: true,
      locale: fr,
      dateFormat: 'yyyy-MM-dd',
      selectedDates: [valueStart || null, valueEnd || null].filter(Boolean),
      onSelect({ formattedDate }){
        if (Array.isArray(formattedDate)){
          onChange?.({ start: formattedDate[0] || '', end: formattedDate[1] || '' })
        }
      }
    })
    return ()=>{ try{ dp.destroy() }catch{} }
  }, [])
  return <div className="inline-calendar" ref={ref} />
}
