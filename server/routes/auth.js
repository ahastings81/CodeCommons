
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { read, write } = require('../utils/db');
const { JWT_SECRET } = require('../config');
const { nanoid } = require('nanoid');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

function signUser(u) {
  return jwt.sign({ id: u.id, email: u.email, name: u.name, role: u.role || 'user', tier: u.tier || 'free' }, JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', (req, res) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid input' });
  const users = read('users.json');
  const { email, password, name } = parse.data;
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(400).json({ error: 'Email already registered' });
  const id = require('nanoid').nanoid();
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = {
    id, email, passwordHash, name,
    role: 'user',
    tier: 'free',
    banned: false,
    bio: '',
    skills: [],
    links: { github: '', linkedin: '', website: '' },
    org: null, isRecruiterVerified: false,
    createdAt: Date.now(),
  };
  users.push(user);
  write('users.json', users);
  const token = signUser(user);
  return res.json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid input' });
  const users = read('users.json');
  const { email, password } = parse.data;
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.banned) return res.status(403).json({ error: 'Account banned' });
  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signUser(user);
  return res.json({ token, user: publicUser(user) });
});

module.exports = router;
