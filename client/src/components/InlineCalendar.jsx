import React, { useEffect, useRef } from 'react'
import AirDatepicker from 'air-datepicker'
import fr from 'air-datepicker/locale/fr'

export default function InlineCalendar({ ranges = [] }){
  const ref = useRef(null)
  useEffect(()=>{
    if (!ref.current) return
    const dp = new AirDatepicker(ref.current, {
      inline: true,
      range: false,
      locale: fr,
      onRenderCell: ({ date }) => {
        const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
        const blocked = (ranges||[]).some(r => {
          const bs = new Date(r.startDate).setHours(0,0,0,0)
          const be = new Date(r.endDate).setHours(0,0,0,0)
          return t >= bs && t <= be
        })
        return blocked ? { disabled: true, classes: 'blocked-day' } : {}
      }
    })
    return () => { try { dp?.destroy?.() } catch{} }
  }, [JSON.stringify(ranges)])
  return <div className="inline-calendar" ref={ref} />
}
