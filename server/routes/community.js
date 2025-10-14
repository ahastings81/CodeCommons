const express = require('express');
const { z } = require('zod');
const { read, write } = require('../utils/db');
const { nanoid } = require('nanoid');
const { authRequired, modOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/categories', authRequired, (req, res) => {
  const categories = read('categories.json');
  res.json(categories);
});

router.post('/threads', authRequired, (req, res) => {
  const schema = z.object({
    categoryId: z.string(),
    title: z.string().min(1),
    content: z.string().optional()
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid input' });

  const threads = read('threads.json');
  const { categoryId, title, content } = parse.data;

  const thread = {
    id: nanoid(),
    categoryId,
    title,
    creatorId: req.user.id,
    createdAt: Date.now(),
    pinned: false,                // NEW: default pinned flag
    posts: [],
    reports: 0
  };

  if (content) {
    thread.posts.push({
      id: nanoid(),
      userId: req.user.id,
      content,
      createdAt: Date.now(),
      reports: 0
    });
  }

  threads.push(thread);
  write('threads.json', threads);
  res.json(thread);
});

router.get('/threads', authRequired, (req, res) => {
  const threads = read('threads.json');
  const categoryId = req.query.categoryId;
  const filtered = categoryId ? threads.filter(t => t.categoryId === categoryId) : threads;

  // NEW: pinned-first ordering, keep relative order otherwise
  const ordered = [...filtered].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (bp !== ap) return bp - ap; // pinned (1) first
    // tie-breaker: createdAt ascending (or leave as-is if you prefer)
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });

  res.json(ordered);
});

// Create a post
router.post('/threads/:id/posts', authRequired, (req, res) => {
  const schema = z.object({ content: z.string().min(1) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid input' });

  const threads = read('threads.json');
  const idx = threads.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Thread not found' });

  const post = {
    id: nanoid(),
    userId: req.user.id,
    content: parse.data.content,
    createdAt: Date.now(),
    reports: 0
  };

  threads[idx].posts.push(post);
  write('threads.json', threads);
  res.json(post);
});

// Report a thread
router.post('/threads/:id/report', authRequired, (req, res) => {
  const threads = read('threads.json');
  const idx = threads.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Thread not found' });
  threads[idx].reports = (threads[idx].reports || 0) + 1;
  write('threads.json', threads);
  res.json({ ok: true, reports: threads[idx].reports });
});

// Report a post
router.post('/threads/:id/posts/:postId/report', authRequired, (req, res) => {
  const threads = read('threads.json');
  const idx = threads.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Thread not found' });
  const p = threads[idx].posts.find(p => p.id === req.params.postId);
  if (!p) return res.status(404).json({ error: 'Post not found' });
  p.reports = (p.reports || 0) + 1;
  write('threads.json', threads);
  res.json({ ok: true, reports: p.reports });
});

// Moderator review
router.get('/reports', authRequired, modOnly, (req, res) => {
  const threads = read('threads.json');
  const reportedThreads = threads.filter(t => (t.reports || 0) > 0);
  const reportedPosts = [];
  threads.forEach(t => t.posts.forEach(p => { if ((p.reports || 0) > 0) reportedPosts.push({ threadId: t.id, ...p }); }));
  res.json({ threads: reportedThreads, posts: reportedPosts });
});

// Clear reports for a thread and its posts
router.post('/threads/:id/clearReports', authRequired, modOnly, (req, res) => {
  const threads = read('threads.json');
  const idx = threads.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Thread not found' });
  threads[idx].reports = 0;
  threads[idx].posts.forEach(p => p.reports = 0);
  write('threads.json', threads);
  res.json({ ok: true });
});

// ===== POST: EDIT =====
router.patch('/threads/:id/posts/:postId', authRequired, (req, res) => {
  const { id, postId } = req.params;
  const { content } = req.body || {};
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: 'content is required' });
  }

  const threads = read('threads.json');
  const tIdx = threads.findIndex(t => t.id === id);
  if (tIdx === -1) return res.status(404).json({ error: 'Thread not found' });

  const pIdx = threads[tIdx].posts.findIndex(p => p.id === postId);
  if (pIdx === -1) return res.status(404).json({ error: 'Post not found' });

  const post = threads[tIdx].posts[pIdx];

  // permissions: post owner OR moderator/admin
  const isOwner = String(post.userId) === String(req.user.id);
  const isModOrAdmin = req.user.role === 'moderator' || req.user.role === 'admin';
  if (!isOwner && !isModOrAdmin) {
    return res.status(403).json({ error: 'Not allowed to edit' });
  }

  post.content = String(content).trim();
  post.updatedAt = Date.now();
  write('threads.json', threads);

  res.json({ ok: true, post });
});

