
import React, { useState } from 'react';
import { api } from '../services/api.js';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('admin@collabhub.local');
  const [password, setPassword] = useState('admin123');
  const [name, setName] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = mode==='login' ? await api.login({ email, password }) : await api.register({ email, password, name });
      onLogin(res.token);
    } catch (e) { alert(e.message); }
  };

  return (
    <div style={{maxWidth:420, margin:'60px auto'}} className="card">
      <h2>Welcome to CodeCommons</h2>
      <p style={{color:'var(--muted)'}}>Find collaborators, build projects, and grow together.</p>
      <form onSubmit={submit} className="grid">
        {mode==='register' && <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} required/>}
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/>
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/>
        <button type="submit">{mode==='login'?'Login':'Create account'}</button>
      </form>
      <div style={{marginTop:8}}>
        {mode==='login' ? (
          <span>New here? <a href="#" onClick={()=>setMode('register')}>Create an account</a></span>
        ) : (
          <span>Already have an account? <a href="#" onClick={()=>setMode('login')}>Login</a></span>
        )}
      </div>
      <div style={{marginTop:16, fontSize:12, color:'var(--muted)'}}>
        Tip: use the demo accounts: admin@collabhub.local / admin123 or demo@collabhub.local / demo123
      </div>
    </div>
  )
}
