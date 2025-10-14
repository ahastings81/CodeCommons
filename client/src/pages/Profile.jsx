import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

function Pill({ children, muted }) {
  return (
    <span
      className={muted ? 'muted' : ''}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        fontSize: 12,
        lineHeight: 1,
        gap: 6
      }}
    >
      {children}
    </span>
  );
}

function LinkOut({ label, href }) {
  if (!href) return null;
  const pretty = href.replace(/^https?:\/\//, '');
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="pill"
      style={{ textDecoration: 'none' }}
      title={href}
    >
      {label}: {pretty}
    </a>
  );
}

function AvatarPreview({ url, name, email, size = 64 }) {
  const initial = (name?.trim()?.[0] || email?.trim()?.[0] || 'U').toUpperCase();
  return url ? (
    <img
      src={url}
      alt="avatar"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
    />
  ) : (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        display: 'grid', placeItems: 'center',
        border: '1px solid var(--border)', fontSize: Math.max(12, Math.floor(size * 0.45))
      }}
      aria-label="avatar placeholder"
    >
      {initial}
    </div>
  );
}

export default function Profile() {
  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('overview'); // 'overview' | 'edit'
  const { show } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const mine = await api.me();
        // Ensure shape defaults so the editor never crashes
        setMe({
          ...mine,
          skills: Array.isArray(mine.skills) ? mine.skills : (typeof mine.skills === 'string' ? mine.skills.split(',').map(s => s.trim()).filter(Boolean) : []),
          links: mine.links || { github: '', linkedin: '', website: '' },
        });
      } catch {
        // if token expired etc, let App handle redirect on next render
      }
    })();
  }, []);

  if (!me) return <div className="container"><div className="card">Loading…</div></div>;

  const save = async () => {
    setSaving(true);
    try {
      await api.updateMe({
        name: me.name,
        bio: me.bio,
        avatarUrl: me.avatarUrl,
        skills: me.skills,
        links: me.links,
        org: me.org
      });
      show('Profile saved');
      setTab('overview');
    } catch (e) {
      alert(e?.message || 'Save failed');
    }
    setSaving(false);
  };

  return (
    <div className="container">
      <div style={{display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap'}}>
        <h2 style={{margin:0}}>
          My Profile {me.tier === 'pro' && <span className="badge badge-pro">Verified Pro</span>}
        </h2>
        <div className="muted" style={{fontSize:12}}>ID: {me.id}</div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex', gap:8, margin:'12px 0 16px'}}>
        <button
          className={tab==='overview' ? 'btn active' : 'btn'}
          onClick={()=>setTab('overview')}
        >Overview</button>
        <button
          className={tab==='edit' ? 'btn active' : 'btn'}
          onClick={()=>setTab('edit')}
        >Edit Profile</button>
      </div>

      {tab === 'overview' && (
        <div className="card" style={{padding:16}}>
          {/* Top row: avatar + name/email + org / badges */}
          <div style={{display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
            <AvatarPreview url={me.avatarUrl} name={me.name} email={me.email} size={64} />
            <div style={{minWidth:220}}>
              <h2 style={{margin:'0 0 4px 0'}}>{me.name || me.email}</h2>
              <div className="muted" style={{marginBottom:6}}>{me.email}</div>
              <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                {me.org && <Pill>{me.org}</Pill>}
                {Array.isArray(me.badges) && me.badges.length > 0
                  ? me.badges.map(b => <Pill key={b}>{b}</Pill>)
                  : <Pill muted>no badges yet</Pill>}
              </div>
            </div>
          </div>

          {/* Bio */}
          <div style={{marginTop:16}}>
            <h4 style={{margin:'0 0 6px 0'}}>Bio</h4>
            <div className="muted">{me.bio || '—'}</div>
          </div>

          {/* Skills */}
          <div style={{marginTop:16}}>
            <h4 style={{margin:'0 0 6px 0'}}>Skills</h4>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {(me.skills && me.skills.length)
                ? me.skills.map(s => <Pill key={s}>{s}</Pill>)
                : <span className="muted">Add your skills in Edit tab</span>}
            </div>
          </div>

          {/* Links */}
          <div style={{marginTop:16, display:'flex', gap:8, flexWrap:'wrap'}}>
            <LinkOut label="GitHub"   href={me.links?.github} />
            <LinkOut label="LinkedIn" href={me.links?.linkedin} />
            <LinkOut label="Website"  href={me.links?.website} />
          </div>
        </div>
      )}

      {tab === 'edit' && (
        <div className="card" style={{padding:16}}>
          <div className="grid" style={{maxWidth:720}}>
            <label>
              Name
              <input
                value={me.name || ''}
                onChange={e=>setMe({...me, name: e.target.value})}
              />
            </label>

            {/* Avatar upload & URL */}
            <div style={{display:'flex',alignItems:'center',gap:12, flexWrap:'wrap'}}>
              <AvatarPreview url={me.avatarUrl} name={me.name} email={me.email} size={64} />
              <label className="pill" style={{display:'inline-flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                Upload file
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e)=>{
                    const f = e.target.files?.[0]; if(!f) return;
                    try {
                      const out = await api.uploadAvatar(f);
                      setMe({...me, avatarUrl: 'http://localhost:4000' + out.url});
                      alert('Uploaded. Click Save.');
                    } catch {
                      alert('Upload failed');
                    }
                  }}
                  style={{display:'none'}}
                />
              </label>
              <label style={{flex:1, minWidth:260}}>
                Avatar URL
                <input
                  value={me.avatarUrl || ''}
                  onChange={e=>setMe({...me, avatarUrl: e.target.value})}
                />
              </label>
            </div>

            <label>
              Bio
              <textarea
                value={me.bio || ''}
                onChange={e=>setMe({...me, bio: e.target.value})}
              />
            </label>

            <label>
              Skills (comma-separated)
              <input
                value={(me.skills || []).join(', ')}
                onChange={e=>{
                  const arr = e.target.value.split(',').map(s=>s.trim()).filter(Boolean);
                  setMe({...me, skills: arr});
                }}
              />
            </label>

            <label>
              Organization (optional)
              <input
                value={me.org || ''}
                onChange={e=>setMe({...me, org: e.target.value})}
              />
            </label>

            <label>
              GitHub
              <input
                value={me.links?.github || ''}
                onChange={e=>setMe({...me, links:{...me.links, github: e.target.value}})}
              />
            </label>

            <label>
              LinkedIn
              <input
                value={me.links?.linkedin || ''}
                onChange={e=>setMe({...me, links:{...me.links, linkedin: e.target.value}})}
              />
            </label>

            <label>
              Website
              <input
                value={me.links?.website || ''}
                onChange={e=>setMe({...me, links:{...me.links, website: e.target.value}})}
              />
            </label>

            <div>
              Badges: {Array.isArray(me.badges) && me.badges.length ? me.badges.join(' • ') : 'None yet'}
            </div>

            <div style={{marginTop:8}}>
              <button disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="ghost" style={{marginLeft:8}} onClick={()=>setTab('overview')}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
