import UserLink from '../components/UserLink.jsx';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';

/** CSS helpers (avoid inline var() parsing issues) */
const BORDER = "1px solid var(--border)";

/** ---------- helpers ---------- */
function timeAgo(ts) {
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts || Date.now());
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  return `${dd}d`;
}

// Extract user info from various shapes
function extractUserRef(o = {}) {
  const c = o.author || o.user || o.owner || null;
  const directId = o.authorId || o.userId || o.ownerId || o.createdBy || null;
  if (c && (c.id || c._id)) {
    return {
      id: c.id || c._id,
      name: c.name || c.username || c.handle || null,
      avatarUrl: c.avatarUrl || c.avatar || c.photoUrl || null,
    };
  }
  if (directId) return { id: directId, name: null, avatarUrl: null };
  return { id: null, name: null, avatarUrl: null };
}

// Hydrate user if missing name/avatar
async function hydrateUserOn(item) {
  const ref = extractUserRef(item);
  if (!ref.id) return item;
  if ((item.author && (item.author.name || item.author.username)) ||
      (item.user && (item.user.name || item.user.username))) return item;
  try {
    const u = await api.user(ref.id);
    if (u) {
      return { ...item, author: { id: u.id, name: u.name || u.username, avatarUrl: u.avatarUrl } };
    }
  } catch {}
  return item;
}

/** ---- media normalization ---- */
function asArray(x){
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (typeof x === 'object') return [x];
  return [x];
}

// Convert any media-ish value into the canonical object {url|file|path,type?,name?}
function normalizeMediaList(anyMedia){
  let m = anyMedia;
  // Common alternate shapes:
  // 1) { media: { images:[], videos:[] } }
  if (m && !Array.isArray(m) && typeof m === 'object' && (m.images || m.videos)) {
    m = [...asArray(m.images), ...asArray(m.videos)];
  }
  // 2) array of strings/paths
  if (Array.isArray(m)) {
    return m.map(v => {
      if (!v) return null;
      if (typeof v === 'string') return { url: v };
      if (v.url || v.src || v.path || v.file) return v;
      // unknown object: pass through
      return v;
    }).filter(Boolean);
  }
  // 3) single string
  if (typeof m === 'string') return [{ url: m }];
  return [];
}

/** Normalize a comment/Bit so UI always has consistent fields */
function normalizeComment(c = {}, postId) {
  const id = c.id ?? c._id;
  const content = c.content ?? c.text ?? c.body ?? '';
  const createdAt = c.createdAt ?? c.created ?? c.timestamp ?? Date.now();
  const editedAt = c.editedAt ?? c.updatedAt ?? null;

  // collect media from any likely keys
  const mediaRaw = c.media ?? c.attachments ?? c.files ?? (c.assets || null);
  const media = normalizeMediaList(mediaRaw);

  return { ...c, id, content, createdAt, editedAt, postId: c.postId ?? postId, media };
}

function Avatar({ u, size = 32 }) {
  const dim = { width: size, height: size };
  if (u?.avatarUrl) {
    return (
      <img
        src={u.avatarUrl}
        alt="avatar"
        style={{ ...dim, borderRadius: '50%', objectFit: 'cover', border: BORDER }}
      />
    );
  }
  return (
    <div style={{ ...dim, borderRadius: '50%', display: 'grid', placeItems: 'center', border: BORDER }}>
      👤
    </div>
  );
}

/** ---------- media ---------- */
function MediaPreview({ media = [] }) {
  if (!Array.isArray(media) || media.length === 0) return null;

  const isVideo = (m) => {
    const t = (m.type || m.mime || '').toLowerCase();
    if (t.startsWith('video/')) return true;
    const u = (m.url || m.src || m.path || m.file || '').toLowerCase();
    return /\.(mp4|webm|ogg|mov)$/i.test(u);
  };
  const toUrl = (m) => {
    const raw = m.url || m.src || m.path || m.file || '';
    return raw ? api.assetUrl(raw) : '';
  };

  return (
    <div style={{ display:'grid', gap:8 }}>
      {media.map((m, i) => {
        const url = toUrl(m);
        if (url) {
          return (
            <div key={i}>
              {isVideo(m) ? (
                <video src={url} controls style={{maxWidth:'100%', borderRadius:8, border: BORDER}} />
              ) : (
                <img src={url} alt="attachment" style={{maxWidth:'100%', borderRadius:8, border: BORDER}} />
              )}
            </div>
          );
        }
        // fallback: show a badge so user sees *something* immediately
        return (
          <div key={i} className="muted" style={{fontSize:12, padding:6, border: `1px dashed ${BORDER.split(' ')[2]}`, borderRadius:6}}>
            {m.name || 'attachment pending…'}
          </div>
        );
      })}
    </div>
  );
}

