const express = require('express');
const { z } = require('zod');
const { read, write } = require('../utils/db');
const { nanoid } = require('nanoid');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

/**
 * List jobs with optional ?q= search
 */
router.get('/', authRequired, (req, res) => {
  const jobs = read('jobs.json');
  const q = (req.query.q || '').toLowerCase();
  let out = jobs.filter(j => {
    const hay = [
      j.title || '',
      j.company || '',
      (j.skills || []).join(','),
      j.location || '',
      j.description || ''
    ].join(' ').toLowerCase();
    return !q || hay.includes(q);
  });
  out = out
    .slice()
    .sort((a, b) =>
      (b.featured === true) - (a.featured === true) ||
      (b.createdAt || 0) - (a.createdAt || 0)
    );
  res.json(out);
});

/**
 * Get a single job by id
 */
router.get('/:id', authRequired, (req, res) => {
  const jobs = read('jobs.json');
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

/**
 * Create a job posting (relaxed validation)
 */
const JobInput = z.object({
  title: z.coerce.string().trim().optional(),
  company: z.coerce.string().trim().optional(),
  type: z.coerce.string().trim().optional(),
  url: z.coerce.string().trim().optional(),
  description: z.coerce.string().trim().optional(),
  // Accept array of strings or single comma-separated string
  skills: z.union([z.array(z.coerce.string().trim()), z.coerce.string().trim()]).optional(),
  location: z.coerce.string().trim().optional(),
  salaryMin: z.coerce.number().optional(),
  salaryMax: z.coerce.number().optional(),
  remote: z.coerce.boolean().optional(),
});

router.post('/', authRequired, (req, res) => {
  const parsed = JobInput.safeParse(req.body);
  const data = parsed.success
    ? parsed.data
    : (typeof req.body === 'object' && req.body ? req.body : {});

  // Normalize skills to array<string>
  let skills = [];
  if (Array.isArray(data.skills)) {
    skills = data.skills.filter(Boolean);
  } else if (typeof data.skills === 'string' && data.skills.trim()) {
    skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
  }

  const job = {
    id: nanoid(),
    creatorId: req.user.id,
    title: (data.title && String(data.title).trim()) || 'Untitled Role',
    company: (data.company && String(data.company).trim()) || 'Unknown',
    type: (data.type && String(data.type).trim()) || 'gig',
    url: (data.url && String(data.url).trim()) || '',
    description: (data.description && String(data.description).trim()) || '',
    skills,
    location: (data.location && String(data.location).trim()) || '',
    salaryMin: typeof data.salaryMin === 'number' && !Number.isNaN(data.salaryMin) ? data.salaryMin : undefined,
    salaryMax: typeof data.salaryMax === 'number' && !Number.isNaN(data.salaryMax) ? data.salaryMax : undefined,
    remote: typeof data.remote === 'boolean' ? data.remote : true,
    reports: 0,
    featured: false,
    createdAt: Date.now(),
  };

  const jobs = read('jobs.json');
  jobs.unshift(job);
  write('jobs.json', jobs);
  res.json(job);
});

/**
 * Report a job
 */
router.post('/:id/report', authRequired, (req, res) => {
  const jobs = read('jobs.json');
  const idx = jobs.findIndex(j => j.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Job not found' });
  jobs[idx].reports = (jobs[idx].reports || 0) + 1;
  write('jobs.json', jobs);
  res.json({ ok: true, reports: jobs[idx].reports });
});

/**
 * Apply to a job: sends a DM to the job poster with application details.
 */
router.post('/:id/apply', authRequired, (req, res) => {
  const jobs = read('jobs.json');
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const posterId = job.creatorId;
  if (!posterId) return res.status(400).json({ error: 'Job does not have a poster' });

  const schema = z.object({
    skills: z.union([z.string(), z.array(z.string())]).optional(),
    resumeText: z.string().optional(),
    resumeUrl: z.string().optional(),
    coverLetter: z.string().optional(),
    contact: z.string().optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { skills = [], resumeText = '', resumeUrl = '', coverLetter = '', contact = '' } = parsed.data;
  const skillsArr = Array.isArray(skills)
    ? skills
    : (skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : []);

  // Find or create a DM conversation
  const convos = read('dm_conversations.json');
  let convo = convos.find(c => c.participants.includes(req.user.id) && c.participants.includes(posterId));
  if (!convo) {
    convo = {
      id: nanoid(),
      participants: [req.user.id, posterId],
      createdAt: Date.now(),
      lastMessageAt: Date.now()
    };
    convos.push(convo);
    write('dm_conversations.json', convos);
  }

  // Compose message content
  const lines = [];
  lines.push(`📌 Job Application for "${job.title}" @ ${job.company}`);
  lines.push(`Link: /jobs/${job.id}`);
  if (contact) lines.push(`Contact: ${contact}`);
  if (skillsArr.length) lines.push(`Skills: ${skillsArr.join(', ')}`);
  if (resumeUrl) lines.push(`Resume: ${resumeUrl}`);
  if (resumeText) lines.push(`Resume Text:\n${resumeText.slice(0, 4000)}`);
  if (coverLetter) lines.push(`Cover Letter:\n${coverLetter.slice(0, 4000)}`);
  const content = lines.join('\n');

  // Store DM message (include both fields for compatibility)
  const messages = read('dm_messages.json');
  const msg = {
    id: nanoid(),
    conversationId: convo.id,
    fromUserId: req.user.id,         // ✅ used by updated dm/messages flows
    senderId: req.user.id,           // ✅ backward-compat with older UI
    content,
    media: [],
    createdAt: Date.now(),
    readBy: [req.user.id]
  };
  messages.push(msg);
  write('dm_messages.json', messages);

  // Update convo lastMessageAt
  const convos2 = read('dm_conversations.json').map(c =>
    c.id === convo.id ? { ...c, lastMessageAt: msg.createdAt } : c
  );
  write('dm_conversations.json', convos2);

  // Create a notification for the poster
  const notifications = read('notifications.json');
  notifications.push({
    id: nanoid(),
    userId: posterId,
    type: 'job_application',
    createdAt: Date.now(),
    read: false,
    payload: { fromUserId: req.user.id, jobId: job.id, conversationId: convo.id }
  });
  write('notifications.json', notifications);

  // Attempt realtime emit if socket.io is available
  try {
    const io = req.app.get('io');
    if (io) {
      // Your original event:
      io.to(`user:${posterId}`).emit('notify', {
        type: 'job_application',
        payload: { jobId: job.id, fromUserId: req.user.id, conversationId: convo.id }
      });
      // For older listeners:
      io.to(`dm:${convo.id}`).emit('dmMessage', { conversationId: convo.id, message: msg });
      // For newer listeners used elsewhere in your app:
      io.to(`dm:${convo.id}`).emit('dm:message', msg);
    }
  } catch {}

  res.json({ ok: true, conversationId: convo.id, messageId: msg.id });
});

module.exports = router;
