const express = require('express');
const { z } = require('zod');
const { nanoid } = require('nanoid');
const { read, write } = require('../utils/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function notify(userId, type, payload = {}) {
  const notifications = read('notifications.json');
  notifications.unshift({ id: nanoid(), userId, type, payload, createdAt: Date.now(), read: false });
  write('notifications.json', notifications);
}

function publicUser(u) {
  const { passwordHash, resetToken, ...rest } = u;
  return rest;
}

function areBlocked(a, b) {
  const blocks = read('blocks.json');
  return blocks.some(x => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));
}

router.use(authRequired);

// Get friends (accepted only)
router.get('/friends', (req, res) => {
  const friends = read('friends.json').filter(f => f.status === 'accepted' && (f.userA === req.user.id || f.userB === req.user.id));
  const users = read('users.json');
  const list = friends.map(f => {
    const otherId = f.userA === req.user.id ? f.userB : f.userA;
    const user = users.find(u => u.id === otherId);
    return { id: f.id, user: user ? publicUser(user) : { id: otherId }, since: f.acceptedAt };
  });
  res.json(list);
});

const requestSchema = z.object({ toUserId: z.string().min(1) });

router.post('/friends/request', (req, res) => {
  const { toUserId } = requestSchema.parse(req.body);
  if (toUserId === req.user.id) return res.status(400).json({ error: 'Cannot friend yourself' });
  if (areBlocked(req.user.id, toUserId)) return res.status(403).json({ error: 'User is blocked' });
  const friends = read('friends.json');
  const exists = friends.find(f => (f.userA === req.user.id && f.userB === toUserId) || (f.userA === toUserId && f.userB === req.user.id));
  if (exists) return res.json({ ok: true, id: exists.id, status: exists.status });
  const fr = { id: nanoid(), userA: req.user.id, userB: toUserId, status: 'pending', requestedBy: req.user.id, createdAt: Date.now(), acceptedAt: null };
  friends.unshift(fr);
  write('friends.json', friends);
  notify(toUserId, 'friend_request', { fromUserId: req.user.id, friendRequestId: fr.id });
  res.json({ ok: true, id: fr.id, status: 'pending' });
});

const respondSchema = z.object({ requestId: z.string().min(1), action: z.enum(['accept', 'deny']) });

router.post('/friends/respond', (req, res) => {
  const { requestId, action } = respondSchema.parse(req.body);
  const friends = read('friends.json');
  const idx = friends.findIndex(f => f.id === requestId);
  if (idx === -1) return res.status(404).json({ error: 'Request not found' });
  const fr = friends[idx];
  if (!(fr.userA === req.user.id || fr.userB === req.user.id)) return res.status(403).json({ error: 'Not authorized' });
  if (action === 'accept') {
    fr.status = 'accepted';
    fr.acceptedAt = Date.now();
    friends[idx] = fr;
    write('friends.json', friends);
    const otherId = fr.userA === req.user.id ? fr.userB : fr.userA;
    notify(otherId, 'friend_accepted', { byUserId: req.user.id, friendRequestId: fr.id });
    return res.json({ ok: true, status: 'accepted' });
  } else {
    fr.status = 'denied';
    friends[idx] = fr;
    write('friends.json', friends);
    const otherId = fr.userA === req.user.id ? fr.userB : fr.userA;
    notify(otherId, 'friend_denied', { byUserId: req.user.id, friendRequestId: fr.id });
    return res.json({ ok: true, status: 'denied' });
  }
});

router.get('/friends/requests', (req, res) => {
  const friends = read('friends.json');
  const incoming = friends.filter(f => f.status === 'pending' && f.requestedBy !== req.user.id && (f.userA === req.user.id || f.userB === req.user.id));
  const outgoing = friends.filter(f => f.status === 'pending' && f.requestedBy === req.user.id);
  res.json({ incoming, outgoing });
});

router.delete('/friends/:friendUserId', (req, res) => {
  const friendUserId = req.params.friendUserId;
  const friends = read('friends.json');
  const idx = friends.findIndex(f => (f.userA === req.user.id && f.userB === friendUserId) || (f.userA === friendUserId && f.userB === req.user.id));
  if (idx === -1) return res.status(404).json({ error: 'Friendship not found' });
  const removed = friends.splice(idx, 1)[0];
  write('friends.json', friends);
  notify(friendUserId, 'friend_removed', { byUserId: req.user.id });
  res.json({ ok: true, removed: removed.id });
});

