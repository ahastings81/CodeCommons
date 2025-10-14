import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api.js';

export default function HackathonDetail() {
  const { id } = useParams();
  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try{
        const data = await api.getHackathon(id);
        setEv(data);
      } catch(e){
        setError(e?.message || 'Failed to load');
      } finally{
        setLoading(false);
      }
    })();
  }, [id]);

  async function vote() {
    try {
      const res = await api.voteHackathon(id);
      setEv(prev => prev ? { ...prev, votes: res?.votes ?? (prev.votes+1) } : prev);
      alert('Your vote was recorded!');
    } catch (e) {
      alert(e?.message || 'Failed to vote');
    }
  }

  function share() {
    try{
      const url = window.location.origin + `/hackathons/${id}`;
      navigator.clipboard?.writeText(url);
      alert('Link copied to clipboard!');
    }catch{}
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!ev) return <div>Not found</div>;

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2>{ev.name}</h2>
        <div style={{display:'flex', gap:8}}>
          <button onClick={share}>Share</button>
          <button onClick={vote}>Vote</button>
        </div>
      </div>
      <div className="muted" style={{fontSize:14}}>
        {new Date(ev.startDate).toLocaleString()} → {new Date(ev.endDate).toLocaleString()}
      </div>
      <div style={{marginTop:8}}>Votes: <strong>{ev.votes || 0}</strong></div>
      <p style={{marginTop:12}}>{ev.description}</p>
    </div>
  );
}
