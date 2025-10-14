const express = require('express');
const { z } = require('zod');
const { read, write } = require('../utils/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const notifications = read('notifications.json').filter(n => n.userId === req.user.id).sort((a,b)=>b.createdAt-a.createdAt);
  res.json(notifications);
});

router.get('/unread-count', (req, res) => {
  const notifications = read('notifications.json').filter(n => n.userId === req.user.id && !n.read);
  res.json({ count: notifications.length });
});

const markSchema = z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() });
router.post('/mark-read', (req, res) => {
  const { ids, all } = markSchema.parse(req.body || {});
  const notifications = read('notifications.json').map(n => {
    if (n.userId !== req.user.id) return n;
    if (all || (ids && ids.includes(n.id))) return { ...n, read: true };
    return n;
  });
  write('notifications.json', notifications);
  res.json({ ok: true });
});

module.exports = router;