// Follow
const followSchema = z.object({ userId: z.string().min(1) });
router.post('/follow', (req, res) => {
  const { userId } = followSchema.parse(req.body);
  if (userId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });
  if (areBlocked(req.user.id, userId)) return res.status(403).json({ error: 'User is blocked' });
  const follows = read('follows.json');
  if (follows.some(f => f.followerId === req.user.id && f.followingId === userId)) return res.json({ ok: true });
  follows.unshift({ id: nanoid(), followerId: req.user.id, followingId: userId, createdAt: Date.now() });
  write('follows.json', follows);
  notify(userId, 'follow', { followerId: req.user.id });
  res.json({ ok: true });
});
router.post('/unfollow', (req, res) => {
  const { userId } = followSchema.parse(req.body);
  const follows = read('follows.json');
  const idx = follows.findIndex(f => f.followerId === req.user.id && f.followingId === userId);
  if (idx !== -1) { follows.splice(idx, 1); write('follows.json', follows); }
  res.json({ ok: true });
});
router.get('/followers', (req, res) => {
  const follows = read('follows.json').filter(f => f.followingId === req.user.id);
  res.json(follows);
});
router.get('/following', (req, res) => {
  const follows = read('follows.json').filter(f => f.followerId === req.user.id);
  res.json(follows);
});
// --- Simple social feed ---

// POST /social/status  { content }
// POST /social/status  { content, media? }
router.post('/status', authRequired, (req, res) => {
  const users = read('users.json');
  const me = users.find(u => u.id === req.user.id);
  const content = (req.body?.content || '').toString().trim();
  const media = Array.isArray(req.body?.media) ? req.body.media.filter(m => m && m.url && (m.type==='image' || m.type==='video')) : [];

  if (!content && media.length === 0) return res.status(400).json({ error: 'Content or media required' });
  if (content.length > 1000) return res.status(400).json({ error: 'Max length 1000' });

  const feed = read('feed.json');
  const id = nanoid();
  const item = { id, userId: me.id, content, media, createdAt: Date.now(), reports: 0 };
  feed.unshift(item);
  write('feed.json', feed);

  const author = { id: me.id, name: me.name, email: me.email, avatarUrl: me.avatarUrl };
  return res.json({ ...item, author, likes: 0, comments: 0 });
});
router.get('/feed', authRequired, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = 20;

  const users = read('users.json');
  const follows = read('follows.json'); // { userId, followingId }
  const blocks = read('blocks.json');   // { userId, blockedId }
  const feed = read('feed.json');       // { id, userId, content, createdAt }

  const me = req.user.id;

  // who I follow (plus me)
  const followingIds = new Set(
    follows.filter(f => f.followerId === me).map(f => f.followingId)
  );
  followingIds.add(me);
  const friendPairs = read('friends.json').filter(f => f.status === 'accepted' && (f.userA === me || f.userB === me));
  for (const f of friendPairs) { followingIds.add(f.userA === me ? f.userB : f.userA); }

  // block filters (both directions)
  const blockedByMe = new Set(blocks.filter(b => b.userId === me).map(b => b.blockedId));
  const blockedMe   = new Set(blocks.filter(b => b.blockedId === me).map(b => b.userId));

  const visible = feed
    .filter(it => followingIds.has(it.userId))
    .filter(it => !blockedByMe.has(it.userId) && !blockedMe.has(it.userId))
    .sort((a,b) => (b.createdAt||0) - (a.createdAt||0));

  const start = (page - 1) * pageSize;
  const likes = read('feed_likes.json');
  const commentsAll = read('feed_comments.json');
  const items = visible.slice(start, start + pageSize).map(it => {
    const u = users.find(x => x.id === it.userId) || {};
    const likeCount = likes.filter(l => l.postId === it.id).length;
    const commentsCount = commentsAll.filter(c => c.postId === it.id).length;
    const iLike = likes.some(l => l.postId === it.id && l.userId === me);
    return {
      ...it,
      likeCount,
      commentsCount,
      iLike,
      author: { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl }
    };
  });

  res.json({
    items,
    hasMore: start + pageSize < visible.length
  });
});

// Block list
router.get('/blocked', (req, res) => {
  const blocks = read('blocks.json').filter(b => b.blockerId === req.user.id);
  res.json(blocks);
});
router.post('/block', (req, res) => {
  const { userId } = followSchema.parse(req.body);
  if (userId === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });
  const blocks = read('blocks.json');
  if (!blocks.some(b => b.blockerId === req.user.id && b.blockedId === userId)) {
    blocks.unshift({ id: nanoid(), blockerId: req.user.id, blockedId: userId, createdAt: Date.now() });
    write('blocks.json', blocks);
  }
  // Remove friendships and pending requests
  const friends = read('friends.json').filter(f => !((f.userA === req.user.id && f.userB === userId) || (f.userA === userId && f.userB === req.user.id)));
  write('friends.json', friends);
  notify(userId, 'blocked', { byUserId: req.user.id });
  res.json({ ok: true });
});
router.post('/unblock', (req, res) => {
  const { userId } = followSchema.parse(req.body);
  const blocks = read('blocks.json');
  const idx = blocks.findIndex(b => b.blockerId === req.user.id && b.blockedId === userId);
  if (idx !== -1) { blocks.splice(idx, 1); write('blocks.json', blocks); }
  res.json({ ok: true });
});


