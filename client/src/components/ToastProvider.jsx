import React, { createContext, useContext, useMemo, useState } from 'react'

const ToastContext = createContext({ success(){}, error(){}, info(){} })

let idSeq = 1

export function ToastProvider({ children }){
  const [toasts, setToasts] = useState([])
  const api = useMemo(()=>({
    success(msg){ push({ id:idSeq++, type:'success', msg }) },
    error(msg){ push({ id:idSeq++, type:'error', msg }) },
    info(msg){ push({ id:idSeq++, type:'info', msg }) },
  }),[])
  function remove(id){ setToasts(ts=>ts.filter(t=>t.id!==id)) }
  function push(t){
    setToasts(ts=>[...ts, t])
    setTimeout(()=>remove(t.id), 2600)
  }
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(){
  return useContext(ToastContext)
}
