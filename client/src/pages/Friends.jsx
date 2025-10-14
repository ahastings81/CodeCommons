import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import UserLink from '../components/UserLink.jsx';

function normalizeUser(u) {
  if (!u) return null;
  if (typeof u === 'string') return { id: u };
  if (u.userId && !u.id) return { ...u, id: u.userId };
  return {
    id: u.id ?? u.userId,
    name: u.name ?? u.displayName ?? u.username ?? u.email ?? '',
    username: u.username ?? '',
    displayName: u.displayName ?? u.name ?? '',
    email: u.email ?? '',
    avatarUrl: u.avatarUrl ?? u.avatar ?? '',
  };
}

function getOtherUser(r, myId) {
  if (!r) return null;
  if (r.other) return normalizeUser(r.other);
  if (r.user) return normalizeUser(r.user);
  const A = normalizeUser(r.userA);
  const B = normalizeUser(r.userB);
  if (A && B) return (A.id === myId ? B : A);
  if (r.toUserId && r.fromUserId)
    return normalizeUser(r.toUserId === myId ? r.fromUserId : r.toUserId);
  return null;
}

export default function Friends() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  async function load() {
    try {
      const meData = await api.me();
      setMe(meData);
      const f = await api.listFriends();
      const reqs = await api.listFriendRequests();
      const bl = await api.listBlocked();
      setFriends(Array.isArray(f) ? f.map(x => normalizeUser(x.user || x)) : []);
      setIncoming(reqs?.incoming || []);
      setOutgoing(reqs?.outgoing || []);
      setBlocked(Array.isArray(bl) ? bl.map(normalizeUser) : []);
    } catch (e) {
      console.error('Friends load error:', e);
    }
  }

  useEffect(() => { load(); }, []);

  async function searchUsers(e) {
    e.preventDefault();
    if (!q.trim()) { setResults([]); return; }
    const r = await api.searchUsers(q.trim());
    setResults(Array.isArray(r) ? r.map(normalizeUser) : []);
  }

  const myId = me?.id;

  return (
    <div className="container">
      <h1>Friends</h1>
      <div className="grid two">
        <div className="stack">
          {/* Friends */}
          <div className="card">
            <h3>Friends</h3>
            {friends.map(u => (
              <div key={u.id} className="list-item" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span><UserLink id={u.id} user={u} showAvatar size={28} to={`/u/${u.id}`} /></span>
                <div style={{display:'flex', gap:8}}>
                  <button className="ghost" onClick={()=>navigate(`/messages?openUser=${u.id}`)}>Message</button>
                  <button onClick={async()=>{ await api.removeFriend(u.id); await load(); }}>Remove</button>
                </div>
              </div>
            ))}
            {friends.length === 0 && <div className="muted">No friends yet.</div>}
          </div>

          {/* Incoming */}
          <div className="card">
            <h3>Incoming Requests</h3>
            {incoming.map(r => {
              const other = getOtherUser(r, myId);
              if (!other) return null;
              return (
                <div key={r.id} className="list-item" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <UserLink id={other.id} user={other} showAvatar size={24} to={`/u/${other.id}`} />
                    <span>sent you a request</span>
                  </span>
                  <span>
                    <button onClick={async ()=>{ await api.respondFriend(r.id, 'accept'); await load(); }}>Accept</button>
                    <button onClick={async ()=>{ await api.respondFriend(r.id, 'deny'); await load(); }} style={{marginLeft:8}}>Deny</button>
                  </span>
                </div>
              );
            })}
            {incoming.length === 0 && <div className="muted">No incoming requests.</div>}
          </div>

          {/* Outgoing */}
          <div className="card">
            <h3>Outgoing Requests</h3>
            {outgoing.map(r => {
              const other = getOtherUser(r, myId);
              if (!other) return null;
              return (
                <div key={r.id} className="list-item" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span><UserLink id={other.id} user={other} showAvatar size={24} to={`/u/${other.id}`} /> <span className="muted">— pending</span></span>
                  <div style={{display:'flex', gap:8}}>
                    <button className="ghost" onClick={async ()=>{ await api.respondFriend(r.id, 'deny'); await load(); }}>Cancel</button>
                    <button onClick={async ()=>{ const convo = await api.dmStart(other.id); navigate(`/messages?open=${convo.id}`); }}>Message</button>
                  </div>
                </div>
              );
            })}
            {outgoing.length === 0 && <div className="muted">No outgoing requests.</div>}
          </div>

          {/* Blocked */}
          <div className="card">
            <h3>Blocked</h3>
            {blocked.map(b => {
              const id = b.blockedId || b.id;
              const u = { ...b, id };
              return (
                <div key={id} className="list-item" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span><UserLink id={id} user={u} showAvatar size={24} to={`/u/${id}`} /></span>
                  <button onClick={async ()=>{ await api.unblock(id); await load(); }}>Unblock</button>
                </div>
              );
            })}
            {blocked.length === 0 && <div className="muted">No one blocked.</div>}
          </div>
        </div>

        {/* RIGHT search */}
        <div className="card">
          <h3>Find People</h3>
          <form onSubmit={searchUsers} style={{display:'flex', gap:8, marginBottom:12}}>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name or email…" />
            <button type="submit">Search</button>
          </form>
          {results.length === 0 ? (
            <div className="muted">Search to find users.</div>
          ) : (
            results.map(u => (
              <div key={u.id} className="list-item" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span><UserLink id={u.id} user={u} showAvatar size={24} to={`/u/${u.id}`} /></span>
                <div style={{display:'flex', gap:8}}>
                  <button className="ghost" onClick={()=>navigate(`/messages?openUser=${u.id}`)}>Message</button>
                  <button onClick={async()=>{ await api.requestFriend(u.id); await load(); }}>Add Friend</button>
                  <button className="ghost" onClick={async()=>{ await api.block(u.id); await load(); }}>Block</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
