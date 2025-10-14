const express = require('express');
const { z } = require('zod');
const { read, write } = require('../utils/db');
const { authRequired, adminOnly, modOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * READ Users
 * - Admin + Moderator
 */
router.get('/users', authRequired, modOnly, (req, res) => {
  const users = read('users.json').map(u => {
    const { passwordHash, ...rest } = u;
    return rest;
  });
  res.json(users);
});

/**
 * UPDATE User
 * - Admin: role, tier, banned, isRecruiterVerified
 * - Moderator: banned ONLY
 */
router.put('/users/:id', authRequired, modOnly, (req, res) => {
  const callerRole = req.user?.role || 'user';

  const adminSchema = z.object({
    role: z.enum(['user','moderator','admin']).optional(),
    tier: z.enum(['free','pro']).optional(),
    banned: z.boolean().optional(),
    isRecruiterVerified: z.boolean().optional()
  });

  const modSchema = z.object({
    banned: z.boolean()
  });

  const schema = (callerRole === 'admin') ? adminSchema
               : (callerRole === 'moderator') ? modSchema
               : null;
  if (!schema) return res.status(403).json({ error: 'Forbidden' });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const users = read('users.json');
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  Object.assign(users[idx], parsed.data);
  write('users.json', users);

  const { passwordHash, ...safe } = users[idx];
  res.json(safe);
});

/**
 * READ Reports (threads, posts, jobs, feedPosts, feedComments)
 * - Admin + Moderator
 * - Decorate with userName/userEmail
 * - Include categoryId for thread deep links
 */
router.get('/reports', authRequired, modOnly, (req, res) => {
  const users = read('users.json');
  const userById = new Map(users.map(u => [u.id, u]));

  const threads = read('threads.json') || [];
  const jobs = read('jobs.json') || [];

  // === Classic (existing) ===
  const reportedThreads = threads
    .filter(t => (t.reports || 0) > 0)
    .map(t => {
      const owner = userById.get(t.creatorId);
      return {
        ...t,
        categoryId: t.categoryId,
        userId: t.creatorId,
        userName: owner?.name || t.creatorId,
        userEmail: owner?.email || null,
      };
    });

  const reportedPosts = [];
  threads.forEach(t => (t.posts || []).forEach(p => {
    if ((p.reports || 0) > 0) {
      const owner = userById.get(p.userId);
      reportedPosts.push({
        threadId: t.id,
        categoryId: t.categoryId,
        ...p,
        userId: p.userId,
        userName: owner?.name || p.userId,
        userEmail: owner?.email || null,
      });
    }
  }));

  const reportedJobs = (jobs || [])
    .filter(j => (j.reports || 0) > 0)
    .map(j => {
      const owner = userById.get(j.creatorId);
      return {
        ...j,
        userId: j.creatorId,
        userName: owner?.name || j.creatorId,
        userEmail: owner?.email || null,
      };
    });

  // === NEW: Feed reports ===
  const feed = read('feed.json') || [];
  const feedComments = read('feed_comments.json') || [];

  const feedPostReports = feed
    .filter(p => (p.reports || 0) > 0)
    .map(p => {
      const owner = userById.get(p.userId);
      return {
        id: p.id,
        content: p.content,
        createdAt: p.createdAt,
        reports: p.reports || 0,
        userId: p.userId,
        userName: owner?.name || p.userId,
        userEmail: owner?.email || null
      };
    });

  const feedCommentReports = feedComments
    .filter(c => (c.reports || 0) > 0)
    .map(c => {
      const owner = userById.get(c.userId);
      return {
        id: c.id,
        postId: c.postId,
        content: c.content,
        createdAt: c.createdAt,
        reports: c.reports || 0,
        userId: c.userId,
        userName: owner?.name || c.userId,
        userEmail: owner?.email || null
      };
    });

  res.json({
    threads: reportedThreads,
    posts: reportedPosts,
    jobs: reportedJobs,
    feedPosts: feedPostReports,
    feedComments: feedCommentReports
  });
});

/**
 * Feature/Unfeature Projects (ADMIN ONLY)
 */
router.post('/projects/:id/feature', authRequired, adminOnly, (req, res) => {
  const projects = read('projects.json');
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  projects[idx].featured = true;
  write('projects.json', projects);
  res.json({ ok: true });
});

router.post('/projects/:id/unfeature', authRequired, adminOnly, (req, res) => {
  const projects = read('projects.json');
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  projects[idx].featured = false;
  write('projects.json', projects);
  res.json({ ok: true });
});

/**
 * Feature/Unfeature Jobs (ADMIN ONLY)
 */
router.post('/jobs/:id/feature', authRequired, adminOnly, (req, res) => {
  const jobs = read('jobs.json');
  const idx = jobs.findIndex(j => j.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  jobs[idx].featured = true;
  write('jobs.json', jobs);
  res.json({ ok: true });
});

router.post('/jobs/:id/unfeature', authRequired, adminOnly, (req, res) => {
  const jobs = read('jobs.json');
  const idx = jobs.findIndex(j => j.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  jobs[idx].featured = false;
  write('jobs.json', jobs);
  res.json({ ok: true });
});

/**
 * Deletes (ADMIN ONLY)
 */
router.delete('/projects/:id', authRequired, adminOnly, (req, res) => {
  const projects = read('projects.json').filter(p => p.id !== req.params.id);
  write('projects.json', projects);
  res.json({ ok: true });
});

router.delete('/jobs/:id', authRequired, adminOnly, (req, res) => {
  const jobs = read('jobs.json').filter(j => j.id !== req.params.id);
  write('jobs.json', jobs);
  res.json({ ok: true });
});

router.delete('/threads/:id', authRequired, adminOnly, (req, res) => {
  const threads = read('threads.json').filter(t => t.id !== req.params.id);
  write('threads.json', threads);
  res.json({ ok: true });
});

/**
 * Remove FEED Post / Comment (Moderator+)
 */
router.delete('/feed/:id', authRequired, modOnly, (req, res) => {
  const id = req.params.id;
  const feed = read('feed.json');
  const idx = feed.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found' });
  feed.splice(idx, 1);
  write('feed.json', feed);
  // also remove likes and comments for that post
  write('feed_likes.json', read('feed_likes.json').filter(l => l.postId !== id));
  write('feed_comments.json', read('feed_comments.json').filter(c => c.postId !== id));
  res.json({ ok: true });
});

router.delete('/feed-comments/:id', authRequired, modOnly, (req, res) => {
  const id = req.params.id;
  const comments = read('feed_comments.json');
  const idx = comments.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Comment not found' });
  comments.splice(idx, 1);
  write('feed_comments.json', comments);
  res.json({ ok: true });
});

module.exports = router;

/**
 * Business Metrics (Admin only)
 */
router.get('/metrics', authRequired, adminOnly, (req, res) => {
  const users = read('users.json') || [];
  const feed = read('feed.json') || [];
  const comments = read('feed_comments.json') || [];
  const likes = read('feed_likes.json') || [];
  let ads = [];
  try { ads = read('ads.json') || []; } catch {}

  const now = Date.now();
  const dayAgo = now - 24*60*60*1000;
  const weekAgo = now - 7*24*60*60*1000;
  const monthAgo = now - 30*24*60*60*1000;

  const uniq = (arr) => Array.from(new Set(arr)).filter(Boolean);

  const dau = uniq([
    ...feed.filter(p => (p.createdAt||0) >= dayAgo).map(p => p.userId),
    ...comments.filter(c => (c.createdAt||0) >= dayAgo).map(c => c.userId),
    ...likes.filter(l => (l.createdAt||0) >= dayAgo).map(l => l.userId),
  ]).length;

  const wau = uniq([
    ...feed.filter(p => (p.createdAt||0) >= weekAgo).map(p => p.userId),
    ...comments.filter(c => (c.createdAt||0) >= weekAgo).map(c => c.userId),
    ...likes.filter(l => (l.createdAt||0) >= weekAgo).map(l => l.userId),
  ]).length;

  const mau = uniq([
    ...feed.filter(p => (p.createdAt||0) >= monthAgo).map(p => p.userId),
    ...comments.filter(c => (c.createdAt||0) >= monthAgo).map(c => c.userId),
    ...likes.filter(l => (l.createdAt||0) >= monthAgo).map(l => l.userId),
  ]).length;

  const totals = { users: users.length, bytes: feed.length, bits: comments.length, likes: likes.length };
  const last7d = { bytes: feed.filter(p => (p.createdAt||0) >= weekAgo).length, bits: comments.filter(c => (c.createdAt||0) >= weekAgo).length };
  const active = { dau, wau, mau, engagementRate: users.length ? (wau/users.length) : 0 };

  const impressions = ads.reduce((s,a)=> s+(a.impressions||0), 0);
  const clicks = ads.reduce((s,a)=> s+(a.clicks||0), 0);
  const CPM = 2.50, CPC = 0.50;
  const revenue = (impressions/1000)*CPM + clicks*CPC;

  return res.json({ totals, last7d, active, ads: { impressions, clicks, revenue: Number(revenue.toFixed(2)), cpm: CPM, cpc: CPC } });
});

