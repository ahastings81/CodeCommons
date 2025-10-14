import React, { useEffect, useState, useRef } from 'react';
import { api, getToken, assetUrl } from '../services/api.js';
import UserLink from '../components/UserLink.jsx';
import { io } from 'socket.io-client';
import { useLocation } from 'react-router-dom';

export default function Messages() {
  const location = useLocation();
  const [me, setMe] = useState(null);
  const usersCache = useRef(new Map());
  const [convos, setConvos] = useState([]);
  const [current, setCurrent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const listRef = useRef(null);
  const socketRef = useRef(null);

  function timeAgo(ts) {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts || Date.now());
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const days = Math.floor(h / 24);
    return `${days}d`;
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 0);
  }

  function mapConvoMeta(c) {
    const last = c.lastMessage || {};
    const other = c.other || null;
    if (other?.id) usersCache.current.set(other.id, other);
    return {
      ...c,
      other,
      preview:
        (last.media && last.media.length > 0)
          ? (last.media[0].type === 'image' ? '[photo]' : (last.media[0].type === 'video' ? '[video]' : '[attachment]'))
          : (last.content || ''),
      lastAt: last.createdAt || c.lastMessageAt || c.createdAt,
    };
  }

  function dedupe(list) {
    const seen = new Set(); const out = [];
    for (const m of list) {
      const k = m?.id || m?.tempId;
      if (!k || !seen.has(k)) { if (k) seen.add(k); out.push(m); }
    }
    return out;
  }
  function replaceTemp(list, tempId, serverMsg) {
    return list.map(m => (m?.tempId === tempId ? serverMsg : m));
  }

  useEffect(() => { api.me().then(setMe).catch(() => {}); }, []);

  useEffect(() => {
    (async () => {
      const raw = await api.dmConversations();
      const list = (raw || []).map(mapConvoMeta);
      setConvos(list);

      const params = new URLSearchParams(location.search);
      const openId = params.get('open');
      const openUser = params.get('openUser');

      let target = null;
      if (openId) {
        target = list.find(c => c.id === openId) || null;
      } else if (openUser) {
        target = list.find(c => c.other?.id === openUser) || null;
        if (!target) {
          const created = await api.dmStart(openUser);
          const updated = (await api.dmConversations() || []).map(mapConvoMeta);
          setConvos(updated);
          target = updated.find(c => c.id === created.id) || null;
        }
      }
      if (target) setCurrent(target);
    })();
  }, [location.search]);

  async function loadMessages(convoId) {
    const r = await api.dmMessages(convoId);
    setMessages(r || []);
    scrollToBottom();
  }

  async function loadConvos() {
    const raw = await api.dmConversations();
    const list = (raw || []).map(mapConvoMeta);
    setConvos(list);
  }

  useEffect(() => { loadConvos(); }, []);
  useEffect(() => {
    if (!current) return;
    loadMessages(current.id);
  }, [current?.id]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const s = io(api.API_BASE, { auth: { token } });
    socketRef.current = s;

    s.on('connect', () => {
      if (current?.id) s.emit('joinDm', current.id);
    });
    s.on('dm:message', (m) => {
      if (m.conversationId === current?.id) {
        setMessages(prev => dedupe([...prev, m]));
        scrollToBottom();
      }
      loadConvos();
    });
    s.on('dm:messageEdited', (m) => {
      if (m.conversationId === current?.id) {
        setMessages(prev => prev.map(x => x.id === m.id ? m : x));
      }
    });
    s.on('dm:messageDeleted', ({ conversationId, msgId }) => {
      if (conversationId === current?.id) {
        setMessages(prev => prev.filter(x => x.id !== msgId));
      }
    });
    s.on('dm:conversationDeleted', ({ conversationId }) => {
      setConvos(prev => prev.filter(c => c.id !== conversationId));
      if (current?.id === conversationId) {
        setCurrent(null);
        setMessages([]);
      }
    });

    return () => { try { s.disconnect(); } catch {} };
  }, [current?.id]);

  async function send() {
    if (sending) return;
    const content = text.trim();
    if (!content && files.length === 0) return;
    setSending(true);
    try {
      const media = [];
      for (const f of files) {
        const r = await api.uploadMedia(f);
        media.push(r);
      }
      const tempId = 'temp-' + Math.random().toString(36).slice(2);
      const optimistic = { tempId, conversationId: current.id, senderId: 'me', content, media, createdAt: Date.now() };
      setMessages(prev => [...prev, optimistic]);
      setText(''); setFiles([]);
      const saved = await api.dmSend(current.id, { content, media });
      setMessages(prev => replaceTemp(prev, tempId, saved));
      await loadConvos();
      scrollToBottom();
    } finally {
      setSending(false);
    }
  }

  async function startEdit(m) {
    setEditingId(m.id);
    setEditText(m.content || '');
  }
  async function commitEdit(m) {
    const patch = { content: editText };
    const updated = await api.dmEditMessage(current.id, m.id, patch);
    setMessages(prev => prev.map(x => x.id === m.id ? updated : x));
    setEditingId(null);
  }
  async function deleteMsg(m) {
    await api.dmDeleteMessage(current.id, m.id);
    setMessages(prev => prev.filter(x => x.id !== m.id));
  }
  async function deleteConversation(id) {
    await api.dmDeleteConversation(id);
    setConvos(prev => prev.filter(c => c.id !== id));
    if (current?.id === id) { setCurrent(null); setMessages([]); }
  }

  function renderAttachment(a) {
    if (!a) return null;
    if (a.type === 'image') return <img src={assetUrl(a.url)} alt="" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8 }} />;
    if (a.type === 'video') return <video src={assetUrl(a.url)} controls style={{ maxWidth: 260, borderRadius: 8 }} />;
    return <a href={assetUrl(a.url)} target="_blank" rel="noreferrer">{a.name || 'file'}</a>;
  }

  return (
    <div className="grid" style={{ gridTemplateColumns:'320px 1fr', gap:16 }}>
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
          <strong>Messages</strong>
        </div>
        <div style={{ maxHeight:520, overflowY:'auto' }}>
          {(convos || []).map(c => (
            <div key={c.id} className="row hover" onClick={()=>setCurrent(c)} style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', background: current?.id===c.id ? 'var(--accent-ghost)' : 'transparent' }}>
              <img src={c.other?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.other?.name || c.other?.id || 'U')}`} alt="" width={36} height={36} style={{ borderRadius:'50%', objectFit:'cover' }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:6 }}>
                  <div style={{ fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}><UserLink id={c.other?.id} user={c.other} /></div>
                  <div className="muted" style={{ fontSize:12 }}>{timeAgo(c.lastAt)}</div>
                </div>
                <div className="muted" style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.preview || 'No messages yet'}</div>
              </div>
              <button className="ghost" onClick={(e)=>{ e.stopPropagation(); deleteConversation(c.id); }} title="Delete conversation">🗑️</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        {current ? (
          <div className="card" style={{ display:'flex', flexDirection:'column', height:520 }}>
            <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
              <img src={current.other?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(current.other?.name || current.other?.id || 'U')}`} alt="" width={32} height={32} style={{ borderRadius:'50%' }} />
              <div style={{ fontWeight:600 }}><UserLink id={current.other?.id} user={current.other} /></div>
            </div>
            <div ref={listRef} style={{ flex:1, overflowY:'auto', padding:12 }}>
              {(messages || []).map(m => {
                const mine = m.senderId === me?.id || m.senderId === 'me';
                return (
                  <div key={m.id || m.tempId} style={{ display:'flex', justifyContent: mine?'flex-end':'flex-start', margin:'8px 0' }}>
                    <div style={{ maxWidth:'70%', background: mine?'var(--accent-ghost)':'var(--card)', border:'1px solid var(--border)', padding:10, borderRadius:12 }}>
                      {editingId===m.id ? (
                        <div>
                          <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={3} style={{ width:'100%' }} />
                          <div style={{ display:'flex', gap:8, marginTop:6 }}>
                            <button onClick={()=>commitEdit(m)}>Save</button>
                            <button className="ghost" onClick={()=>{setEditingId(null); setEditText('')}}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {m.content && <div style={{ whiteSpace:'pre-wrap' }}>{m.content}</div>}
                          {(m.media||[]).length>0 && (
                            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
                              {m.media.map((a,idx)=>(<div key={idx}>{renderAttachment(a)}</div>))}
                            </div>
                          )}
                          <div className="muted" style={{ fontSize:12, marginTop:4 }}>{timeAgo(m.createdAt)}</div>
                          {mine && (
                            <div style={{ display:'flex', gap:8, marginTop:6 }}>
                              <button className="ghost" onClick={()=>setEditingId(m.id)} title="Edit">✏️ Edit</button>
                              <button className="ghost" onClick={()=>deleteMsg(m)} title="Delete">🗑️ Delete</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop:'1px solid var(--border)', padding:10 }}>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input type="file" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))} />
                <input
                  value={text}
                  onChange={e=>setText(e.target.value)}
                  placeholder="Type a message…"
                  style={{ flex:1 }}
                  onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }}
                />
                <button onClick={send} disabled={sending || (!text.trim() && files.length===0)}>{sending?'Sending…':'Send'}</button>
              </div>
              {files.length>0 && (
                <div className="muted" style={{ fontSize:12, marginTop:4 }}>{files.length} attachment(s) selected</div>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ height:520, display:'grid', placeItems:'center' }}>Select a conversation.</div>
        )}
      </div>
    </div>
  );
}
