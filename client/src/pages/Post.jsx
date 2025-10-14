
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { api } from '../services/api.js';

function timeAgo(ts){
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts||Date.now());
  const s = Math.floor((Date.now() - d.getTime())/1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s/60); if(m<60) return `${m}m`;
  const h = Math.floor(m/60); if(h<24) return `${h}h`;
  const dd = Math.floor(h/24); return `${dd}d`;
}

function Media({ media=[] }){
  if (!Array.isArray(media) || media.length===0) return null;
  return (
    <div style={{display:'grid', gap:8, marginTop:8}}>
      {media.map((m,i)=>(
        <div key={i}>
          {m.type === 'video'
            ? <video src={api.assetUrl(m.url || m.src)} controls style={{maxWidth:'100%', border:'1px solid var(--border)', borderRadius:8}}/>
            : <img src={api.assetUrl(m.url || m.src)} alt="attachment" style={{maxWidth:'100%', border:'1px solid var(--border)', borderRadius:8}}/>}
        </div>
      ))}
    </div>
  );
}

export default function Post(){
  const { postId } = useParams();
  const { hash } = useLocation();
  const highlightCommentId = useMemo(()=> (hash||'').replace('#comment-',''), [hash]);

  const [me, setMe] = useState(null);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [cText, setCText] = useState('');
  const [busy, setBusy] = useState({ like:false, add:false });

  useEffect(()=>{ (async()=>{ try{ setMe(await api.me()); }catch{} })() },[]);
  useEffect(()=>{ load(); }, [postId]);

  async function load(){
    try{
      const p = await api.getPost(postId);
      const cs = await api.comments(postId);
      setPost(p);
      setComments(cs||[]);
      if (highlightCommentId){
        setTimeout(()=>{
          const el = document.getElementById('comment-'+highlightCommentId);
          if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
          el?.classList.add('highlight'); setTimeout(()=> el?.classList.remove('highlight'), 1200);
        }, 100);
      }
    }catch(e){
      setPost(null);
      alert(e?.message || 'Not found');
    }
  }

  if (!post) return <div className="container"><div className="card">Loading…</div></div>;

  async function toggleLike(){
    if (busy.like) return; setBusy(b=>({...b,like:true}));
    try{
      if (post.iLike){ await api.unlikeStatus(post.id); setPost(p=>({...p, iLike:false, likeCount:Math.max(0,(p.likeCount||0)-1)})); }
      else { await api.likeStatus(post.id); setPost(p=>({...p, iLike:true, likeCount:(p.likeCount||0)+1})); }
    }catch(e){ alert(e?.message || 'Failed'); } finally { setBusy(b=>({...b,like:false})); }
  }

  async function addComment(){
    const t=(cText||'').trim(); if(!t || busy.add) return;
    setBusy(b=>({...b,add:true}));
    try{
      const c= await api.addComment(post.id, t);
      setComments(prev=>[...prev, c]); setCText('');
    }catch(e){ alert(e?.message || 'Failed'); } finally { setBusy(b=>({...b,add:false})); }
  }

  return (
    <div className="container">
      <div id={'post-'+post.id} className="card" style={{display:'grid', gap:8}}>
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          {post.author?.avatarUrl
            ? <img src={post.author.avatarUrl} alt="avatar" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',border:'1px solid var(--border)'}}/>
            : <div style={{width:32,height:32,borderRadius:'50%',display:'grid',placeItems:'center',border:'1px solid var(--border)'}}>👤</div>}
          <div style={{flex:1}}>
            <div style={{fontWeight:600}}>{post.author?.name || post.author?.email || 'User'}</div>
            <div className="muted" style={{fontSize:12}}>{timeAgo(post.createdAt)} ago {post.editedAt ? ' • edited' : ''}</div>
          </div>
          <div>
            <button onClick={toggleLike} disabled={busy.like}>{post.iLike ? 'Unlike' : 'Like'} ({post.likeCount||0})</button>
          </div>
        </div>
        <div style={{whiteSpace:'pre-wrap'}}>{post.content}</div>
        <Media media={post.media} />
      </div>

      <div className="card" style={{marginTop:12}}>
        <h3 style={{marginTop:0}}>Bits</h3>
        <div style={{display:'grid', gap:10}}>
          {comments.map(c => (
            <div id={'comment-'+c.id} key={c.id}>
              <div style={{display:'flex', gap:10, alignItems:'center'}}>
                {c.author?.avatarUrl
                  ? <img src={c.author.avatarUrl} alt="avatar" style={{width:24,height:24,borderRadius:'50%',objectFit:'cover',border:'1px solid var(--border)'}}/>
                  : <div style={{width:24,height:24,borderRadius:'50%',display:'grid',placeItems:'center',border:'1px solid var(--border)'}}>👤</div>}
                <div style={{flex:1}}>
                  <div style={{fontSize:13, fontWeight:600}}>{c.author?.name || c.author?.email || 'User'}</div>
                  <div className="muted" style={{fontSize:11}}>{timeAgo(c.createdAt)} ago {c.editedAt ? ' • edited' : ''}</div>
                </div>
              </div>
              <div style={{ marginLeft:34, whiteSpace:'pre-wrap' }}>{c.content}</div>
            </div>
          ))}
          {comments.length===0 && <div className="muted">No comments yet.</div>}
        </div>

        <div style={{display:'flex', gap:8, marginTop:10}}>
          <input value={cText} onChange={e=>setCText(e.target.value)} placeholder="Write a comment…"
                 onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addComment(); }}} />
          <button onClick={addComment} disabled={busy.add || !cText.trim()}>{busy.add ? 'Posting…' : 'Comment'}</button>
        </div>
      </div>
    </div>
  );
}
