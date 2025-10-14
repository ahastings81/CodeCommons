import { io } from 'socket.io-client';
import React, { useEffect, useState } from 'react';
import NotificationsBell from './components/NotificationsBell.jsx';
import { Link, Route, Routes } from 'react-router-dom';
import { api, setToken, getToken, clearToken } from './services/api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Post from './pages/Post.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Community from './pages/Community.jsx';
import Jobs from './pages/Jobs.jsx';
import JobDetail from './pages/JobDetail.jsx';
import Hackathons from './pages/Hackathons.jsx';
import HackathonDetail from './pages/HackathonDetail.jsx';
import Profile from './pages/Profile.jsx';
import Moderation from './pages/Moderation.jsx';
import Search from './pages/Search.jsx';
import Messages from './pages/Messages.jsx';
import Friends from './pages/Friends.jsx';
import UserProfile from './pages/UserProfile.jsx';
import Admin from './pages/Admin.jsx';
import './ui/theme.css';
import LightbulbToggle from './components/LightbulbToggle.jsx';
import AdRail from './components/AdRail.jsx';
import AdsDashboard from './pages/AdsDashboard.jsx';

function useDark() {
  const [dark, setDark] = useState(localStorage.getItem('darkMode') === '1');
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('darkMode', dark ? '1' : '0');
  }, [dark]);
  return { dark, setDark };
}

function Header({ me, onLogout }) {
  const [dmUnread, setDmUnread] = React.useState(0);
  const [friendUnread, setFriendUnread] = React.useState(0);

  // Fallback polling (kept)
  React.useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const notifs = await api.notifications();
        const unreadDm = (notifs || []).filter(n => !n.read && n.type === 'dm').length;
        const unreadFriendNotifs = (notifs || []).filter(
          n => !n.read && (n.type === 'friend_request' || n.type === 'friend_accepted')
        ).length;
        if (!stop) {
          setDmUnread(unreadDm);
          setFriendUnread(unreadFriendNotifs);
        }
      } catch {}
      if (!stop) setTimeout(poll, 15000);
    }
    poll();
    return () => { stop = true; };
  }, []);

  // 🔔 Live notifications via socket.io (joins when me is known)
  React.useEffect(() => {
    if (!me?.id) return;
    const token = getToken && getToken();
    if (!token) return;

    // Always use the same origin as your API (from services/api.js)
    const SOCKET_URL = api.API_BASE || 'http://localhost:4000';
    console.log('[socket] using base:', SOCKET_URL);

    const s = io(SOCKET_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'], // robust in dev
      withCredentials: true
    });

    s.on('connect', () => {
      console.log('[socket] connected', s.id, '→ joining', 'user:' + me.id);
      s.emit('joinUser', me.id);
    });

    s.on('connect_error', (err) => {
      console.error('[socket] connect_error', err?.message || err);
    });

    s.on('error', (err) => {
      console.error('[socket] error', err);
    });

    // Primary notify from server when a DM arrives / friend events
    s.on('notify', (payload) => {
      console.log('[socket] notify', payload);
      if (payload?.type === 'dm') {
        if (payload.message?.senderId && payload.message.senderId !== me.id) {
          setDmUnread((u) => u + 1);
        }
      } else if (payload?.type === 'friend_request' || payload?.type === 'friend_accepted') {
        setFriendUnread((u) => u + 1);
      }
    });

    // Safety net: also bump on DM room message events
    s.on('dm:message', (msg) => {
      console.log('[socket] dm:message', msg);
      if (msg?.senderId && msg.senderId !== me.id) {
        setDmUnread((u) => u + 1);
      }
    });

    return () => { try { s.disconnect(); } catch {} };
  }, [me?.id]);

  const { dark, setDark } = useDark();
  const logoSrc = dark ? '/logo2.png' : '/logo.png';
  const avatarSrc = me?.avatarUrl;
  const avatarInitial = (me?.name?.trim()?.[0] || me?.email?.trim()?.[0] || 'U').toUpperCase();

  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      {/* LEFT: brand + main nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Link to="/" className="brand" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <img src={logoSrc} alt="CodeCommons Logo" style={{ height: 125, maxHeight: '100%' }} />
        </Link>
        <Link to="/projects"><button>Projects</button></Link>
        <Link to="/community"><button>Community</button></Link>
        <Link to="/jobs"><button>Jobs</button></Link>
        <Link to="/hackathons"><button>Hackathons</button></Link>
        <Link to="/friends"><button>Friends {friendUnread > 0 && <span className="badge">{friendUnread}</span>}</button></Link>
        <Link to="/messages"><button>Messages {dmUnread > 0 && <span className="badge">{dmUnread}</span>}</button></Link>
        <Link to="/search"><button>Search</button></Link>

        {me?.role === 'admin' && <Link to="/admin"><button>Admin</button></Link>}
        {me?.role === 'moderator' && <Link to="/moderation"><button>Moderation</button></Link>}
      </div>

      {/* RIGHT: profile (with avatar) + theme toggle + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <NotificationsBell />

        {me && (
          <Link to="/profile" className="profile-link" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar" style={{ width: 28, height: 28, borderRadius: '50%' }} />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--border)',
                display: 'grid', placeItems: 'center', fontSize: 12
              }}>
                {avatarInitial}
              </div>
            )}
            <button>Profile</button>
          </Link>
        )}
        <LightbulbToggle isOn={dark} onToggle={() => setDark(!dark)} />

        {me && <button onClick={onLogout}>Logout</button>}
      </div>
    </nav>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [me, setMe] = useState(null);

  // Global ripple initializer (no extra files needed)
  useEffect(() => {
    const onDown = (e) => {
      const btn = e.target.closest('button, .btn');
      if (!btn || btn.disabled) return;

      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ink = document.createElement('span');
      ink.className = 'ink';
      ink.style.setProperty('--ripple-x', `${x}px`);
      ink.style.setProperty('--ripple-y', `${y}px`);
      ink.style.setProperty('--ripple-size', `${size}px`);
      btn.appendChild(ink);
      setTimeout(() => ink.remove(), 650);
    };

    document.addEventListener('pointerdown', onDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  useEffect(() => {
    if (authed) {
      api.me().then(setMe).catch(() => setAuthed(false));
    }
  }, [authed]);

  if (!authed) {
    return <Login onLogin={(t) => { setToken(t); setAuthed(true); }} />;
  }

  return (
    <div>
      <Header
        me={me}
        onLogout={() => { try { clearToken(); } catch {}; setAuthed(false); }}
      />
      <div className="layout-rails">
        <AdRail side="left" />
        <div className="container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects me={me} />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/community" element={<Community />} />
            <Route path="/jobs" element={<Jobs me={me} />} />
            <Route path="/jobs/:id" element={<JobDetail me={me} />} />
            <Route path="/hackathons" element={<Hackathons />} />
            <Route path="/hackathons/:id" element={<HackathonDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/moderation" element={<Moderation />} />
            <Route path="/search" element={<Search />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/u/:userId" element={<UserProfile />} />
            <Route path="/post/:postId" element={<Post />} />
            <Route path="/ads" element={<AdsDashboard />} />
          </Routes>
        </div>
        <AdRail side="right" />
      </div>
    </div>
  );
}