// ===== POST: DELETE/REMOVE =====
router.delete('/threads/:id/posts/:postId', authRequired, (req, res) => {
  const { id, postId } = req.params;

  const threads = read('threads.json');
  const tIdx = threads.findIndex(t => t.id === id);
  if (tIdx === -1) return res.status(404).json({ error: 'Thread not found' });

  const pIdx = threads[tIdx].posts.findIndex(p => p.id === postId);
  if (pIdx === -1) return res.status(404).json({ error: 'Post not found' });

  const post = threads[tIdx].posts[pIdx];

  // permissions: post owner, thread owner, or moderator/admin
  const isPostOwner   = String(post.userId) === String(req.user.id);
  const isThreadOwner = String(threads[tIdx].creatorId) === String(req.user.id);
  const isModOrAdmin  = req.user.role === 'moderator' || req.user.role === 'admin';

  if (!(isPostOwner || isThreadOwner || isModOrAdmin)) {
    return res.status(403).json({ error: 'Not allowed to delete' });
  }

  threads[tIdx].posts.splice(pIdx, 1);
  write('threads.json', threads);

  res.json({ ok: true });
});

// ===== THREAD: EDIT (title, pinned) =====
// - title: thread owner OR moderator/admin
// - pinned: moderator/admin ONLY
router.patch('/threads/:id', authRequired, (req, res) => {
  const { id } = req.params;
  const { title, pinned } = req.body || {};

  const threads = read('threads.json');
  const tIdx = threads.findIndex(t => String(t.id) === String(id));
  if (tIdx === -1) return res.status(404).json({ error: 'Thread not found' });

  const thread = threads[tIdx];
  const isThreadOwner = String(thread.creatorId) === String(req.user.id);
  const isModOrAdmin = req.user.role === 'moderator' || req.user.role === 'admin';

  // title change: owner or mod/admin
  if (typeof title !== 'undefined') {
    if (!(isThreadOwner || isModOrAdmin)) {
      return res.status(403).json({ error: 'Not allowed to edit title' });
    }
    const t = String(title).trim();
    if (!t) return res.status(400).json({ error: 'title cannot be empty' });
    thread.title = t;
  }

  // pinned change: mod/admin only
  if (typeof pinned !== 'undefined') {
    if (!isModOrAdmin) {
      return res.status(403).json({ error: 'Not allowed to pin/unpin' });
    }
    thread.pinned = !!pinned;
  }

  thread.updatedAt = Date.now();
  write('threads.json', threads);
  return res.json({ ok: true, thread });
});

// ===== THREAD: DELETE =====
// permissions: thread owner OR moderator/admin
router.delete('/threads/:id', authRequired, (req, res) => {
  const { id } = req.params;

  const threads = read('threads.json');
  const tIdx = threads.findIndex(t => String(t.id) === String(id));
  if (tIdx === -1) return res.status(404).json({ error: 'Thread not found' });

  const thread = threads[tIdx];
  const isThreadOwner = String(thread.creatorId) === String(req.user.id);
  const isModOrAdmin = req.user.role === 'moderator' || req.user.role === 'admin';

  if (!(isThreadOwner || isModOrAdmin)) {
    return res.status(403).json({ error: 'Not allowed to delete thread' });
  }

  threads.splice(tIdx, 1);
  write('threads.json', threads);

  return res.json({ ok: true });
});

// --- Likes for threads and posts ---
router.post('/threads/:id/like', authRequired, (req, res) => {
  const id = req.params.id;
  const threads = read('threads.json');
  const t = threads.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Thread not found' });
  const likes = read('thread_likes.json');
  if (!likes.some(l => l.threadId === id && !l.postId && l.userId === req.user.id)) {
    likes.push({ id: nanoid(), threadId: id, userId: req.user.id, createdAt: Date.now() });
    write('thread_likes.json', likes);
    // Notify thread creator
    const creator = t.creatorId;
    if (creator && creator !== req.user.id) {
      const notifications = read('notifications.json');
      notifications.unshift({ id: nanoid(), userId: creator, type: 'thread_liked', payload: { threadId: id, byUserId: req.user.id }, createdAt: Date.now(), read: false });
      write('notifications.json', notifications);
    }
  }
  res.json({ ok: true });
});
router.delete('/threads/:id/like', authRequired, (req, res) => {
  const id = req.params.id;
  const likes = read('thread_likes.json');
  write('thread_likes.json', likes.filter(l => !(l.threadId === id && !l.postId && l.userId === req.user.id)));
  res.json({ ok: true });
});

