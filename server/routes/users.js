
const express = require('express');
const { z } = require('zod');
const { read, write } = require('../utils/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const updateSchema = z.object({
  name: z.string().optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  skills: z.array(z.any()).optional(),
  links: z.object({
    github: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().optional(),
  }).partial().optional(),
  org: z.string().nullable().optional(),
});

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

router.get('/me', authRequired, (req, res) => {
  const users = read('users.json');
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const messages = read('messages.json').filter(m => m.userId === user.id).length;
  const projects = read('projects.json');
  const created = projects.filter(p => p.ownerId === user.id).length;
  const completedTasks = projects.reduce((acc, p) => acc + p.tasks.filter(t => t.assigneeId === user.id && t.status === 'done').length, 0);
  const badges = [];
  if (created >= 1) badges.push('Project Founder');
  if (completedTasks >= 5) badges.push('Task Finisher');
  if (messages >= 10) badges.push('Chatter');
  if (user.tier === 'pro') badges.push('Pro Verified');
  const u = publicUser(user); u.badges = badges;
  res.json(u);
});

router.put('/me', authRequired, (req, res) => {
  const users = read('users.json');
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid input' });
  const { bio, skills, links, name, org, avatarUrl } = parse.data;
  if (name) users[idx].name = name;
  if (typeof bio === 'string') users[idx].bio = bio;
  if (Array.isArray(skills)) users[idx].skills = skills;
  if (links && typeof links === 'object') users[idx].links = { ...users[idx].links, ...links };
  if (avatarUrl !== undefined) users[idx].avatarUrl = avatarUrl;
  if (org !== undefined) users[idx].org = org;
  write('users.json', users);
  res.json(publicUser(users[idx]));
});

router.get('/list', authRequired, (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const users = read('users.json').map(publicUser).filter(u => {
    if (!q) return true;
    return (u.name || '').toLowerCase().includes(q) || (u.skills || []).join(',').toLowerCase().includes(q);
  });
  res.json(users);
});

module.exports = router;


/**
 * Public user by id
 */
router.get('/:id', authRequired, (req, res) => {
  const id = req.params.id;
  const users = read('users.json');
  const u = users.find(x => x.id === id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(publicUser(u));
});
