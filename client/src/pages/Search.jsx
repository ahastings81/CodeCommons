
import React, { useState } from 'react';
import { api } from '../services/api.js';
import { Link } from 'react-router-dom';

export default function Search() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const go = async ()=> setRes(await api.searchAll(q));
  return (
    <div>
      <h2>Search</h2>
      <div style={{display:'flex', gap:8}}>
        <input placeholder="Search users, projects, threads, jobs" value={q} onChange={e=>setQ(e.target.value)} />
        <button onClick={go}>Go</button>
      </div>
      {res && (
        <div className="grid" style={{marginTop:12}}>
          <div className="card"><h3>Projects</h3>{res.projects.map(p=>(<div key={p.id}><Link to={`/projects/${p.id}`}>{p.title}</Link></div>)) || '—'}</div>
          <div className="card"><h3>Users</h3>{res.users.map(u=>(<div key={u.id}>{u.name} {u.tier==='pro' && <span className="badge badge-pro">Pro</span>}</div>)) || '—'}</div>
          <div className="card"><h3>Threads</h3>{res.threads.map(t=>(<div key={t.id}>{t.title}</div>)) || '—'}</div>
          <div className="card"><h3>Jobs</h3>{res.jobs.map(j=>(<div key={j.id}>{j.title} — {j.company}</div>)) || '—'}</div>
        </div>
      )}
    </div>
  )
}
