const express = require('express');
const { z } = require('zod');
const { read, write } = require('../utils/db');
const { nanoid } = require('nanoid');
const { authRequired } = require('../middleware/auth');
const { LIMITS } = require('../config');

const router = express.Router();

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  tech: z.array(z.any()).optional(),
  rolesNeeded: z.array(z.any()).optional(),
  repoUrl: z.string().optional(),
  tags: z.array(z.any()).optional(),
  difficulty: z.enum(['beginner','intermediate','advanced']).optional(),
  mentorshipFriendly: z.boolean().optional(),
});

const taskCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['todo','doing','done']).optional(),
  assigneeId: z.string().nullable().optional()
});

const taskUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['todo','doing','done']).optional(),
  assigneeId: z.string().nullable().optional()
});

function isMember(p, userId) { return p.members.includes(userId); }

router.get('/', authRequired, (req, res) => {
  const projects = read('projects.json');
  const q = (req.query.q || '').toLowerCase();
  const tech = (req.query.tech || '').toLowerCase();
  const diff = (req.query.difficulty || '');
  const mentorship = req.query.mentorship === '1';
  let out = projects;
  if (q) out = out.filter(p => p.title.toLowerCase().includes(q) || (p.tech||[]).join(',').toLowerCase().includes(q));
  if (tech) out = out.filter(p => (p.tech||[]).join(',').toLowerCase().includes(tech));
  if (diff) out = out.filter(p => (p.difficulty||'') === diff);
  if (mentorship) out = out.filter(p => !!p.mentorshipFriendly);
  out = out.slice().sort((a,b)=> (b.featured===true) - (a.featured===true) || (b.updatedAt||0)-(a.updatedAt||0) || (b.members?.length||0)-(a.members?.length||0));
  res.json(out);
});

router.post('/', authRequired, (req, res) => {
  const projects = read('projects.json');
  const myCount = projects.filter(p => p.ownerId === req.user.id).length;
  if (req.user.tier !== 'pro' && myCount >= LIMITS.FREE_MAX_PROJECTS) {
    return res.status(402).json({ error: `Free tier allows up to ${LIMITS.FREE_MAX_PROJECTS} active projects. Upgrade to Pro for more.` });
  }
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid input' });
  const { title, description, tech = [], rolesNeeded = [], repoUrl = '', tags = [], difficulty = 'beginner', mentorshipFriendly = false } = parse.data;
  const project = {
    id: nanoid(), title, description: description || '',
    tech, rolesNeeded, repoUrl, tags, difficulty, mentorshipFriendly,
    ownerId: req.user.id, members: [req.user.id],
    tasks: [], chatHistory: [], featured: false,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  projects.push(project);
  write('projects.json', projects);
  res.json(project);
});

router.get('/:id', authRequired, (req, res) => {
  const projects = read('projects.json');
  const p = projects.find(p => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

router.post('/:id/join', authRequired, (req, res) => {
  const projects = read('projects.json');
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (!projects[idx].members.includes(req.user.id)) projects[idx].members.push(req.user.id);
  projects[idx].updatedAt = Date.now();
  write('projects.json', projects);
  res.json(projects[idx]);
});

// Optional: allow members to leave a project
router.post('/:id/leave', authRequired, (req, res) => {
  const projects = read('projects.json');
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const p = projects[idx];
  // Disallow owner leaving their own project (adjust if you want)
  if (p.ownerId === req.user.id) {
    return res.status(400).json({ error: 'Owner cannot leave their own project' });
  }
  p.members = (p.members || []).filter(m => m !== req.user.id);
  p.updatedAt = Date.now();
  write('projects.json', projects);
  res.json({ ok: true, project: p });
});

router.post('/:id/tasks', authRequired, (req, res) => {
  const projects = read('projects.json');
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const p = projects[idx];
  if (!isMember(p, req.user.id)) return res.status(403).json({ error: 'Only members can add tasks' });
  const parse = taskCreateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid input' });
  const { title, description = '', status = 'todo', assigneeId = null } = parse.data;
  const task = { id: nanoid(), title, description, status, assigneeId, creatorId: req.user.id, createdAt: Date.now() };
  p.tasks.push(task);
  p.updatedAt = Date.now();
  write('projects.json', projects);
  res.json(task);
});

router.put('/:id/tasks/:taskId', authRequired, (req, res) => {
  const projects = read('projects.json');
  const p = projects.find(p => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const t = p.tasks.find(t => t.id === req.params.taskId);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  if (!(p.ownerId === req.user.id || t.creatorId === req.user.id)) return res.status(403).json({ error: 'Only owner or task creator can edit task' });
  const parse = taskUpdateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid input' });
  const { title, description, status, assigneeId } = parse.data;
  if (title !== undefined) t.title = title;
  if (description !== undefined) t.description = description;
  if (status !== undefined) t.status = status;
  if (assigneeId !== undefined) t.assigneeId = assigneeId;
  p.updatedAt = Date.now();
  write('projects.json', projects);
  res.json(t);
});

module.exports = router;
