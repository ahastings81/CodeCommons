import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getToken } from '../services/api.js';

export default function NotificationsBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  async function refreshCount() {
    try {
      const r = await api.unreadCount();
      setCount(r.count || 0);
    } catch {}
  }

  async function loadItems() {
    try {
      const r = await api.notifications();
      setItems(r || []);
    } catch {}
  }

  // --- Poll fallback ---
  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 20000);
    return () => clearInterval(t);
  }, []);

  // --- Live updates via socket.io ---
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const s = io(api.API_BASE, { auth: { token } });

    s.on('connect', () => {
      console.log('[notif socket] connected');
    });

    s.on('notify', (payload) => {
      console.log('[notif socket] incoming', payload);
      setCount((c) => c + 1);
      if (open) loadItems();
    });

    s.on('disconnect', () => {
      console.log('[notif socket] disconnected');
    });

    return () => {
      try { s.disconnect(); } catch {}
    };
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        aria-label="Notifications"
        className="icon-button"
        onClick={async () => {
          setOpen(o => !o);
          if (!open) await loadItems();
        }}
        style={{ position: 'relative' }}
      >
        🔔
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, background: 'crimson', color: '#fff',
            borderRadius: 10, fontSize: 12, lineHeight: '16px', minWidth: 16, height: 16, padding: '0 4px'
          }}>{count}</span>
        )}
      </button>
      {open && (
        <div className="card" style={{
          position: 'absolute', right: 0, top: '120%', width: 360, maxHeight: 400,
          overflow: 'auto', zIndex: 1000
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Notifications</strong>
            <button onClick={async () => {
              await api.markNotificationsRead([], true);
              setCount(0);
              loadItems();
            }}>Mark all read</button>
          </div>
          <div style={{ marginTop: 8 }}>
            {items.length === 0 ? <div className="muted">No notifications</div> : items.map(n => (
              <div
                key={n.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                  cursor: (n.type === 'dm' || n.type === 'new_message') ? 'pointer' : 'default'
                }}
                onClick={() => {
                  if (n.type === 'dm' || n.type === 'new_message') {
                    navigate('/messages');
                    setOpen(false);
                  }
                }}
              >
                <div style={{ fontSize: 14 }}>
                  {renderNotification(n)}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{timeAgo(n.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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

function renderNotification(n) {
  const p = n.payload || {};
  switch (n.type) {
    case 'post_liked': return <span>👍 Your byte was liked.</span>;
    case 'comment_liked': return <span>👍 Your bit was liked.</span>;
    case 'thread_liked': return <span>👍 Your thread was liked.</span>;
    case 'thread_post_liked': return <span>👍 Your reply was liked.</span>;
    case 'dm_request': return <span>✉️ New message request.</span>;
    case 'dm_accept': return <span>✅ Message request accepted.</span>;
    case 'friend_request': return <span>👋 New friend request.</span>;
    case 'friend_accepted': return <span>🤝 Friend request accepted.</span>;
    case 'dm': return <span>💬 New direct message.</span>;
    case 'new_message': return <span>💌 You received a new message.</span>;
    default: return <span>🔔 Activity in CodeCommons.</span>;
  }
}
