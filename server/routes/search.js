
const express = require('express');
const { authRequired } = require('../middleware/auth');
const { read } = require('../utils/db');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json({ users: [], projects: [], threads: [], jobs: [] });
  const users = read('users.json').filter(u => (u.name||'').toLowerCase().includes(q) || (u.skills||[]).join(',').toLowerCase().includes(q));
  const projects = read('projects.json').filter(p => p.title.toLowerCase().includes(q) || (p.tech||[]).join(',').toLowerCase().includes(q) || (p.tags||[]).join(',').toLowerCase().includes(q));
  const threads = read('threads.json').filter(t => t.title.toLowerCase().includes(q));
  const jobs = read('jobs.json').filter(j => j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || (j.skills||[]).join(',').toLowerCase().includes(q));
  res.json({ users, projects, threads, jobs });
});

module.exports = router;
