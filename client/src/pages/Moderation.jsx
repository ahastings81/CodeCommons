import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Moderation() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  // Include feedPosts and feedComments in reports state
  const [reports, setReports] = useState({
    threads: [],
    posts: [],
    jobs: [],
    feedPosts: [],
    feedComments: [],
  });

  const [qUsers, setQUsers] = useState('');
  const { show } = useToast();

  const loadAll = async () => {
    try {
      const m = await api.me();
      setMe(m || null);
      if (!m) return;
      const [u, r] = await Promise.all([api.adminUsers(), api.adminReports()]);
      setUsers(Array.isArray(u) ? u : []);
      setReports({
        threads: Array.isArray(r?.threads) ? r.threads : [],
        posts: Array.isArray(r?.posts) ? r.posts : [],
        jobs: Array.isArray(r?.jobs) ? r.jobs : [],
        feedPosts: Array.isArray(r?.feedPosts) ? r.feedPosts : [],
        feedComments: Array.isArray(r?.feedComments) ? r.feedComments : [],
      });
    } catch (e) {
      show('Moderator access required or error: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // Allow refreshing reports after Remove
  const reloadReports = async () => {
    try {
      const r = await api.adminReports();
      setReports({
        threads: Array.isArray(r?.threads) ? r.threads : [],
        posts: Array.isArray(r?.posts) ? r.posts : [],
        jobs: Array.isArray(r?.jobs) ? r.jobs : [],
        feedPosts: Array.isArray(r?.feedPosts) ? r.feedPosts : [],
        feedComments: Array.isArray(r?.feedComments) ? r.feedComments : [],
      });
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => { loadAll(); }, []);

  const setBan = async (id, banned) => {
    try {
      await api.adminUpdateUser(id, { banned });
      setUsers(users.map(u => (u.id === id ? { ...u, banned } : u)));
      show(banned ? 'User banned' : 'User unbanned');
    } catch (e) {
      show('Failed to update ban state');
    }
  };

  const filteredUsers = useMemo(() => {
    const q = (qUsers || '').toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, qUsers]);

  if (loading) return <div className="card">Loading…</div>;

  if (!me) return (
    <div>
      <h2>Moderation</h2>
      <div className="card">Please sign in.</div>
    </div>
  );

  if (!(me.role === 'moderator' || me.role === 'admin')) {
    return (
      <div>
        <h2>Moderation</h2>
        <div className="card">You don’t have permission to view this page.</div>
      </div>
    );
  }

  return (
    <div>
      <h2>Moderation</h2>

      <section className="card">
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>Users</h3>
          <span className="spacer" />
          <div className="search">
            <input
              value={qUsers}
              onChange={e => setQUsers(e.target.value)}
              placeholder="Search users…"
            />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.banned ? 'BANNED' : 'Active'}</td>
                  <td>
                    {!u.banned ? (
                      <button onClick={() => setBan(u.id, true)}>Ban</button>
                    ) : (
                      <button onClick={() => setBan(u.id, false)}>Unban</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Reports</h3>

        {/* --- Reported Feed Posts (NEW) --- */}
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ margin: 0 }}>Reported Feed Posts</h3>
          <table className="table">
            <thead>
              <tr><th>When</th><th>Author</th><th>Excerpt</th><th>Reports</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {(reports.feedPosts || []).map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.createdAt).toLocaleString()}</td>
                  <td>{p.userName || p.userEmail || p.userId}</td>
                  <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.content}</td>
                  <td>{p.reports || 0}</td>
                  <td>
                    <a className="btn ghost" href={`/post/${p.id}`} target="_blank" rel="noreferrer">Open</a>
                    <button
                      className="btn destructive"
                      style={{ marginLeft: 8 }}
                      onClick={async () => {
                        if (!confirm('Remove this post?')) return;
                        await api.adminDeleteFeedPost(p.id);
                        await reloadReports();
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {(reports.feedPosts || []).length === 0 && (
                <tr><td colSpan={5} className="muted">None</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* --- Reported Feed Comments (NEW) --- */}
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ margin: 0 }}>Reported Feed Comments</h3>
          <table className="table">
            <thead>
              <tr><th>When</th><th>Author</th><th>Excerpt</th><th>Reports</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {(reports.feedComments || []).map(c => (
                <tr key={c.id}>
                  <td>{new Date(c.createdAt).toLocaleString()}</td>
                  <td>{c.userName || c.userEmail || c.userId}</td>
                  <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.content}</td>
                  <td>{c.reports || 0}</td>
                  <td>
                    <a className="btn ghost" href={`/post/${c.postId}#comment-${c.id}`} target="_blank" rel="noreferrer">Open</a>
                    <button
                      className="btn destructive"
                      style={{ marginLeft: 8 }}
                      onClick={async () => {
                        if (!confirm('Remove this comment?')) return;
                        await api.adminDeleteFeedComment(c.id);
                        await reloadReports();
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {(reports.feedComments || []).length === 0 && (
                <tr><td colSpan={5} className="muted">None</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Classic (existing) reports */}
        <div className="grid cols-3" style={{ marginTop: 12 }}>
          <div>
            <strong>Threads <span className="badge">{reports.threads.length}</span></strong>
            {!reports.threads.length && <div>None</div>}
            {reports.threads.map(t => (
              <div key={t.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 6 }}>
                <div>
                  <Link to={`/community?category=${encodeURIComponent(t.categoryId)}&thread=${encodeURIComponent(t.id)}`}>
                    {t.title}
                  </Link>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Reports: {t.reports} • By: {t.userName}{t.userEmail ? ` (${t.userEmail})` : ''} • {new Date(t.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div>
            <strong>Posts <span className="badge">{reports.posts.length}</span></strong>
            {!reports.posts.length && <div>None</div>}
            {reports.posts.map(p => (
              <div key={p.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 6 }}>
                <div>
                  <Link to={`/community?category=${encodeURIComponent(p.categoryId)}&thread=${encodeURIComponent(p.threadId)}&post=${encodeURIComponent(p.id)}`}>
                    View post in thread {p.threadId}
                  </Link>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Reports: {p.reports} • By: {p.userName}{p.userEmail ? ` (${p.userEmail})` : ''} • {new Date(p.createdAt).toLocaleString()}
                </div>
                <div style={{ marginTop: 4 }}>{p.content}</div>
              </div>
            ))}
          </div>

          <div>
            <strong>Jobs <span className="badge">{reports.jobs.length}</span></strong>
            {!reports.jobs.length && <div>None</div>}
            {reports.jobs.map(j => (
              <div key={j.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 6 }}>
                <div>
                  <Link to={`/jobs?id=${encodeURIComponent(j.id)}`}>
                    {j.title} — {j.company}
                  </Link>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Reports: {j.reports} • By: {j.userName || 'Unknown'}{j.userEmail ? ` (${j.userEmail})` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
