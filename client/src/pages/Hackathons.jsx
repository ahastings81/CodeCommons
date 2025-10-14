import { Link } from 'react-router-dom';

import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function Hackathons() {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');

  const load = async ()=> setList(await api.hackathons());
  useEffect(()=>{ load() },[]);

  const create = async () => {
    const e = await api.createHackathon({ name, startDate, endDate, description });
    setList([e,...list]); setName(''); setStartDate(''); setEndDate(''); setDescription('');
  };

  return (
    <div>
      <h2>Hackathons</h2>
      <div className="card" style={{marginBottom:8}}>
        <strong>Create Event</strong>
        <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
        <input type="datetime-local" value={startDate} onChange={e=>setStartDate(e.target.value)} />
        <input type="datetime-local" value={endDate} onChange={e=>setEndDate(e.target.value)} />
        <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} />
        <button onClick={create}>Create</button>
      </div>
      <div className="grid">
        {list.map(ev => (
          <div key={ev.id} className="card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <strong>{ev.name}</strong>
              <span className="badge">Votes: {ev.votes || 0}</span>
            </div>
            <div className="muted" style={{fontSize:12}}>{new Date(ev.startDate).toLocaleString()} → {new Date(ev.endDate).toLocaleString()}</div>
            <div style={{marginTop:4}}>{ev.description}</div>
            <div style={{display:'flex', gap:8, marginTop:8}}>
              <Link to={`/hackathons/${ev.id}`}>View</Link>
              <button onClick={()=>{navigator.clipboard?.writeText(window.location.origin + `/hackathons/${ev.id}`); alert('Link copied');}}>Share</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
