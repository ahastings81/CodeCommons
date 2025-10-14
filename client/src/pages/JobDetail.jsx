import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE, getToken } from '../services/api.js';

export default function JobDetail({ me }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Application form state
  const [skills, setSkills] = useState(me?.skills?.join(', ') || '');
  const [resumeText, setResumeText] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeUrl, setResumeUrl] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [contact, setContact] = useState(me?.email || '');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/jobs/${id}`, {
          headers: { 'Authorization': 'Bearer ' + (getToken() || localStorage.getItem('token') || '') }
        });
        if (!res.ok) throw new Error('Failed to load job');
        const j = await res.json();
        setJob(j);
      } catch (e) {
        setError(e.message || 'Error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function uploadResume() {
    if (!resumeFile) return;
    const fd = new FormData();
    fd.append('file', resumeFile);
    const res = await fetch(`${API_BASE}/upload/file`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + (getToken() || localStorage.getItem('token') || '') },
      body: fd
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || 'Upload failed');
    }
    const data = await res.json();
    setResumeUrl(data.url);
    return data.url;
  }

  async function apply(e) {
    e.preventDefault();
    try {
      let uploadedUrl = resumeUrl;
      if (resumeFile && !resumeUrl) {
        uploadedUrl = await uploadResume();
      }
      const body = {
        skills,
        resumeText,
        resumeUrl: uploadedUrl,
        coverLetter,
        contact
      };
      const res = await fetch(`${API_BASE}/jobs/${id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (getToken() || localStorage.getItem('token') || '')
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to apply');
      }
      alert('Application sent as a message to the job poster! Check your Messages for the conversation.');
      navigate('/messages');
    } catch (err) {
      alert(err.message || 'Error applying');
    }
  }

  function share() {
    const link = window.location.origin + `/jobs/${id}`;
    navigator.clipboard?.writeText(link);
    alert('Job link copied to clipboard!');
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!job) return <div>Not found</div>;

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <h2>{job.title}</h2>
        <div style={{display:'flex', gap:8}}>
          {job.url && <a className="button" href={job.url} target="_blank" rel="noreferrer">External Apply</a>}
          <button onClick={share}>Share</button>
        </div>
      </div>
      <div style={{fontSize:14, color:'var(--muted)'}}>{job.company} • {job.location || '—'} {job.remote && '• Remote'}</div>
      {(job.salaryMin || job.salaryMax) && <div style={{marginTop:6}}>Salary: {job.salaryMin || '?'} - {job.salaryMax || '?'}</div>}
      <p style={{marginTop:12}}>{job.description}</p>
      <div style={{fontSize:12}}>Skills: {Array.isArray(job.skills) ? job.skills.join(', ') : ''}</div>

      <div className="card" style={{marginTop:16}}>
        <h3>Apply In‑App</h3>
        <form onSubmit={apply} className="form-grid">
          <label>Skills (comma‑separated)</label>
          <input value={skills} onChange={e=>setSkills(e.target.value)} placeholder="javascript, react, node" />

          <label>Contact (email or handle)</label>
          <input value={contact} onChange={e=>setContact(e.target.value)} placeholder="you@example.com" />

          <label>Paste Resume (optional)</label>
          <textarea rows={6} value={resumeText} onChange={e=>setResumeText(e.target.value)} placeholder="Paste plain text resume" />

          <label>Upload Resume (PDF/DOC/TXT)</label>
          <input type="file" onChange={e=>setResumeFile(e.target.files?.[0] || null)} />

          <label>Cover Letter (optional)</label>
          <textarea rows={6} value={coverLetter} onChange={e=>setCoverLetter(e.target.value)} placeholder="Short note to the poster" />

          <div style={{display:'flex', gap:8}}>
            <button type="submit">Send Application</button>
            <button type="button" onClick={share}>Share</button>
          </div>
        </form>
      </div>
    </div>
  );
}
