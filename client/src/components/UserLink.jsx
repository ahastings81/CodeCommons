import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

/**
 * UserLink → navigates to /u/:userId by default
 * - If you pass a `user` object, it renders immediately (no fetch).
 * - If only `id` is provided, it tries /users/:id once; if 404, it renders a stable fallback.
 */
export default function UserLink({
  id,
  user: userProp = null,
  to,
  showAvatar = false,
  size = 28,
  className = '',
}) {
  const [user, setUser] = useState(userProp);
  const [triedFetch, setTriedFetch] = useState(false);

  useEffect(() => {
    if (userProp && userProp.id === id) setUser(userProp);
  }, [id, userProp]);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!id) return;
      const hasData =
        !!(user?.name || user?.username || user?.displayName || user?.email || user?.avatarUrl);
      if (hasData || triedFetch) return;
      try {
        const u = await api.userById(id);
        if (alive) setUser(u || null);
      } catch {
        // 404: fallback
      } finally {
        if (alive) setTriedFetch(true);
      }
    }
    load();
    return () => { alive = false; };
  }, [id, user]);

  const shortId = (id || '').slice(0, 6) || 'user';
  const displayName =
    user?.name?.trim() ||
    user?.username?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.trim() ||
    `User ${shortId}`;

  const avatarSeed = user?.name || user?.username || user?.email || id || 'user';
  const avatarUrl =
    user?.avatarUrl ||
    user?.avatar ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(avatarSeed)}`;

  const href = to || `/u/${id}`;

  return (
    <Link
      to={href}
      className={`user-link ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
      title={displayName}
    >
      {showAvatar && (
        <img
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1px solid var(--border)',
          }}
        />
      )}
      <span>{displayName}</span>
    </Link>
  );
}
