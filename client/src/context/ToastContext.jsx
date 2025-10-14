
import React, { createContext, useContext, useState, useCallback } from 'react';
const ToastCtx = createContext({ show: (msg)=>{} });
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const show = useCallback((m)=>{ setMsg(m); setTimeout(()=> setMsg(''), 2500); },[]);
  return (<ToastCtx.Provider value={{ show }}>{children}{msg && <div className="toast">{msg}</div>}</ToastCtx.Provider>);
}
export function useToast(){ return useContext(ToastCtx); }
