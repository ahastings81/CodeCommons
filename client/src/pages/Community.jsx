import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import UserLink from '../components/UserLink.jsx';
import { useLocation } from 'react-router-dom';

const API = 'http://localhost:4000';

// ---------- helpers ----------
const isArr = (x) => Array.isArray(x);
const byTimeAsc = (a, b) => (a?.createdAt ?? 0) - (b?.createdAt ?? 0);

// NEW: pinned-first comparator (stable-ish: falls back to createdAt)
const byPinnedThenTime = (a, b) => {
  const ap = a.pinned ? 1 : 0;
  const bp = b.pinned ? 1 : 0;
  if (bp !== ap) return bp - ap; // pinned first
  return byTimeAsc(a, b);
};

function nameOf(users, id) {
  const u = (users || []).find(x => x.id === id);
  return u ? (u.name || id) : id;
}
function avatarOf(users, id) {
  const u = (users || []).find(x => x.id === id);
  return u?.avatarUrl || '';
}
function authHeaders() {
  const t = localStorage.getItem('token');
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

// =========================================================

export default function Community() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);      // for resolving names/avatars
  const [categories, setCategories] = useState([]);
  const [currentCatId, setCurrentCatId] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFirstPost, setNewFirstPost] = useState('');
  const [creating, setCreating] = useState(false);

  const location = useLocation();

  // one-time CSS for deep-linked post pulse
  useEffect(() => {
    const styleId = 'cc-pulse-style';
    if (!document.getElementById(styleId)) {
      const s = document.createElement('style');
      s.id = styleId;
      s.textContent = `
        .pulse-highlight { animation: ccPulseBg 1.6s ease-in-out 1; }
        @keyframes ccPulseBg { 0% { background: rgba(255,240,170,.9); } 100% { background: transparent; } }
      `;
      document.head.appendChild(s);
    }
  }, []);

  // initial load (me, users, categories, threads, default/welcome thread)
  useEffect(() => {
    (async () => {
      try { setMe(await api.me()); } catch {}
      try { setUsers(await api.searchUsers('')); } catch {}

      const cats = await api.categories();
      const safeCats = isArr(cats) ? cats : [];
      setCategories(safeCats);

      if (!safeCats.length) return;
      const firstCat = safeCats[0].id;
      setCurrentCatId(firstCat);

      const th = await api.threads(firstCat);
      const safeTh = (isArr(th) ? th : []).map(t => ({
        ...t,
        posts: isArr(t.posts) ? [...t.posts].sort(byTimeAsc) : [],
      }));
      // NEW: pinned-first
      const sorted = [...safeTh].sort(byPinnedThenTime);
      setThreads(sorted);

      const welcome = sorted.find(t => /welcome/i.test(t.title || '')) || sorted[0];
      if (welcome) setActiveThreadId(welcome.id);
    })();
  }, []);

  // deep-link: /community?category=&thread=&post=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get('category');
    const thr = params.get('thread');
    const pst = params.get('post');

    (async () => {
      if (!cat) return;

      // load category threads if switching
      if (cat !== currentCatId) {
        setCurrentCatId(cat);
        const th = await api.threads(cat);
        const safeTh = (isArr(th) ? th : []).map(t => ({
          ...t,
          posts: isArr(t.posts) ? [...t.posts].sort(byTimeAsc) : [],
        }));
        // NEW: pinned-first
        const sorted = [...safeTh].sort(byPinnedThenTime);
        setThreads(sorted);
      }

      // open thread if provided
      if (thr) setActiveThreadId(thr);

      // scroll/highlight post if provided
      if (pst) {
        setTimeout(() => {
          const el = document.getElementById(`post-${pst}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.classList.add('pulse-highlight');
            setTimeout(() => el.classList.remove('pulse-highlight'), 1700);
          }
        }, 60);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // category switch
  const loadThreadsForCategory = async (catId) => {
    setCurrentCatId(catId);
    const th = await api.threads(catId);
    const safeTh = (isArr(th) ? th : []).map(t => ({
      ...t,
      posts: isArr(t.posts) ? [...t.posts].sort(byTimeAsc) : [],
    }));
    // NEW: pinned-first
    const sorted = [...safeTh].sort(byPinnedThenTime);
    setThreads(sorted);
    setActiveThreadId(sorted[0]?.id || null);
  };

  const openThread = (threadId) => setActiveThreadId(threadId);
  const activeThread = threads.find(t => t.id === activeThreadId) || null;

  if (!me) {
    return (
      <div>
        <h2>Community</h2>
        <div className="card">Please log in to view categories, threads, and post replies.</div>
      </div>
    );
  }

  return (
    <div>
      <h2>Community</h2>

      {/* Three columns: Categories | Threads | Posts */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1.2fr', gap: 12 }}>
        {/* Categories */}
        <div className="card">
          <strong>Categories</strong>
          <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: 8 }}>
            {(isArr(categories) ? categories : []).map(c => (
              <li key={c.id} style={{ marginTop: 6 }}>
                <button
                  className={currentCatId === c.id ? 'active' : ''}
                  onClick={() => loadThreadsForCategory(c.id)}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Threads */}
        <div className="card">
          <strong>Threads</strong>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginTop: 8}}>
            <div />
            {me && currentCatId && (
              <button className="ghost" onClick={()=> setShowAdd(v=>!v)}>
                {showAdd ? 'Close' : 'Add Thread'}
              </button>
            )}
          </div>
          {showAdd && (
            <div className="card" style={{marginTop:8, padding:12}}>
              <div className="grid" style={{maxWidth:720}}>
                <label>
                  Title
                  <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Thread title" />
                </label>
                <label>
                  First post (optional)
                  <textarea
                    value={newFirstPost}
                    onChange={e=>setNewFirstPost(e.target.value)}
                    placeholder="Say hello or describe the topic…"
                    style={{minHeight:96}}
                  />
                </label>
                <div style={{display:'flex', gap:8}}>
                  <button
                    disabled={creating || !newTitle.trim() || !currentCatId}
                    onClick={async ()=>{
                      if (!newTitle.trim() || !currentCatId) return;
                      setCreating(true);
                      try {
                        // Prefer api.createThread if available; otherwise direct POST
                        if (typeof api.createThread === 'function') {
                          await api.createThread({
                            categoryId: currentCatId,
                            title: newTitle.trim(),
                            content: newFirstPost.trim() || undefined
                          });
                        } else {
                          await fetch(`${API}/community/threads`, {
                            method: 'POST',
                            headers: { ...authHeaders(), 'Accept':'application/json' },
                            body: JSON.stringify({
                              categoryId: currentCatId,
                              title: newTitle.trim(),
                              content: newFirstPost.trim() || undefined
                            })
                          }).then(r => { if (!r.ok) throw new Error('create failed'); });
                        }
                        // Reload threads for current category
                        await (async ()=>{
                          const th = await api.threads(currentCatId);
                          const safeTh = (Array.isArray(th) ? th : []).map(t => ({
                            ...t,
                            posts: Array.isArray(t.posts) ? [...t.posts].sort(byTimeAsc) : [],
                          }));
                          const sorted = [...safeTh].sort(byPinnedThenTime);
                          setThreads(sorted);
                          // try to open the new one by title
                          const just = sorted.find(t => (t.title||'') === newTitle.trim()) || sorted[0];
                          if (just) setActiveThreadId(just.id);
                        })();
                        setNewTitle(''); setNewFirstPost(''); setShowAdd(false);
                      } catch (e) {
                        alert('Failed to create thread');
                      } finally {
                        setCreating(false);
                      }
                    }}
                  >
                    {creating ? 'Creating…' : 'Create thread'}
                  </button>
                  <button className="ghost" onClick={()=>{ setShowAdd(false); setNewTitle(''); setNewFirstPost(''); }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {(isArr(threads) ? threads : []).map(t => (
              <div
                key={t.id}
                className="card"
                style={{ cursor: 'pointer', borderColor: activeThreadId === t.id ? 'var(--fg)' : 'var(--border)' }}
                onClick={() => openThread(t.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>{t.title}</strong>
                  {t.pinned && <span className="badge">Pinned</span>}
                </div>
                <div style={{ fontSize: 12 }}>
                  Started by {nameOf(users, t.creatorId)} • {new Date(t.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
            {(!threads || threads.length === 0) && <div className="card">No threads yet.</div>}
          </div>
        </div>

        {/* Posts (active thread) */}
        <div className="card">
          <strong>Posts</strong>

          {!activeThread && <div className="card" style={{ marginTop: 8 }}>Select a thread to view posts.</div>}

          {activeThread && (
            <Thread
              key={activeThread.id}
              me={me}
              thread={activeThread}
              users={users}
              refreshUsers={async ()=>{ try { setUsers(await api.searchUsers('')); } catch {} }}
              refreshThreads={async () => {
                if (!currentCatId) return;
                const th = await api.threads(currentCatId);
                const safeTh = (isArr(th) ? th : []).map(t => ({
                  ...t,
                  posts: isArr(t.posts) ? [...t.posts].sort(byTimeAsc) : [],
                }));
                // NEW: pinned-first on refresh
                const sorted = [...safeTh].sort(byPinnedThenTime);
                setThreads(sorted);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================

function Thread({ me, thread, users, refreshThreads, refreshUsers }) {
  // --- Likes for thread and replies ---
  const likeThread = async () => { try { await api.threadLike(thread.id); await refreshThreads(); } catch(e) { console.error(e); } };
  const unlikeThread = async () => { try { await api.threadUnlike(thread.id); await refreshThreads(); } catch(e) { console.error(e); } };
  const likeReply = async (postId) => { try { await api.threadPostLike(thread.id, postId); await refreshThreads(); } catch(e) { console.error(e); } };
  const unlikeReply = async (postId) => { try { await api.threadPostUnlike(thread.id, postId); await refreshThreads(); } catch(e) { console.error(e); } };

  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const posts = isArr(thread.posts) ? thread.posts : [];

  const isAdmin = me?.role === 'admin' || me?.role === 'moderator';
  const isThreadOwner = me?.id === thread.creatorId;

  const submitReply = async () => {
    const body = (text || '').trim();
    if (!body) return;
    setPosting(true);
    try {
      await api.createPost(thread.id, { content: body });
      if (refreshUsers) { try { await refreshUsers(); } catch {} }
      await refreshThreads();
      setText('');
    } catch {
      alert('Failed to post. Are you logged in?');
    } finally {
      setPosting(false);
    }
  };

  // -------- POST ACTIONS: edit / delete / remove / report --------
  const editPost = async (post, newContent) => {
    const body = (newContent || '').trim();
    if (!body) return;
    const res = await fetch(`${API}/community/threads/${thread.id}/posts/${post.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), Accept: 'application/json' },
      body: JSON.stringify({ content: body })
    });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      alert(`Edit failed (${res.status}): ${text || 'Unknown error'}`);
      return;
    }
    await refreshThreads();
  };

  const deletePost = async (post) => {
    if (!confirm('Delete this reply?')) return;
    const res = await fetch(`${API}/community/threads/${thread.id}/posts/${post.id}`, {
      method: 'DELETE',
      headers: { ...authHeaders(), Accept: 'application/json' }
    });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      alert(`Delete failed (${res.status}): ${text || 'Unknown error'}`);
      return;
    }
    await refreshThreads();
  };

  const removePost = async (post) => {
    if (!confirm('Remove this reply?')) return;
    const res = await fetch(`${API}/community/threads/${thread.id}/posts/${post.id}`, {
      method: 'DELETE',
      headers: { ...authHeaders(), Accept: 'application/json' }
    });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      alert(`Remove failed (${res.status}): ${text || 'Unknown error'}`);
      return;
    }
    await refreshThreads();
  };

  const reportPost = async (post) => {
    try {
      const res = await fetch(`${API}/community/threads/${thread.id}/posts/${post.id}/report`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (!res.ok) throw new Error();
      alert('Thanks — reported.');
    } catch {
      alert('Report failed');
    }
  };

  // -------- THREAD ACTIONS: edit title / delete / pin toggle --------
  const editThreadTitle = async () => {
    const newTitle = prompt('Edit thread title:', thread.title);
    if (!newTitle || !newTitle.trim()) return;
    const res = await fetch(`${API}/community/threads/${thread.id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ title: String(newTitle).trim() })
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=> '');
      alert(`Thread edit failed (${res.status}): ${txt || 'Unknown error'}`);
      return;
    }
    await refreshThreads();
  };

  const deleteThread = async () => {
    const ok = confirm('Delete this thread (and all its posts)?');
    if (!ok) return;
    const res = await fetch(`${API}/community/threads/${thread.id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=> '');
      alert(`Thread delete failed (${res.status}): ${txt || 'Unknown error'}`);
      return;
    }
    await refreshThreads();
  };

  const togglePinThread = async () => {
    const desired = !thread.pinned;
    const res = await fetch(`${API}/community/threads/${thread.id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ pinned: desired })
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=> '');
      alert(`Pin toggle failed (${res.status}): ${txt || 'Unknown error'}`);
      return;
    }
    await refreshThreads();
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Thread header with controls */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{thread.title}</div>
              {thread.pinned && <span className="badge">Pinned</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Started by {nameOf(users, thread.creatorId)} • {new Date(thread.createdAt).toLocaleString()}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              <button className="link" onClick={() => (thread.iLike ? unlikeThread() : likeThread())}>
                {thread.iLike ? 'Unlike' : 'Like'}
              </button>
              <span style={{ marginLeft: 6 }}>{thread.likeCount || 0} likes</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {(isThreadOwner || isAdmin) && (
              <>
                <button className="link" onClick={editThreadTitle}>Edit</button>
                <button className="link destructive" onClick={deleteThread}>Delete</button>
              </>
            )}
            {isAdmin && (
              <button className="link" onClick={togglePinThread}>
                {thread.pinned ? 'Unpin' : 'Pin'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      <div style={{ display: 'grid', gap: 8 }}>
        {posts.map(p => (
          <PostRow
            key={p.id}
            me={me}
            thread={thread}
            post={p}
            users={users}
            isAdmin={isAdmin}
            isThreadOwner={isThreadOwner}
            onEdit={editPost}
            onDelete={deletePost}
            onRemove={removePost}
            onReport={reportPost}
           onLike={likeReply} onUnlike={unlikeReply}/>
        ))}
        {posts.length === 0 && (
          <div className="card">Be the first to reply.</div>
        )}
      </div>

      {/* Reply box */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Write a reply…"
          disabled={posting}
        />
        <button onClick={submitReply} disabled={posting}>
          {posting ? 'Posting…' : 'Reply'}
        </button>
      </div>
    </div>
  );
}

function PostRow({ me, thread, post, users, isAdmin, isThreadOwner, onEdit, onDelete, onRemove, onReport, onLike, onUnlike }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(post.content || '');

  const isOwner = me?.id === post.userId;

  // visibility rules
  const showEditDelete = isOwner;
  const showThreadOwnerDelete = !isOwner && isThreadOwner;
  const showAdminRemove = isAdmin && !isOwner;
  const showReport = !isOwner && !isThreadOwner && !isAdmin;

  const saveEdit = async () => {
    await onEdit(post, value);
    setEditing(false);
  };

  return (
    <div id={`post-${post.id}`} className="card" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
      <div>
        {avatarOf(users, post.userId)
          ? <img
              src={avatarOf(users, post.userId)}
              alt="avatar"
              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
            />
          : <div className="badge" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center' }}>👤</div>
        }
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span><strong>{<UserLink id={post.userId} />}</strong> • {new Date(post.createdAt).toLocaleString()}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {showEditDelete && !editing && <button className="link" onClick={() => setEditing(true)}>Edit</button>}
            {showEditDelete && <button className="link" onClick={() => onDelete(post)}>Delete</button>}
            {showThreadOwnerDelete && <button className="link" onClick={() => onDelete(post)}>Delete</button>}
            {showAdminRemove && <button className="link destructive" onClick={() => onRemove(post)}>Remove</button>}
            {showReport && <button className="link" onClick={() => onReport(post)}>Report</button>}
          </span>
        </div>

        {!editing && <div style={{ marginTop: 4 }}>{post.content}</div>}

        {/* Likes for reply */}
        <div className='muted' style={{ fontSize: 12, marginTop: 4 }}>
          <button className='link' onClick={() => (post.iLike ? (onUnlike ? onUnlike(post.id) : null) : (onLike ? onLike(post.id) : null))}>
            {post.iLike ? 'Unlike' : 'Like'}
          </button>
          <span style={{ marginLeft: 6 }}>{post.likeCount || 0} likes</span>
        </div>

        {editing && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input value={value} onChange={e => setValue(e.target.value)} />
            <button onClick={saveEdit}>Save</button>
            <button onClick={() => { setValue(post.content || ''); setEditing(false); }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}