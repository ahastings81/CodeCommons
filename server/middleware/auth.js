
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { read } = require('../utils/db');

function authRequired(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = read('users.json');
    const u = users.find(x => x.id === payload.id);
    if (!u) return res.status(401).json({ error: 'Invalid token' });
    if (u.banned) return res.status(403).json({ error: 'Account banned' });
    req.user = { id: u.id, role: u.role || 'user', tier: u.tier || 'free', email: u.email, name: u.name };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function roleAtLeast(role) {
  const order = { 'user': 1, 'moderator': 2, 'admin': 3 };
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if ((order[req.user.role] || 0) < (order[role] || 0)) return res.status(403).json({ error: `${role} role required` });
    next();
  };
}

const modOnly = roleAtLeast('moderator');
const adminOnly = roleAtLeast('admin');

module.exports = { authRequired, modOnly, adminOnly };