function Composer({ me, onPosted }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const max = 1000;
  const remaining = max - text.length;
  const disabled = busy || (!text.trim() && files.length === 0) || text.length > max;

  return (
    <div className="card" style={{ display:'grid', gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <Link to={`/u/${me?.id}`}>
          <Avatar u={me} size={36} />
        </Link>
        <div style={{fontWeight:600}}>
          {me?.id ? <UserLink id={me.id} /> : (me?.name || me?.email || 'You')}
        </div>
      </div>

      <textarea
        value={text}
        onChange={e=>setText(e.target.value)}
        placeholder="Share a byte…"
        rows={3}
        style={{resize:'vertical'}}
      />

      {files.length > 0 && (
        <div className="card" style={{ background:'var(--card)', border:`1px dashed ${BORDER.split(' ')[2]}`, padding:8 }}>
          <div style={{fontSize:12, marginBottom:6}}>{files.length} attachment(s)</div>
          <div style={{ display:'grid', gap:8 }}>
            {[...files].map((f, i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:8}}>
                <div className="muted" style={{fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis'}}>{f.name} ({Math.ceil(f.size/1024)} KB)</div>
                <button className="ghost" onClick={() => setFiles(prev => [...prev].filter((_,idx)=> idx!==i))}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <label className="btn ghost" style={{cursor:'pointer'}}>
          Attach
          <input type="file" multiple accept="image/*,video/*" style={{display:'none'}} onChange={(e)=> setFiles(Array.from(e.target.files||[]))}/>
        </label>
        <div className="muted" style={{fontSize:12}}>
          {remaining >= 0 ? `${remaining} characters left` : `${-remaining} over limit`}
        </div>
        <div style={{flex:1}} />
        <button
          onClick={async ()=>{
            if (disabled) return;
            setBusy(true);
            try{
              const media = [];
              for (const f of files) {
                const r = await api.uploadMedia(f);
                media.push(r);
              }
              const posted = await api.createStatus(text.trim(), media);
              // ensure media exists on the item we insert
              const item = { ...posted };
              const returnedMedia = normalizeMediaList(item.media ?? item.attachments ?? item.files);
              item.media = returnedMedia.length ? returnedMedia : normalizeMediaList(media);
              const hydrated = await hydrateUserOn(item);
              setText('');
              setFiles([]);
              onPosted?.(hydrated);
            }catch(e){
              alert(e?.message || 'Failed to post');
            }finally{
              setBusy(false);
            }
          }}
          disabled={disabled}
          className="primary"
        >
          {busy ? 'Posting…' : 'Post Byte'}
        </button>
      </div>
    </div>
  );
}


async function likeComment(postId, commentId){ try{ await api.commentLike(postId, commentId);}catch{} }
async function unlikeComment(postId, commentId){ try{ await api.commentUnlike(postId, commentId);}catch{} }

function renderCommentMedia(item){
  const media = normalizeMediaList(item.media);
  if (!Array.isArray(media) || media.length === 0) return null;

  const toUrl = (m) => {
    const raw = m.url || m.src || m.path || m.file || '';
    return raw ? api.assetUrl(raw) : '';
  };
  const isVideo = (m) => {
    const t = (m.type || m.mime || '').toLowerCase();
    if (t.startsWith('video/')) return true;
    const u = (m.url || m.src || m.path || '').toLowerCase();
    return /\.(mp4|webm|ogg|mov)$/i.test(u);
  };

  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
      {media.map((m,idx)=>{
        const url = toUrl(m);
        if (!url) return (
          <span key={idx} className="muted" style={{fontSize:12, border:`1px dashed ${BORDER.split(' ')[2]}`, padding:'4px 6px', borderRadius:6}}>
            {m.name || 'attachment pending…'}
          </span>
        );
        if (isVideo(m)) {
          return <video key={idx} src={url} controls style={{ maxWidth:220, borderRadius:8, border: BORDER }} />;
        }
        if (/\.(png|jpg|jpeg|gif|webp|avif|svg)$/i.test(url)) {
          return <img key={idx} src={url} alt="" style={{ maxWidth:220, borderRadius:8, border: BORDER }} />;
        }
        return <a key={idx} href={url} target="_blank" rel="noreferrer">{m.name || 'attachment'}</a>;
      })}
    </div>
  );
}

function CommentRow({ item, me, onEdit, onDelete, onReport, onToggleLike }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.content || '');
  const [userRef, setUserRef] = useState(extractUserRef(item));
  const isOwner = me && userRef.id === me.id;

  useEffect(() => {
    (async () => {
      if (!userRef.name) {
        const withUser = await hydrateUserOn(item);
        setUserRef(extractUserRef(withUser));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.author?.id, item?.authorId, item?.userId]);

  return (
    <div>
      <div style={{display:'flex', gap:10, alignItems:'center'}}>
        <Link to={userRef.id ? `/u/${userRef.id}` : '#'}>
          <Avatar u={{ avatarUrl: userRef.avatarUrl }} size={24} />
        </Link>
        <div style={{flex:1}}>
          <div style={{fontSize:13, fontWeight:600}}>
            {userRef.id ? <UserLink id={userRef.id} /> : '(user)'}
          </div>
          <div className="muted" style={{fontSize:11}}>{timeAgo(item.createdAt)} ago {item.editedAt ? ' • edited' : ''}</div>
        </div>
        <div style={{display:'flex', gap:8}}>
          {isOwner && !editing && <button className="ghost" onClick={() => setEditing(true)}>Edit</button>}
          {isOwner && <button className="ghost destructive" onClick={() => onDelete(item.id)}>Delete</button>}
          {!isOwner && <button className="ghost" onClick={onReport}>Report</button>}
          {!isOwner && (me && (me.role==='admin' || me.role==='moderator')) && <button className="ghost destructive" onClick={() => onDelete(item.id)}>Remove</button>}
        </div>
      </div>
      {editing ? (
        <div style={{display:'flex', gap:8, marginTop:6}}>
          <input value={text} onChange={e=>setText(e.target.value)} />
          <button className="primary" onClick={() => { onEdit(item.id, text.trim()); setEditing(false); }}>Save</button>
          <button className="ghost" onClick={() => { setEditing(false); setText(item.content||''); }}>Cancel</button>
        </div>
      ) : (
        <div style={{ marginLeft:34, whiteSpace:'pre-wrap' }}>{item.content}
          {renderCommentMedia(item)}
          <div className='muted' style={{fontSize:12, marginTop:4}}>
            <button className='ghost' onClick={() => (onToggleLike ? onToggleLike(item.postId, item) : (item.iLike ? unlikeComment(item.postId, item.id) : likeComment(item.postId, item.id)))}>{item.iLike ? 'Unlike' : 'Like'}</button>
            <span style={{ marginLeft:6 }}>{item.likeCount || 0} likes</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedItem({ item, me, onChange, onRemove }) {
  const [likeBusy, setLikeBusy] = useState(false);
  const [likes, setLikes] = useState(item.likes || 0);
  const [iLike, setILike] = useState(item.iLike || false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.content || '');
  const [comments, setComments] = useState([]);
  const [authorRef, setAuthorRef] = useState(extractUserRef(item));

  // ensure author info for the BYTE
  useEffect(() => {
    (async () => {
      if (!authorRef.name) {
        const hydrated = await hydrateUserOn(item);
        setAuthorRef(extractUserRef(hydrated));
        onChange?.({ ...item, ...hydrated });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.author?.id, item?.authorId, item?.userId]);

  // Optimistic like/unlike for Bit comments
  const onToggleCommentLike = async (postId, comment) => {
    setComments(prev =>
      prev.map(x => x.id === comment.id
        ? { ...x, iLike: !comment.iLike, likeCount: (x.likeCount || 0) + (comment.iLike ? -1 : 1) }
        : x
      )
    );
    try {
      if (comment.iLike) await api.commentUnlike(postId, comment.id);
      else await api.commentLike(postId, comment.id);
    } catch (e) {
      setComments(prev =>
        prev.map(x => x.id === comment.id
          ? { ...x, iLike: comment.iLike, likeCount: comment.likeCount || 0 }
          : x
        )
      );
      console.error(e);
    }
  };

  const [cText, setCText] = useState('');
  const [cBusy, setCBusy] = useState(false);
  const [cFiles, setCFiles] = useState([]);

  useEffect(()=>{
    (async()=>{
      try{
        const list = await api.comments(item.id);
        const normalized = (list || []).map(x => normalizeComment(x, item.id));
        const hydrated = await Promise.all(normalized.map(hydrateUserOn));
        setComments(hydrated);
      }catch{}
    })();
  }, [item.id]);

  const isOwner = me && authorRef.id === me.id;

  async function toggleLike(){
    if (likeBusy) return;
    setLikeBusy(true);
    try{
      if (iLike) {
        await api.unlikeStatus(item.id);
        setILike(false); setLikes(x => Math.max(0, x-1));
      } else {
        await api.likeStatus(item.id);
        setILike(true); setLikes(x => x+1);
      }
    }catch(e){
      alert(e?.message || 'Failed to update like');
    }finally{ setLikeBusy(false); }
  }

  async function saveEdit(){
    try {
      const up = await api.editStatus(item.id, text.trim());
      onChange?.({ ...item, ...up, content: up.content });
      setEditing(false);
    } catch(e) {
      alert(e?.message || 'Failed to save');
    }
  }

  async function deletePost(){ if (!confirm('Delete this post?')) return;
    try { await api.deleteStatus(item.id); onRemove?.(item.id); }
    catch(e){ alert(e?.message || 'Failed to delete'); }
  }

  async function addComment(){
    if (!cText.trim() && cFiles.length===0) return;
    setCBusy(true);
    try {
      const uploaded = [];
      for (const f of cFiles) {
        const r = await api.uploadMedia(f);
        uploaded.push(r);
      }
      // Try the most specific API first; fall back if not present
      let c;
      if (api.createCommentWithMedia) {
        c = await api.createCommentWithMedia(item.id, { content: cText.trim(), media: uploaded });
      } else if (api.createComment) {
        c = await api.createComment(item.id, cText.trim(), uploaded);
      } else {
        // final fallback: a generic endpoint
        c = await api.post(`/posts/${item.id}/comments`, { content: cText.trim(), media: uploaded });
      }
      // Normalize & ensure media set (fallback to uploaded if server omitted it)
      let normalized = normalizeComment(c, item.id);
      if (!normalized.media || normalized.media.length === 0) {
        normalized = { ...normalized, media: normalizeMediaList(uploaded) };
      }
      const hydrated = await hydrateUserOn(normalized);
      setComments(prev => [...prev, hydrated]);
      setCText(''); setCFiles([]);
    } catch(e) {
      alert(e?.message || 'Failed to comment');
    } finally { setCBusy(false); }
  }

  async function editComment(cid, content){
    try {
      const c = await api.editComment(item.id, cid, content);
      const normalized = normalizeComment(c, item.id);
      const hydrated = await hydrateUserOn(normalized);
      setComments(prev => prev.map(x => x.id === cid ? hydrated : x));
    } catch(e) { alert(e?.message || 'Failed to edit'); }
  }

  async function deleteComment(cid){
    if (!confirm('Delete this comment?')) return;
    try {
      await api.deleteComment(item.id, cid);
      setComments(prev => prev.filter(x => x.id !== cid));
    } catch(e) { alert(e?.message || 'Failed to delete'); }
  }

  async function reportPost(){
    const reason = prompt('Reason for report? (optional)') || '';
    try { await api.reportPost(item.id, reason); alert('Reported'); } catch(e) { alert(e?.message || 'Failed to report'); }
  }
  async function reportComment(cid){
    const reason = prompt('Reason for report? (optional)') || '';
    try { await api.reportComment(item.id, cid, reason); alert('Reported'); } catch(e) { alert(e?.message || 'Failed to report'); }
  }

  return (
    <div className="card" style={{display:'grid',gap:8}}>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <Link to={authorRef.id ? `/u/${authorRef.id}` : '#'}>
          <Avatar u={{ avatarUrl: authorRef.avatarUrl }} size={32} />
        </Link>
        <div style={{flex:1}}>
          <div style={{fontWeight:600}}>
            {authorRef.id ? <UserLink id={authorRef.id} /> : '(user)'}
            <Link className="ghost" style={{marginLeft:8}} to={`/post/${item.id}`}>Open</Link>
          </div>
          <div className="muted" style={{fontSize:12}}>{timeAgo(item.createdAt)} ago {item.editedAt ? ' • edited' : ''}</div>
        </div>

        <div style={{display:'flex',gap:8}}>
          {isOwner && !editing && <button className="ghost" onClick={() => setEditing(true)}>Edit</button>}
          {isOwner && <button className="ghost destructive" onClick={deletePost}>Delete</button>}
          {!isOwner && <button className="ghost" onClick={reportPost}>Report</button>}
          {!isOwner && (me && (me.role==='admin' || me.role==='moderator')) && <button className="ghost destructive" onClick={deletePost}>Remove</button>}
        </div>
      </div>

      {editing ? (
        <div style={{display:'grid',gap:8}}>
          <textarea value={text} onChange={e=>setText(e.target.value)} rows={3} />
          <div>
            <button className="primary" onClick={saveEdit}>Save</button>
            <button className="ghost" style={{marginLeft:8}} onClick={() => { setEditing(false); setText(item.content||''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{whiteSpace:'pre-wrap'}}>{item.content}</div>
      )}

      <MediaPreview media={normalizeMediaList(item.media ?? item.attachments ?? item.files)} />

      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <button className={`like-btn ${iLike ? 'liked' : ''}`} onClick={toggleLike} disabled={likeBusy}>
          <span className="heart" aria-hidden>❤</span>
          <span>{iLike ? 'Liked' : 'Like'}</span>
          <span className="count">({likes})</span>
        </button>
      </div>

      <div style={{borderTop: BORDER, paddingTop:8}}>
        <div style={{display:'grid', gap:8}}>
          {comments.map(c => (
            <CommentRow onToggleLike={onToggleCommentLike} key={c.id} item={c} me={me} onEdit={editComment} onDelete={deleteComment} onReport={() => reportComment(c.id)} />
          ))}
        </div>

        <div style={{display:'grid', gap:6, marginTop:8}}>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <input
              value={cText}
              onChange={e=>setCText(e.target.value)}
              placeholder="Write a Bit…"
              onKeyDown={e=>{ if (e.key==='Enter') { e.preventDefault(); addComment(); } }}
              style={{flex:1}}
            />
            <label className="btn ghost" style={{cursor:'pointer', whiteSpace:'nowrap'}}>
              Attach
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                style={{display:'none'}}
                onChange={e=>setCFiles(Array.from(e.target.files||[]))}
              />
            </label>
            <button onClick={addComment} disabled={cBusy || (!cText.trim() && cFiles.length===0)}>
              {cBusy ? 'Posting…' : 'Add Bit'}
            </button>
          </div>

          {cFiles.length > 0 && (
            <div className="card" style={{ background:'var(--card)', border:`1px dashed ${BORDER.split(' ')[2]}`, padding:8 }}>
              <div style={{fontSize:12, marginBottom:6}}>{cFiles.length} attachment(s)</div>
              <div style={{ display:'grid', gap:8 }}>
                {cFiles.map((f, i) => (
                  <div key={i} style={{display:'flex', alignItems:'center', gap:8}}>
                    <div className="muted" style={{fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis'}}>
                      {f.name} ({Math.ceil(f.size/1024)} KB)
                    </div>
                    <button className="ghost" onClick={() => setCFiles(prev => prev.filter((_,idx)=> idx!==i))}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard(){
  const [me, setMe] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(()=>{ (async()=>{ try { setMe(await api.me()); } catch {} })() },[]);

  useEffect(()=>{ (async()=>{
    try{
      setLoading(true);
      const res = await api.feed(page);
      let items = (res.items || []).map(x => {
        const m = normalizeMediaList(x.media ?? x.attachments ?? x.files);
        return { ...x, likes: x.likes ?? x.likeCount ?? 0, iLike: x.iLike ?? false, media: m };
      });
      items = await Promise.all(items.map(hydrateUserOn));
      if (page === 1) setFeed(items);
      else setFeed(prev => [...prev, ...items]);
      setHasMore(!!res?.hasMore);
    }catch(e){ console.warn(e); } finally { setLoading(false); }
  })() }, [page]);

  function onPostInserted(item){ setFeed(prev => [item, ...prev]); }
  function onPostChange(updated){ setFeed(prev => prev.map(x => x.id === updated.id ? updated : x)); }
  function onPostRemove(id){ setFeed(prev => prev.filter(x => x.id !== id)); }

  return (
    <div>
      <h2>Bytes and Bits</h2>
      {me && <Composer me={me} onPosted={onPostInserted} />}
      <div style={{marginTop:12, display:'grid', gap:10}}>
        {feed.map(item => (
          <FeedItem key={item.id} item={item} me={me} onChange={onPostChange} onRemove={onPostRemove} />
        ))}
        {loading && <div className="card">Loading…</div>}
        {!loading && feed.length === 0 && <div className="card">Your feed is empty. Follow people or add friends to see their posts.</div>}
        {!loading && hasMore && (
          <button onClick={() => setPage(p => p + 1)}>Load more</button>
        )}
      </div>
    </div>
  );
}
