import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api.js';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';

export default function Projects({ me }) {
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState('');
  const [tech, setTech] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [mentorship, setMentorship] = useState(false);
  const { show } = useToast();

  const load = async () => setProjects(await api.projects({ q: query, tech, difficulty, mentorship: mentorship ? '1' : '' }));
  useEffect(()=>{ load() },[]);

  return (
    <div>
      <h2>Projects</h2>
      <div style={{display:'flex', gap:8, marginBottom:8, flexWrap:'wrap'}}>
        <input placeholder="Search..." value={query} onChange={e=>setQuery(e.target.value)} />
        <input placeholder="Tech contains..." value={tech} onChange={e=>setTech(e.target.value)} />
        <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
          <option value="">Any difficulty</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <label style={{display:'flex', alignItems:'center', gap:6}}>
          <input type="checkbox" checked={mentorship} onChange={e=>setMentorship(e.target.checked)} /> Mentorship-friendly
        </label>
        <button onClick={load}>Search</button>
      </div>
      <CreateProject onCreated={(p)=>{ setProjects([p,...projects]); show('Project created'); }} me={me}/>
      <div className="grid" style={{marginTop:12}}>
        {projects.map(p => (
          <div key={p.id} className="card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <strong>{p.title}</strong>
              {p.featured && <span className="badge">Featured</span>}
            </div>
            <div style={{color:'var(--muted)'}}>{p.description}</div>
            <div style={{fontSize:12, color:'var(--muted)'}}>Tech: {p.tech?.join(', ')}</div>
            <div style={{fontSize:12, color:'var(--muted)'}}>Roles Needed: {p.rolesNeeded?.join(', ')}</div>
            <div>{(p.tags||[]).map(t=><span key={t} className="tag">{t}</span>)}</div>
            <div style={{fontSize:12, color:'var(--muted)'}}>Difficulty: {p.difficulty||'—'} {p.mentorshipFriendly && <span className="badge">Mentorship</span>}</div>
            <div style={{display:'flex', gap:8, marginTop:8}}>
              <Link to={`/projects/${p.id}`}><button>Open</button></Link>
              <button onClick={async()=>{ await api.joinProject(p.id); show('Joined project'); }}>Join</button>
              {p.repoUrl && <a href={p.repoUrl} target="_blank">Repo</a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateProject({ onCreated, me }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tech, setTech] = useState('react, node');
  const [roles, setRoles] = useState('Frontend, Backend');
  const [repoUrl, setRepoUrl] = useState('');
  const [tags, setTags] = useState('showcase, open-source');
  const [difficulty, setDifficulty] = useState('beginner');
  const [mentorshipFriendly, setMentorshipFriendly] = useState(true);

  const create = async () => {
    if (!title) return alert('Title required');
    try {
      const p = await api.createProject({
        title, description,
        tech: tech.split(',').map(s=>s.trim()).filter(Boolean),
        rolesNeeded: roles.split(',').map(s=>s.trim()).filter(Boolean),
        repoUrl,
        tags: tags.split(',').map(s=>s.trim()).filter(Boolean),
        difficulty,
        mentorshipFriendly
      });
      onCreated(p);
      setTitle(''); setDescription(''); setTech(''); setRoles(''); setRepoUrl(''); setTags(''); setDifficulty('beginner'); setMentorshipFriendly(false);
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="card">
      <h3>Create a Project {me?.tier==='pro' ? <span className="badge badge-pro">Pro</span> : <span className="badge">Free limit applies</span>}</h3>
      <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
      <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} />
      <input placeholder="Tech (comma-separated)" value={tech} onChange={e=>setTech(e.target.value)} />
      <input placeholder="Roles Needed (comma-separated)" value={roles} onChange={e=>setRoles(e.target.value)} />
      <input placeholder="Repository URL (optional)" value={repoUrl} onChange={e=>setRepoUrl(e.target.value)} />
      <input placeholder="Tags (comma-separated)" value={tags} onChange={e=>setTags(e.target.value)} />
      <div style={{display:'flex', gap:8}}>
        <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <label style={{display:'flex', alignItems:'center', gap:6}}>
          <input type="checkbox" checked={mentorshipFriendly} onChange={e=>setMentorshipFriendly(e.target.checked)} /> Mentorship-friendly
        </label>
      </div>
      <div><button onClick={create}>Create</button></div>
    </div>
  )
}
