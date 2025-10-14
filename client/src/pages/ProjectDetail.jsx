
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { io } from 'socket.io-client';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';

const socket = io('http://localhost:4000', { autoConnect: true });

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [me, setMe] = useState(null);
  const { show } = useToast();

  useEffect(()=>{
    (async()=>{
      setMe(await api.me());
      setProject(await api.getProject(id));
    })();
    socket.emit('joinProject', { projectId: id });
    return ()=>{ socket.emit('leaveProject', { projectId: id }); }
  }, [id]);

  useEffect(()=>{
    const onMsg = (msg)=>{ if (msg.projectId === id) setProject(prev => ({ ...prev, chatHistory: [...(prev?.chatHistory||[]), { id: msg.id, userId: msg.userId, content: msg.content, createdAt: msg.createdAt }] })); };
    const onDel = ({ messageId }) => setProject(prev => ({ ...prev, chatHistory: (prev?.chatHistory||[]).filter(m => m.id !== messageId) }));
    socket.on('projectMessage', onMsg); socket.on('deleteProjectMessage', onDel);
    return ()=> { socket.off('projectMessage', onMsg); socket.off('deleteProjectMessage', onDel); };
  }, [id]);

  if (!project) return <div>Loading...</div>;

  return (
    <div>
      <Link to="/projects">← Back</Link>
      <h2>{project.title}</h2>
      <p>{project.description}</p>
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:16}}>
        <Kanban project={project} setProject={setProject}/>
        <Chat project={project} me={me} onDelete={()=>show('Message deleted')}/>
      </div>
    </div>
  )
}

function Kanban({ project, setProject }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const columns = ['todo','doing','done'];
  const groups = useMemo(()=>{
    const g = { todo: [], doing: [], done: [] };
    (project.tasks||[]).forEach(t => { g[t.status||'todo'].push(t); });
    return g;
  }, [project.tasks]);

  const addTask = async () => {
    if (!title) return;
    const t = await api.addTask(project.id, { title, description: desc });
    setProject(prev => ({...prev, tasks: [...prev.tasks, t]}));
    setTitle(''); setDesc('');
  };

  const setStatus = async (task, status) => {
    const u = await api.updateTask(project.id, task.id, { status });
    setProject(prev => ({...prev, tasks: prev.tasks.map(t => t.id===task.id?u:t)}));
  };

  return (
    <div>
      <h3>Kanban</h3>
      <div className="kbCols">
        {columns.map(col => (
          <div key={col} className="kbCol">
            <strong style={{textTransform:'capitalize'}}>{col}</strong>
            {(groups[col]||[]).map(t => (
              <div key={t.id} className="kbItem">
                <div>{t.title}</div>
                <div style={{fontSize:12, color:'var(--muted)'}}>{t.description}</div>
                <div style={{display:'flex', gap:4, marginTop:4}}>
                  {col!=='todo' && <button onClick={()=>setStatus(t,'todo')}>ToDo</button>}
                  {col!=='doing' && <button onClick={()=>setStatus(t,'doing')}>Doing</button>}
                  {col!=='done' && <button onClick={()=>setStatus(t,'done')}>Done</button>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{marginTop:8}}>
        <input placeholder="Task title" value={title} onChange={e=>setTitle(e.target.value)} />
        <input placeholder="Description" value={desc} onChange={e=>setDesc(e.target.value)} />
        <button onClick={addTask}>Add</button>
      </div>
    </div>
  )
}

function Chat({ project, me, onDelete }) {
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim()) return;
    socket.emit('projectMessage', { projectId: project.id, message: { userId: me.id, content: text } });
    setText('');
  };
  const del = (messageId) => {
    socket.emit('deleteProjectMessage', { projectId: project.id, messageId, userId: me.id });
    onDelete?.(messageId);
  };
  return (
    <div>
      <h3>Chat</h3>
      <div style={{height:300, overflow:'auto'}} className="card">
        {(project.chatHistory||[]).map(m => (
          <div key={m.id} style={{marginBottom:6, display:'flex', gap:8, alignItems:'center'}}>
            <div style={{flex:1}}><strong>{m.userId===me.id ? 'You' : m.userId}</strong>: {m.content}</div>
            {m.userId===me?.id && <button onClick={()=>del(m.id)} title="Delete">✕</button>}
          </div>
        ))}
      </div>
      <div style={{display:'flex', gap:6, marginTop:6}}>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Send a message..." onKeyDown={e=>{ if (e.key==='Enter') send(); }}/>
        <button onClick={send}>Send</button>
      </div>
    </div>
  )
}
