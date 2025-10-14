const express = require('express');
const { z } = require('zod');
const { read, write } = require('../utils/db');
const { nanoid } = require('nanoid');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// List all hackathons
router.get('/', authRequired, (req, res) => {
  const list = read('hackathons.json');
  // Ensure legacy entries have votes fields
  const upgraded = list.map(ev => ({
    votes: 0,
    voters: [],
    ...ev,
    votes: typeof ev.votes === 'number' ? ev.votes : (Array.isArray(ev.voters) ? ev.voters.length : (ev.votes || 0)),
    voters: Array.isArray(ev.voters) ? ev.voters : []
  }));
  if (JSON.stringify(upgraded) !== JSON.stringify(list)) {
    write('hackathons.json', upgraded);
  }
  res.json(upgraded);
});

// Get one hackathon by id
router.get('/:id', authRequired, (req, res) => {
  const list = read('hackathons.json');
  const ev = list.find(x => x.id === req.params.id);
  if (!ev) return res.status(404).json({ error: 'Not found' });
  // Backfill votes/voters
  if (typeof ev.votes !== 'number') ev.votes = Array.isArray(ev.voters) ? ev.voters.length : 0;
  if (!Array.isArray(ev.voters)) ev.voters = [];
  res.json(ev);
});

// Create a hackathon
router.post('/', authRequired, (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    description: z.string().optional()
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid input' });
  const list = read('hackathons.json');
  const ev = {
    id: nanoid(),
    organizerId: req.user.id,
    createdAt: Date.now(),
    submissions: [],
    registrations: [],
    votes: 0,
    voters: [],
    ...parse.data
  };
  list.push(ev);
  write('hackathons.json', list);
  res.json(ev);
});

// Vote for a hackathon (one vote per user)
router.post('/:id/vote', authRequired, (req, res) => {
  const list = read('hackathons.json');
  const idx = list.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Hackathon not found' });
  const ev = list[idx];
  if (!Array.isArray(ev.voters)) ev.voters = [];
  if (ev.voters.includes(req.user.id)) {
    return res.json({ ok: true, votes: ev.votes || 0, alreadyVoted: true });
  }
  ev.voters.push(req.user.id);
  ev.votes = (ev.votes || 0) + 1;
  list[idx] = ev;
  write('hackathons.json', list);

  // Notify organizer
  try {
    const notifications = read('notifications.json');
    notifications.push({
      id: nanoid(),
      userId: ev.organizerId,
      type: 'hackathon_vote',
      createdAt: Date.now(),
      read: false,
      payload: { eventId: ev.id, voterId: req.user.id }
    });
    write('notifications.json', notifications);
  } catch {}

  // Emit realtime if available
  try {
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${ev.organizerId}`).emit('notify', { type: 'hackathon_vote', payload: { eventId: ev.id, voterId: req.user.id } });
    }
  } catch {}

  res.json({ ok: true, votes: ev.votes });
});

module.exports = router;