router.post('/threads/:id/posts/:postId/like', authRequired, (req, res) => {
  const id = req.params.id, postId = req.params.postId;
  const threads = read('threads.json');
  const t = threads.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Thread not found' });
  const post = (t.posts || []).find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const likes = read('thread_likes.json');
  if (!likes.some(l => l.threadId === id && l.postId === postId && l.userId === req.user.id)) {
    likes.push({ id: nanoid(), threadId: id, postId, userId: req.user.id, createdAt: Date.now() });
    write('thread_likes.json', likes);
    // Notify post author
    const toUser = post.userId;
    if (toUser && toUser !== req.user.id) {
      const notifications = read('notifications.json');
      notifications.unshift({ id: nanoid(), userId: toUser, type: 'thread_post_liked', payload: { threadId: id, postId, byUserId: req.user.id }, createdAt: Date.now(), read: false });
      write('notifications.json', notifications);
    }
  }
  res.json({ ok: true });
});
router.delete('/threads/:id/posts/:postId/like', authRequired, (req, res) => {
  const id = req.params.id, postId = req.params.postId;
  const likes = read('thread_likes.json');
  write('thread_likes.json', likes.filter(l => !(l.threadId === id && l.postId === postId && l.userId === req.user.id)));
  res.json({ ok: true });
});

// Decorate thread list with like counts
const originalGetThreads = router.stack.find(l => l.route && l.route.path === '/threads' && l.route.methods.get);
if (originalGetThreads) {
  // no-op; keep original but we will shadow with a new GET handler below
}
router.get('/threads', authRequired, (req, res) => {
  const threads = read('threads.json');
  const likes = read('thread_likes.json');
  const me = req.user.id;
  const out = threads.map(t => {
    const likeCount = likes.filter(l => l.threadId === t.id && !l.postId).length;
    const iLike = likes.some(l => l.threadId === t.id && !l.postId && l.userId === me);
    const posts = (t.posts || []).map(p => {
      const lc = likes.filter(l => l.threadId === t.id && l.postId === p.id).length;
      const il = likes.some(l => l.threadId === t.id && l.postId === p.id && l.userId === me);
      return { ...p, likeCount: lc, iLike: il };
    });
    return { ...t, likeCount, iLike, posts };
  });
  res.json(out);
});


// --- Like toggles ---
function ensureLikesArray(obj) { if (!obj.likes) obj.likes = []; return obj; }

// Like/unlike a thread
router.post('/:threadId/like', authRequired, (req, res) => {
  const threads = read('threads.json') || [];
  const tIdx = threads.findIndex(t => t.id === req.params.threadId);
  if (tIdx === -1) return res.status(404).json({ error: 'Thread not found' });
  const t = ensureLikesArray(threads[tIdx]);
  const i = t.likes.indexOf(req.user.id);
  if (i === -1) t.likes.push(req.user.id); else t.likes.splice(i, 1);
  write('threads.json', threads);
  res.json({ ok: true, liked: i === -1, likes: t.likes.length });
});

// Like/unlike a post
router.post('/:threadId/posts/:postId/like', authRequired, (req, res) => {
  const threads = read('threads.json') || [];
  const tIdx = threads.findIndex(t => t.id === req.params.threadId);
  if (tIdx === -1) return res.status(404).json({ error: 'Thread not found' });
  const thread = threads[tIdx];
  const pIdx = (thread.posts || []).findIndex(p => p.id === req.params.postId);
  if (pIdx === -1) return res.status(404).json({ error: 'Post not found' });
  const post = ensureLikesArray(thread.posts[pIdx]);
  const i = post.likes.indexOf(req.user.id);
  if (i === -1) post.likes.push(req.user.id); else post.likes.splice(i, 1);
  write('threads.json', threads);
  res.json({ ok: true, liked: i === -1, likes: post.likes.length });
});

// Like/unlike a reply
router.post('/:threadId/posts/:postId/replies/:replyId/like', authRequired, (req, res) => {
  const threads = read('threads.json') || [];
  const tIdx = threads.findIndex(t => t.id === req.params.threadId);
  if (tIdx === -1) return res.status(404).json({ error: 'Thread not found' });
  const thread = threads[tIdx];
  const pIdx = (thread.posts || []).findIndex(p => p.id === req.params.postId);
  if (pIdx === -1) return res.status(404).json({ error: 'Post not found' });
  const post = thread.posts[pIdx];
  const rIdx = (post.replies || []).findIndex(r => r.id === req.params.replyId);
  if (rIdx === -1) return res.status(404).json({ error: 'Reply not found' });
  const reply = ensureLikesArray(post.replies[rIdx]);
  const i = reply.likes.indexOf(req.user.id);
  if (i === -1) reply.likes.push(req.user.id); else reply.likes.splice(i, 1);
  write('threads.json', threads);
  res.json({ ok: true, liked: i === -1, likes: reply.likes.length });
});


module.exports = router;