// === Feed: likes, comments, edit/delete, report ===

// Helpers
function postById(id) {
  const feed = read('feed.json');
  return { feed, idx: feed.findIndex(p => p.id === id) };
}
function ensureNotBlocked(actorId, ownerId) {
  const blocks = read('blocks.json');
  const blockedByActor = blocks.some(b => b.blockerId === actorId && b.blockedId === ownerId);
  const blockedActor   = blocks.some(b => b.blockerId === ownerId && b.blockedId === actorId);
  if (blockedByActor || blockedActor) {
    const e = new Error('User is blocked');
    e.status = 403;
    throw e;
  }
}

// PUT /social/status/:id  (author only)
router.put('/status/:id', authRequired, (req, res) => {
  const { content } = req.body || {};
  if (!content || String(content).trim().length === 0) return res.status(400).json({ error: 'Content required' });
  const { feed, idx } = postById(req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const post = feed[idx];
  if (post.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  post.content = String(content).trim();
  post.editedAt = Date.now();
  feed[idx] = post;
  write('feed.json', feed);
  res.json(post);
});

// DELETE /social/status/:id  (author only)
router.delete('/status/:id', authRequired, (req, res) => {
  const { feed, idx } = postById(req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const post = feed[idx];
  if (post.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const id = post.id;
  feed.splice(idx, 1);
  write('feed.json', feed);
  // cascade delete likes and comments
  const likes = read('feed_likes.json').filter(l => l.postId !== id);
  write('feed_likes.json', likes);
  const comments = read('feed_comments.json').filter(c => c.postId !== id);
  write('feed_comments.json', comments);
  res.json({ ok: true });
});

// POST /social/status/:id/like
router.post('/status/:id/like', authRequired, (req, res) => {
  const { feed, idx } = postById(req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const post = feed[idx];
  try { ensureNotBlocked(req.user.id, post.userId); } catch (e) { return res.status(e.status || 403).json({ error: e.message }); }
  const likes = read('feed_likes.json');
  if (!likes.some(l => l.postId === post.id && l.userId === req.user.id)) {
    likes.push({ id: nanoid(), postId: post.id, userId: req.user.id, createdAt: Date.now() });
    write('feed_likes.json', likes);
    notify(post.userId, 'post_liked', { postId: post.id, byUserId: req.user.id });
  }
  res.json({ ok: true });
});

// DELETE /social/status/:id/like
router.delete('/status/:id/like', authRequired, (req, res) => {
  const likes = read('feed_likes.json');
  const len = likes.length;
  const filtered = likes.filter(l => !(l.postId === req.params.id && l.userId === req.user.id));
  if (filtered.length !== len) write('feed_likes.json', filtered);
  res.json({ ok: true });
});

// GET /social/status/:id/comments
router.get('/status/:id/comments', authRequired, (req, res) => {
  const id = req.params.id;
  const commentsAll = read('feed_comments.json').filter(c => c.postId === id);
  const likes = read('feed_likes.json');
  const me = req.user.id;
  const out = commentsAll.map(c => {
    const likeCount = likes.filter(l => l.commentId === c.id).length;
    const iLike = likes.some(l => l.commentId === c.id && l.userId === me);
    return { ...c, likeCount, iLike };
  });
  res.json(out);
});


// POST /social/status/:id/comments
router.post('/status/:id/comments', authRequired, (req, res) => {
  const { content } = req.body || {};
  const { feed, idx } = postById(req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const post = feed[idx];
  try { ensureNotBlocked(req.user.id, post.userId); } catch (e) { return res.status(e.status || 403).json({ error: e.message }); }
  const text = String(content || '').trim();
  if (!text) return res.status(400).json({ error: 'Content required' });
  const comments = read('feed_comments.json');
  const id = nanoid();
  const c = { id, postId: post.id, userId: req.user.id, content: text, createdAt: Date.now(), reports: 0 };
  comments.push(c);
  write('feed_comments.json', comments);
  notify(post.userId, 'comment', { postId: post.id, byUserId: req.user.id, commentId: id });
  const users = read('users.json');
  const u = users.find(x => x.id === req.user.id) || {};
  res.json({ ...c, author: { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl } });
});

// PUT /social/status/:postId/comments/:commentId  (author only)
router.put('/status/:postId/comments/:commentId', authRequired, (req, res) => {
  const { content } = req.body || {};
  const comments = read('feed_comments.json');
  const idx = comments.findIndex(c => c.id === req.params.commentId && c.postId === req.params.postId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (comments[idx].userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const text = String(content || '').trim();
  if (!text) return res.status(400).json({ error: 'Content required' });
  comments[idx].content = text;
  comments[idx].editedAt = Date.now();
  write('feed_comments.json', comments);
  res.json(comments[idx]);
});

// DELETE /social/status/:postId/comments/:commentId  (author only)
router.delete('/status/:postId/comments/:commentId', authRequired, (req, res) => {
  const comments = read('feed_comments.json');
  const idx = comments.findIndex(c => c.id === req.params.commentId && c.postId === req.params.postId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (comments[idx].userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  comments.splice(idx, 1);
  write('feed_comments.json', comments);
  res.json({ ok: true });
});

// Report post
router.post('/status/:id/report', authRequired, (req, res) => {
  const { reason } = req.body || {};
  const { feed, idx } = postById(req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const post = feed[idx];
  if (post.userId === req.user.id) return res.status(400).json({ error: 'Cannot report your own content' });
  post.reports = (post.reports || 0) + 1;
  const reports = read('reports.json');
  reports.unshift({ id: nanoid(), type: 'feed_post', targetId: post.id, byUserId: req.user.id, reason: String(reason||'').slice(0,200), createdAt: Date.now() });
  write('reports.json', reports);
  feed[idx] = post;
  write('feed.json', feed);
  res.json({ ok: true });
});

// Report comment
router.post('/status/:postId/comments/:commentId/report', authRequired, (req, res) => {
  const { reason } = req.body || {};
  const comments = read('feed_comments.json');
  const idx = comments.findIndex(c => c.id === req.params.commentId && c.postId === req.params.postId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (comments[idx].userId === req.user.id) return res.status(400).json({ error: 'Cannot report your own content' });
  comments[idx].reports = (comments[idx].reports || 0) + 1;
  write('feed_comments.json', comments);
  const reports = read('reports.json');
  reports.unshift({ id: nanoid(), type: 'feed_comment', targetId: comments[idx].id, postId: comments[idx].postId, byUserId: req.user.id, reason: String(reason||'').slice(0,200), createdAt: Date.now() });
  write('reports.json', reports);
  res.json({ ok: true });
});



// GET /social/status/:id  -> one post with author + counts
router.get('/status/:id', authRequired, (req, res) => {
  const users = read('users.json');
  const feed = read('feed.json');
  const likes = read('feed_likes.json');
  const commentsAll = read('feed_comments.json');
  const me = req.user.id;

  const post = feed.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });

  // block check both ways
  const blocks = read('blocks.json');
  const blockedByMe = blocks.some(b => b.blockerId === me && b.blockedId === post.userId);
  const blockedMe   = blocks.some(b => b.blockerId === post.userId && b.blockedId === me);
  if (blockedByMe || blockedMe) return res.status(403).json({ error: 'User is blocked' });

  const u = users.find(x => x.id === post.userId) || {};
  const likeCount = likes.filter(l => l.postId === post.id).length;
  const iLike = likes.some(l => l.postId === post.id && l.userId === me);
  const commentsCount = commentsAll.filter(c => c.postId === post.id).length;

  res.json({
    ...post,
    likeCount, commentsCount, iLike,
    author: { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl }
  });
});



// Like/Unlike a comment (Bit)
router.post('/status/:postId/comments/:commentId/like', authRequired, (req, res) => {
  const postId = req.params.postId, commentId = req.params.commentId;
  const comments = read('feed_comments.json');
  const c = comments.find(x => x.id === commentId && x.postId === postId);
  if (!c) return res.status(404).json({ error: 'Comment not found' });
  const likes = read('feed_likes.json');
  if (!likes.some(l => l.commentId === commentId && l.userId === req.user.id)) {
    likes.push({ id: nanoid(), postId, commentId, userId: req.user.id, createdAt: Date.now() });
    write('feed_likes.json', likes);
    notify(c.userId, 'comment_liked', { postId, commentId, byUserId: req.user.id });
  }
  res.json({ ok: true });
});
router.delete('/status/:postId/comments/:commentId/like', authRequired, (req, res) => {
  const postId = req.params.postId, commentId = req.params.commentId;
  const likes = read('feed_likes.json');
  const filtered = likes.filter(l => !(l.commentId === commentId && l.userId === req.user.id));
  write('feed_likes.json', filtered);
  res.json({ ok: true });
});

module.exports = router;
