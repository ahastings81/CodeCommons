import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_BASE } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Admin() {
  const [me, setMe] = useState(null);
  useEffect(()=>{ (async()=>{ try{ setMe(await api.me()); }catch{} })(); },[]);
  const { show } = useToast?.() ?? { show: () => {} };

  const [active, setActive] = useState('users');

  // Users
  const [users, setUsers] = useState([]);
  const [qUsers, setQUsers] = useState('');
  const [hackathons, setHackathons] = useState([]);
  const [hName, setHName] = useState('');
  const [hStart, setHStart] = useState('');
  const [hEnd, setHEnd] = useState('');
  const [hDesc, setHDesc] = useState('');

  // Metrics (business totals)
  const [metrics, setMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState('');
  useEffect(()=>{
    if(active !== 'metrics') return;
    (async()=>{ try{ const m = await api.metrics(); setMetrics(m); setMetricsError(''); } catch(e){ setMetrics(null); setMetricsError(e?.message || 'Failed to load metrics'); } })();
  }, [active]);

  // Reports (includes feed posts/comments)
  const [reports, setReports] = useState({
    threads: [],
    posts: [],
    jobs: [],
    feedPosts: [],
    feedComments: [],
  });
  const [qReports, setQReports] = useState('');

  // Projects / Jobs
  const [projects, setProjects] = useState([]);
  const [jobs, setJobs] = useState([]);

  // Per-ad metrics state (correct tab)
  const [adRows, setAdRows] = useState([]);
  const [adAdvertiser, setAdAdvertiser] = useState('');
  const [adStart, setAdStart] = useState('');
  const [adEnd, setAdEnd] = useState('');
  const [adLoading, setAdLoading] = useState(false);
  const [adError, setAdError] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [u, r, p, j, h] = await Promise.all([
        api.adminUsers?.(),
        api.adminReports?.(),
        api.projects?.({}),
        api.jobs?.(''),
        api.hackathons?.(),
      ]);
      setUsers(Array.isArray(u) ? u : []);
      setHackathons(Array.isArray(h) ? h : []);
      setReports({
        threads: Array.isArray(r?.threads) ? r.threads : [],
        posts: Array.isArray(r?.posts) ? r.posts : [],
        jobs: Array.isArray(r?.jobs) ? r.jobs : [],
        feedPosts: Array.isArray(r?.feedPosts) ? r.feedPosts : [],
        feedComments: Array.isArray(r?.feedComments) ? r.feedComments : [],
      });
      setProjects(Array.isArray(p) ? p : []);
      setJobs(Array.isArray(j) ? j : []);
    } catch (e) {
      console.warn(e);
      alert('Requires admin privileges or failed to load.');
    }
  }

  async function reloadReports() {
    try {
      const r = await api.adminReports();
      setReports({
        threads: Array.isArray(r?.threads) ? r.threads : [],
        posts: Array.isArray(r?.posts) ? r.posts : [],
        jobs: Array.isArray(r?.jobs) ? r.jobs : [],
        feedPosts: Array.isArray(r?.feedPosts) ? r.feedPosts : [],
        feedComments: Array.isArray(r?.feedComments) ? r.feedComments : [],
      });
    } catch {}
  }

  // User actions
  const setRole = async (id, role) => {
    await api.adminUpdateUser(id, { role });
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
    show('Role updated');
  };
  const setTier = async (id, tier) => {
    await api.adminUpdateUser(id, { tier });
    setUsers(prev => prev.map(u => u.id === id ? { ...u, tier } : u));
    show('Tier updated');
  };
  const setBan = async (id, banned) => {
    await api.adminUpdateUser(id, { banned });
    setUsers(prev => prev.map(u => u.id === id ? { ...u, banned } : u));
    show(banned ? 'User banned' : 'User unbanned');
  };
  const setRecruiter = async (id, isRecruiterVerified) => {
    await api.adminUpdateUser(id, { isRecruiterVerified });
    setUsers(prev => prev.map(u => u.id === id ? { ...u, isRecruiterVerified } : u));
    show('Recruiter verification updated');
  };

  // Project / Job actions
  const featureProject = async (id, on) => {
    await api.adminFeatureProject(id, on);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, featured: on } : p));
    show(on ? 'Project featured' : 'Project unfeatured');
  };
  const delProject = async (id) => {
    await api.adminDeleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    show('Project deleted');
  };
  const featureJob = async (id, on) => {
    await api.adminFeatureJob(id, on);
    setJobs(prev => prev.map(j => j.id === id ? { ...j, featured: on } : j));
    show(on ? 'Job featured' : 'Job unfeatured');
  };
  const delJob = async (id) => {
    await api.adminDeleteJob(id);
    setJobs(prev => prev.filter(j => j.id !== id));
    show('Job deleted');
  };
  const delThread = async (id) => {
    await api.adminDeleteThread(id);
    setReports(prev => ({ ...prev, threads: prev.threads.filter(t => t.id !== id) }));
    show('Thread deleted');
  };

  // Filters
  const filteredUsers = useMemo(() => {
    const q = (qUsers || '').toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.tier || '').toLowerCase().includes(q)
    );
  }, [users, qUsers]);

  const filteredClassicReports = useMemo(() => {
    const q = (qReports || '').toLowerCase().trim();
    if (!q) return { threads: reports.threads, posts: reports.posts, jobs: reports.jobs };
    const m = (s) => (s || '').toLowerCase().includes(q);
    return {
      threads: reports.threads.filter(t => m(t.title) || m(t.userName) || m(t.userEmail)),
      posts: reports.posts.filter(p => m(p.content) || m(p.userName) || m(p.userEmail)),
      jobs: reports.jobs.filter(j => m(j.title) || m(j.company) || m(j.userName)),
    };
  }, [reports, qReports]);

  // Per-ad metrics loader (correct endpoints under /api/ads)
  async function loadPerAdMetrics(params = {}){
    setAdLoading(true); setAdError('');
    try{
      const q = new URLSearchParams();
      if (params.advertiserId) q.set('advertiserId', params.advertiserId);
      if (params.start) q.set('start', params.start);
      if (params.end) q.set('end', params.end);
      const res = await fetch(`${API_BASE}/api/ads/metrics?` + q.toString(), { credentials: 'include' });
      if(!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      setAdRows(Array.isArray(data.items) ? data.items : []);
    }catch(e){
      setAdError(e?.message || 'Failed to load per-ad metrics');
      setAdRows([]);
    }finally{
      setAdLoading(false);
    }
  }

  useEffect(() => {
    if (
                active === 'metrics') loadPerAdMetrics({});
  }, [active]);

  return (
    <div>
      <h2>Admin Control Panel</h2>

      {/* Tabs + search */}
      <div className="tabs">
        {[...(['users','reports','projects','jobs','hackathons']), ...(me?.role==='admin' ? ['metrics'] : [])].map(key => (
          <button
            key={key}
            className={`tab ${active === key ? 'active' : ''}`}
            onClick={() => setActive(key)}
          >
            {key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
        <span className="spacer" />
        {active === 'users' && (
          <div className="search">
            <input
              value={qUsers}
              onChange={e => setQUsers(e.target.value)}
              placeholder="Search users (name, email, role, tier)…"
            />
          </div>
        )}
        {active === 'reports' && (
          <div className="search">
            <input
              value={qReports}
              onChange={e => setQReports(e.target.value)}
              placeholder="Search classic reports (title, content, user)…"
            />
          </div>
        )}
      </div>

      {/* USERS */}
      {active === 'users' && (
        <section className="card">
          <h3>
            Users <span className="badge">{filteredUsers.length}</span>
          </h3>
          <div
            style={{ overflowX: 'auto', position: 'relative', zIndex: 2 }}
            onClickCapture={(e) => {
              if (e.target && (e.target.tagName === 'SELECT' || e.target.closest?.('select'))) {
                e.stopPropagation();
              }
            }}
          >
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Role</th><th>Tier</th><th>Org</th><th>Recruiter</th><th>Banned</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={e => setRole(u.id, e.target.value)}
                        onMouseDown={(e)=>e.stopPropagation()}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <option value="user">user</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={u.tier || 'free'}
                        onChange={e => setTier(u.id, e.target.value)}
                        onMouseDown={(e)=>e.stopPropagation()}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                      </select>
                    </td>
                    <td>{u.org || '—'}</td>
                    <td><input type="checkbox" checked={!!u.isRecruiterVerified} onChange={e => setRecruiter(u.id, e.target.checked)} /></td>
                    <td><input type="checkbox" checked={!!u.banned} onChange={e => setBan(u.id, e.target.checked)} /></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* REPORTS */}
      {active === 'reports' && (
        <>
          {/* Feed moderation (new) */}
          <div className="card">
            <h3>Reported Feed Posts</h3>
            <table className="table">
              <thead>
                <tr><th>When</th><th>Author</th><th>Excerpt</th><th>Reports</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {(reports.feedPosts || []).map(p => (
                  <tr key={p.id}>
                    <td>{new Date(p.createdAt).toLocaleString()}</td>
                    <td>{p.userName || p.userEmail || p.userId}</td>
                    <td style={{maxWidth:360,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.content}</td>
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

          <div className="card" style={{ marginTop: 12 }}>
            <h3>Reported Feed Comments</h3>
            <table className="table">
              <thead>
                <tr><th>When</th><th>Author</th><th>Excerpt</th><th>Reports</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {(reports.feedComments || []).map(c => (
                  <tr key={c.id}>
                    <td>{new Date(c.createdAt).toLocaleString()}</td>
                    <td>{c.userName || c.userEmail || c.userId}</td>
                    <td style={{maxWidth:360,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.content}</td>
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

          {/* Classic reports */}
          <div className="grid cols-3" style={{ marginTop: 12 }}>
            <div>
              <strong>Threads <span className="badge">{filteredClassicReports.threads.length}</span></strong>
              {!filteredClassicReports.threads.length && <div className="muted">None</div>}
              {filteredClassicReports.threads.map(t => (
                <div key={t.id} style={{borderTop:'1px solid var(--border)', paddingTop:6, marginTop:6}}>
                  <div>
                    <Link to={`/community?category=${encodeURIComponent(t.categoryId)}&thread=${encodeURIComponent(t.id)}`}>
                      {t.title}
                    </Link>
                  </div>
                  <div className="muted" style={{fontSize:12}}>
                    Reports: {t.reports} • By: {t.userName}{t.userEmail ? ` (${t.userEmail})` : ''} • {new Date(t.createdAt).toLocaleString()}
                  </div>
                  <div style={{marginTop:6}}>
                    <button className="destructive" onClick={() => delThread(t.id)}>Delete thread</button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <strong>Posts <span className="badge">{filteredClassicReports.posts.length}</span></strong>
              {!filteredClassicReports.posts.length && <div className="muted">None</div>}
              {filteredClassicReports.posts.map(p => (
                <div key={p.id} style={{borderTop:'1px solid var(--border)', paddingTop:6, marginTop:6}}>
                  <div>
                    <Link to={`/community?category=${encodeURIComponent(p.categoryId)}&thread=${encodeURIComponent(p.threadId)}&post=${encodeURIComponent(p.id)}`}>
                      View post in thread {p.threadId}
                    </Link>
                  </div>
                  <div className="muted" style={{fontSize:12}}>
                    Reports: {p.reports} • By: {p.userName}{p.userEmail ? ` (${p.userEmail})` : ''} • {new Date(p.createdAt).toLocaleString()}
                  </div>
                  <div style={{marginTop:4}}>{p.content}</div>
                </div>
              ))}
            </div>

            <div>
              <strong>Jobs <span className="badge">{filteredClassicReports.jobs.length}</span></strong>
              {!filteredClassicReports.jobs.length && <div className="muted">None</div>}
              {filteredClassicReports.jobs.map(j => (
                <div key={j.id} className="card">
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
                    <strong>{j.title} — {j.company}</strong>
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Reports: {j.reports} • By: {j.userName || 'Unknown'}{j.userEmail ? ` (${j.userEmail})` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* PROJECTS */}
      {active === 'projects' && (
        <section className="card">
          <h3>Projects <span className="badge">{projects.length}</span></h3>
          <div className="grid cols-3">
            {projects.map(p => (
              <div key={p.id} className="card">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
                  <strong>{p.title}</strong>{p.featured && <span className="badge">Featured</span>}
                </div>
                <div className="muted" style={{ marginTop: 6 }}>{p.description}</div>
                <div style={{display:'flex', gap:6, marginTop:10}}>
                  <button className="primary" onClick={() => featureProject(p.id, !p.featured)}>{p.featured ? 'Unfeature' : 'Feature'}</button>
                  <button className="destructive" onClick={() => delProject(p.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* JOBS */}
      {active === 'jobs' && (
        <section className="card">
          <h3>Jobs <span className="badge">{jobs.length}</span></h3>
          <div className="grid cols-3">
            {jobs.map(j => (
              <div key={j.id} className="card">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
                  <strong>{j.title} — {j.company}</strong>{j.featured && <span className="badge">Featured</span>}
                </div>
                <div className="muted" style={{ marginTop: 6 }}>{j.description}</div>
                <div style={{display:'flex', gap:6, marginTop:10}}>
                  <button className="primary" onClick={() => featureJob(j.id, !j.featured)}>{j.featured ? 'Unfeature' : 'Feature'}</button>
                  <button className="destructive" onClick={() => delJob(j.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* METRICS */}
      
        {active === 'hackathons' && (
          <div style={{marginTop:16}}>
            <h3>Hackathons</h3>
            <div className="card" style={{marginBottom:12}}>
              <strong>Create Event</strong>
              <div className="form-grid">
                <input placeholder="Name" value={hName} onChange={e=>setHName(e.target.value)} />
                <input type="datetime-local" value={hStart} onChange={e=>setHStart(e.target.value)} />
                <input type="datetime-local" value={hEnd} onChange={e=>setHEnd(e.target.value)} />
                <textarea placeholder="Description" value={hDesc} onChange={e=>setHDesc(e.target.value)} />
                <button onClick={async()=>{ 
                  try{ 
                    await api.createHackathon({ name: hName, startDate: hStart, endDate: hEnd, description: hDesc });
                    setHName(''); setHStart(''); setHEnd(''); setHDesc('');
                    const latest = await api.hackathons();
                    setHackathons(latest);
                    alert('Hackathon created');
                  }catch(e){ alert(e?.message || 'Failed'); }
                }}>Insert</button>
              </div>
            </div>
            <div className="grid">
              {hackathons.map(ev => (
                <div key={ev.id} className="card">
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <strong>{ev.name}</strong>
                    <span className="badge">Votes: {ev.votes || 0}</span>
                  </div>
                  <div className="muted" style={{fontSize:12}}>{new Date(ev.startDate).toLocaleString()} → {new Date(ev.endDate).toLocaleString()}</div>
                  <div style={{marginTop:4}}>{ev.description}</div>
                  <div style={{marginTop:6}}><Link to={`/hackathons/${ev.id}`}>Open</Link></div>
                </div>
              ))}
            </div>
          </div>
        )}
{active === 'metrics' && (
        <>
          <section className="card">
            <h3>Business Metrics</h3>
            {!metrics && !metricsError ? (
              <div className="muted">Loading…</div>
            ) : metricsError ? (
              <div className="muted">{metricsError} — Admin access required.</div>
            ) : (
              <div className="grid cols-3" style={{marginTop:12}}>
                <div className="card">
                  <strong>Totals</strong>
                  <div>Users: <span className="badge-subtle">{metrics.totals.users}</span></div>
                  <div>Bytes: <span className="badge-subtle">{metrics.totals.bytes}</span></div>
                  <div>Bits: <span className="badge-subtle">{metrics.totals.bits}</span></div>
                  <div>Likes: <span className="badge-subtle">{metrics.totals.likes}</span></div>
                </div>
                <div className="card">
                  <strong>Active</strong>
                  <div>DAU: <span className="badge-subtle">{metrics.active.dau}</span></div>
                  <div>WAU: <span className="badge-subtle">{metrics.active.wau}</span></div>
                  <div>MAU: <span className="badge-subtle">{metrics.active.mau}</span></div>
                  <div>Engagement: <span className="badge-subtle">{(metrics.active.engagementRate*100).toFixed(1)}%</span></div>
                </div>
                <div className="card">
                  <strong>Last 7 Days</strong>
                  <div>Bytes: <span className="badge-subtle">{metrics.last7d.bytes}</span></div>
                  <div>Bits: <span className="badge-subtle">{metrics.last7d.bits}</span></div>
                </div>
                <div className="card">
                  <strong>Ads</strong>
                  <div>Impressions: <span className="badge-subtle">{metrics.ads.impressions}</span></div>
                  <div>Clicks: <span className="badge-subtle">{metrics.ads.clicks}</span></div>
                  <div>Revenue: <span className="badge-subtle">${metrics.ads.revenue.toFixed(2)}</span></div>
                  <div className="muted" style={{fontSize:12}}>CPM ${metrics.ads.cpm.toFixed(2)}, CPC ${metrics.ads.cpc.toFixed(2)}</div>
                </div>
              </div>
            )}
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h3>Ad Metrics (per ad)</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input placeholder="Advertiser ID" value={adAdvertiser} onChange={(e)=>setAdAdvertiser(e.target.value)} />
              <input type="date" value={adStart} onChange={(e)=>setAdStart(e.target.value)} />
              <input type="date" value={adEnd} onChange={(e)=>setAdEnd(e.target.value)} />
              <button onClick={()=>loadPerAdMetrics({ advertiserId: adAdvertiser, start: adStart, end: adEnd })} disabled={adLoading}>Apply</button>
              <button onClick={()=>{ setAdAdvertiser(''); setAdStart(''); setAdEnd(''); loadPerAdMetrics({}); }} disabled={adLoading}>Reset</button>
            </div>
            {adError && <div className="error">{adError}</div>}
            {adLoading ? <div>Loading…</div> : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Ad ID</th>
                      <th>Advertiser</th>
                      <th>Impr.</th>
                      <th>Clicks</th>
                      <th>Conv.</th>
                      <th>Spend</th>
                      <th>CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adRows.length ? adRows.map(r => (
                      <tr key={r.adId}>
                        <td>{r.adId}</td>
                        <td>{r.advertiserId}</td>
                        <td>{(r?.totals?.impressions||0).toLocaleString()}</td>
                        <td>{(r?.totals?.clicks||0).toLocaleString()}</td>
                        <td>{(r?.totals?.conversions||0).toLocaleString()}</td>
                        <td>${((r?.totals?.spend||0)).toFixed(2)}</td>
                        <td>{(((r?.ctr)||0)*100).toFixed(2)}%</td>
                      </tr>
                    )) : <tr><td colSpan="7" style={{textAlign:'center'}}>No data</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}