import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api.js';

/* Lightweight UI bits to match Profile.jsx */
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

export default function UserProfile() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);

  // relationship state
  const [rel, setRel] = useState({
    isFriend: false,
    friendReqPending: false,
    isFollowing: false,
    isBlocked: false,
  });

  const [busy, setBusy] = useState({
    friend: false,
    msg: false,
    follow: false,
    block: false,
  });

  const [error, setError] = useState('');

  useEffect(() => { load(); }, [userId]);

  async function load() {
    setError('');
    try {
      // Try canonical lookup first
      let found = null;
      try { found = await api.userById(userId); } catch {}

      // Fallback: search index if direct lookup not available
      if (!found) {
        const list = await api.searchUsers('');
        found = Array.isArray(list) ? list.find(x => x.id === userId) : null;
      }

      // Final guaranteed placeholder so profile always renders
      if (!found) {
        const displayName = `User ${String(userId || '').slice(0,6) || 'unknown'}`;
        found = {
          id: userId,
          name: displayName,
          email: '',
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
          skills: [],
          links: { github: '', linkedin: '', website: '' },
          bio: '',
          badges: [],
        };
      }

      const normalized = {
        ...found,
        skills: Array.isArray(found.skills)
          ? found.skills
          : (typeof found.skills === 'string'
              ? found.skills.split(',').map(s => s.trim()).filter(Boolean)
              : []),
        links: found.links || { github: '', linkedin: '', website: '' },
      };
      setUser(normalized);

      // Load relationship info to drive buttons (best-effort)
      try {
        const [friends, friendReqs, following, blocked] = await Promise.all([
          api.listFriends().catch(() => []),
          api.listFriendRequests().catch(() => []),
          api.listFollowing().catch(() => []),
          api.listBlocked().catch(() => []),
        ]);

        const isFriend = Array.isArray(friends) && friends.some(f => f.id === userId);
        const friendReqPending = Array.isArray(friendReqs) && friendReqs.some(fr =>
          (fr.toUserId === userId || fr.fromUserId === userId) && fr.status === 'pending'
        );
        const isFollowing = Array.isArray(following) && following.some(u => u.id === userId);
        const isBlocked = Array.isArray(blocked) && blocked.some(u => u.id === userId);

        setRel({ isFriend, friendReqPending, isFollowing, isBlocked });
      } catch {
        // non-fatal
      }
    } catch {
      setUser(null);
      setError('Unable to load user profile.');
    }
  }

  if (!user) {
    return (
      <div className="container">
        <div className="card">{error || 'User not found.'}</div>
      </div>
    );
  }

  // Actions
  const onAddFriend = async () => {
    setBusy(b => ({ ...b, friend: true }));
    try {
      await api.requestFriend(user.id);
      setRel(r => ({ ...r, friendReqPending: true }));
      alert('Friend request sent');
    } catch (e) {
      alert(e?.message || 'Failed to send friend request');
    } finally {
      setBusy(b => ({ ...b, friend: false }));
    }
  };

  const onMessageRequest = async () => {
    setBusy(b => ({ ...b, msg: true }));
    try {
      await api.dmRequest(user.id, 'Hi! Can we chat?');
      alert('Message request sent');
    } catch (e) {
      alert(e?.message || 'Failed to send message request');
    } finally {
      setBusy(b => ({ ...b, msg: false }));
    }
  };

  const onToggleFollow = async () => {
    setBusy(b => ({ ...b, follow: true }));
    try {
      if (rel.isFollowing) {
        await api.unfollow(user.id);
        setRel(r => ({ ...r, isFollowing: false }));
      } else {
        await api.follow(user.id);
        setRel(r => ({ ...r, isFollowing: true }));
      }
    } catch (e) {
      alert(e?.message || 'Failed to update follow');
    } finally {
      setBusy(b => ({ ...b, follow: false }));
    }
  };

  const onToggleBlock = async () => {
    setBusy(b => ({ ...b, block: true }));
    try {
      if (rel.isBlocked) {
        await api.unblock(user.id);
        setRel(r => ({ ...r, isBlocked: false }));
      } else {
        await api.block(user.id);
        setRel(r => ({ ...r, isBlocked: true }));
      }
    } catch (e) {
      alert(e?.message || 'Failed to update block');
    } finally {
      setBusy(b => ({ ...b, block: false }));
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ padding: 16 }}>
        {/* Header row: avatar + name/email + org/badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <AvatarPreview url={user.avatarUrl} name={user.name} email={user.email} size={64} />
          <div style={{ minWidth: 220 }}>
            <h2 style={{ margin: '0 0 4px 0' }}>
              {user.name || user.email}{' '}
              {user.tier === 'pro' && <span className="badge badge-pro">Verified Pro</span>}
            </h2>
            <div className="muted" style={{ marginBottom: 6 }}>{user.email}</div>
            <div className="muted" style={{ fontSize: 12 }}>ID: {user.id}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {user.org && <Pill>{user.org}</Pill>}
              {Array.isArray(user.badges) && user.badges.length > 0
                ? user.badges.map(b => <Pill key={b}>{b}</Pill>)
                : <Pill muted>no badges yet</Pill>}
            </div>
          </div>
        </div>

        {/* Bio */}
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: '0 0 6px 0' }}>Bio</h4>
          <div className="muted">{user.bio || '—'}</div>
        </div>

        {/* Skills */}
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: '0 0 6px 0' }}>Skills</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {user.skills?.length
              ? user.skills.map(s => <Pill key={s}>{s}</Pill>)
              : <span className="muted">No skills listed</span>}
          </div>
        </div>

        {/* Links */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <LinkOut label="GitHub"   href={user.links?.github} />
          <LinkOut label="LinkedIn" href={user.links?.linkedin} />
          <LinkOut label="Website"  href={user.links?.website} />
        </div>

        {/* Actions */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={onAddFriend}
            disabled={busy.friend || rel.isFriend || rel.friendReqPending}
            title={rel.isFriend ? 'Already friends' : rel.friendReqPending ? 'Request pending' : 'Send friend request'}
          >
            {rel.isFriend ? 'Friends' : rel.friendReqPending ? 'Request Sent' : (busy.friend ? 'Sending…' : 'Add Friend')}
          </button>

          <button onClick={onMessageRequest} disabled={busy.msg}>
            {busy.msg ? 'Sending…' : 'Message Request'}
          </button>

          <button onClick={onToggleFollow} disabled={busy.follow}>
            {busy.follow ? (rel.isFollowing ? 'Unfollowing…' : 'Following…') : (rel.isFollowing ? 'Unfollow' : 'Follow')}
          </button>

          <button onClick={onToggleBlock} disabled={busy.block} className={rel.isBlocked ? 'destructive' : ''}>
            {busy.block ? (rel.isBlocked ? 'Unblocking…' : 'Blocking…') : (rel.isBlocked ? 'Unblock' : 'Block')}
          </button>
        </div>
      </div>
    </div>
  );
}
