import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function Jobs({ me }) {
  const [jobs, setJobs] = useState([]);
  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [type, setType] = useState('gig');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('javascript, react');
  const [location, setLocation] = useState('Remote');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [remote, setRemote] = useState(true);

  const load = async ()=> setJobs(await api.jobs(q));
  useEffect(()=>{ load() },[]);

  const post = async () => {
    const payload = {
      title, company, type, url, description,
      skills: skills.split(',').map(s=>s.trim()).filter(Boolean),
      location, remote,
      salaryMin: salaryMin?Number(salaryMin):undefined,
      salaryMax: salaryMax?Number(salaryMax):undefined
    };
    const j = await api.postJob(payload);
    setJobs([j, ...jobs]);
    setTitle(''); setCompany(''); setType('gig'); setUrl(''); setDescription(''); setSkills(''); setLocation('Remote'); setSalaryMin(''); setSalaryMax(''); setRemote(true);
  };

  const report = async (id) => { await api.reportJob(id); alert('Reported'); };

  return (
    <div>
      <h2>Job Board</h2>
      <div style={{display:'flex', gap:8, marginBottom:8}}>
        <input placeholder="Search jobs..." value={q} onChange={e=>setQ(e.target.value)} />
        <button onClick={load}>Search</button>
      </div>
      <div className="card" style={{marginBottom:8}}>
        <strong>Post an Opportunity {me?.tier==='pro' ? <span className="badge badge-pro">Pro</span> : <span className="badge">Free limit applies</span>}</strong>
        <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
        <input placeholder="Company" value={company} onChange={e=>setCompany(e.target.value)} />
        <input placeholder="Type (gig, internship, collab)" value={type} onChange={e=>setType(e.target.value)} />
        <input placeholder="URL (optional)" value={url} onChange={e=>setUrl(e.target.value)} />
        <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} />
        <input placeholder="Skills (comma-separated)" value={skills} onChange={e=>setSkills(e.target.value)} />
        <input placeholder="Location" value={location} onChange={e=>setLocation(e.target.value)} />
        <div style={{display:'flex', gap:8}}>
          <input type="number" placeholder="Salary Min" value={salaryMin} onChange={e=>setSalaryMin(e.target.value)} />
          <input type="number" placeholder="Salary Max" value={salaryMax} onChange={e=>setSalaryMax(e.target.value)} />
          <label style={{display:'flex', alignItems:'center', gap:6}}><input type="checkbox" checked={remote} onChange={e=>setRemote(e.target.checked)} /> Remote</label>
        </div>
        <button onClick={post}>Post</button>
      </div>
      <div className="grid">
        {jobs.map(j => (
          <div key={j.id} className="card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <strong>{j.title}</strong>
              {j.featured && <span className="badge">Featured</span>}
            </div>
            <div style={{fontSize:12, color:'var(--muted)'}}>{j.company} • {j.location||'—'} {j.remote && '• Remote'}</div>
            <div style={{color:'var(--muted)'}}>{j.description}</div>
            <div style={{fontSize:12}}>Skills: {j.skills?.join(', ')}</div>
            {(j.salaryMin||j.salaryMax) && <div style={{fontSize:12, color:'var(--muted)'}}>Salary: {j.salaryMin||'?'} - {j.salaryMax||'?'} </div>}
            <div style={{display:'flex', gap:8, marginTop:6}}>
              <Link to={`/jobs/${j.id}`}>View</Link>
              <button onClick={()=>{navigator.clipboard?.writeText(window.location.origin + `/jobs/${j.id}`); alert('Link copied');}}>Share</button>
              {j.url && <a href={j.url} target="_blank">Apply</a>}
              <button onClick={()=>report(j.id)}>Report</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
