const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { PORT, CLIENT_ORIGIN } = require('./config');
const { read, write, ensureFile } = require('./utils/db');
const { nanoid } = require('nanoid');
const path = require('path');
const adsRoutes = require('./routes/ads');

const app = express();
app.use(express.json());
app.set('io', null);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json({ limit: '1mb' }));
app.use(helmet());

// -------- DEV-FRIENDLY CORS (supports 5173/5174) --------
const devOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

function resolveAllowedOrigins() {
  // Allow either an explicit single origin from config OR a comma-separated list
  if (CLIENT_ORIGIN && CLIENT_ORIGIN.includes(',')) {
    return CLIENT_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (CLIENT_ORIGIN) return [CLIENT_ORIGIN];
  // Fallback for dev convenience
  return devOrigins;
}

const allowedOrigins = resolveAllowedOrigins();

app.use(cors({
  origin(origin, cb) {
    // Allow tools like curl/Postman without Origin
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Permit localhost 517x in dev even if not explicitly listed
    if (/^http:\/\/(localhost|127\.0\.0\.1):517\d$/.test(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed: ' + origin));
  },
  credentials: true,
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(rateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === 'production' ? 1000 : 100000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retry = req.rateLimit && req.rateLimit.resetTime ? Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now())/1000)) : 1;
    res.status(429).json({ error: 'Too Many Requests', retryAfter: retry });
  }
}));

function seed() {
  ensureFile('users.json', []);
  ensureFile('projects.json', []);
  ensureFile('messages.json', []);
  ensureFile('categories.json', []);
  ensureFile('threads.json', []);
  ensureFile('jobs.json', []);
  ensureFile('hackathons.json', []);

  const users = read('users.json');
  if (users.length === 0) {
    const bcrypt = require('bcryptjs');
    const admin = {
      id: 'u_admin',
      email: 'admin@collabhub.local',
      passwordHash: bcrypt.hashSync('admin123', 10),
      name: 'Site Admin',
      role: 'admin',
      tier: 'pro',
      banned: false,
      bio: 'Platform owner',
      skills: ['ops','moderation'],
      links: {}, org: 'CodeCommons', isRecruiterVerified: true,
      createdAt: Date.now(),
    };
    const demoUser = {
      id: 'u_demo',
      email: 'demo@collabhub.local',
      passwordHash: bcrypt.hashSync('demo123', 10),
      name: 'Demo Moderator',
      role: 'moderator',
      tier: 'free',
      banned: false,
      bio: 'Excited to collaborate!',
      skills: ['react', 'node', 'express', 'css'],
      links: { github: 'https://github.com/', linkedin: 'https://linkedin.com/', website: '' },
      org: null, isRecruiterVerified: false,
      createdAt: Date.now(),
    };
    write('users.json', [admin, demoUser]);
  }
  const categories = read('categories.json');
  if (categories.length === 0) {
    write('categories.json', [
      { id: 'c_general', name: 'General' },
      { id: 'c_mentorship', name: 'Mentorship' },
      { id: 'c_pitch', name: 'Pitch an Idea' },
    ]);
  }
  const threads = read('threads.json');
  if (threads.length === 0) {
    write('threads.json', [
      { id: 't1', categoryId: 'c_general', title: 'Welcome to CodeCommons', creatorId: 'u_admin', createdAt: Date.now(), posts: [
        { id: nanoid(), userId: 'u_admin', content: "Say hi and share what you're building!", createdAt: Date.now(), reports: 0 }
      ], reports: 0 }
    ]);
  }
  const projects = read('projects.json');
  if (projects.length === 0) {
    write('projects.json', [{
      id: 'p_portfolio',
      title: 'Open Portfolio Builder',
      description: 'A simple generator to publish developer portfolios.',
      tech: ['react', 'vite', 'express'],
      rolesNeeded: ['Frontend', 'Design'],
      repoUrl: '',
      ownerId: 'u_demo',
      members: ['u_demo'],
      tags: ['portfolio','frontend'],
      difficulty: 'beginner',
      mentorshipFriendly: true,
      featured: true,
      tasks: [
        { id: nanoid(), title: 'Scaffold React app', description: '', status: 'done', assigneeId: 'u_demo', creatorId: 'u_demo', createdAt: Date.now() },
        { id: nanoid(), title: 'Design landing page', description: '', status: 'doing', assigneeId: 'u_demo', creatorId: 'u_demo', createdAt: Date.now() },
        { id: nanoid(), title: 'Write README', description: '', status: 'todo', assigneeId: null, creatorId: 'u_demo', createdAt: Date.now() },
      ],
      chatHistory: [
        { id: nanoid(), userId: 'u_demo', content: 'Kicking off!', createdAt: Date.now() }
      ],
      createdAt: Date.now(), updatedAt: Date.now(),
    }]);
  }
  const jobs = read('jobs.json');
  if (jobs.length === 0) {
    write('jobs.json', [{
      id: 'j1',
      title: 'Open Source Maintainer (Volunteer)',
      company: 'Community',
      type: 'gig',
      url: '',
      description: 'Help triage issues and review PRs. Great for portfolio building.',
      creatorId: 'u_demo',
      skills: ['javascript','react'],
      location: 'Remote', remote: true, salaryMin: 0, salaryMax: 0,
      featured: true, reports: 0,
      createdAt: Date.now(),
    }]);
  }
  const hackathons = read('hackathons.json');
  if (hackathons.length === 0) {
    write('hackathons.json', [{
      id: 'h1',
      name: 'Weekly Mini-Build',
      startDate: new Date(Date.now()+86400000).toISOString(),
      endDate: new Date(Date.now()+86400000*3).toISOString(),
      description: 'Build a tiny tool with a friend. Winner gets bragging rights.',
      organizerId: 'u_admin',
      createdAt: Date.now(),
      submissions: [],
      registrations: ['u_demo'],
    }]);
  }
}
seed();

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/ads', adsRoutes);
app.use('/projects', require('./routes/projects'));
app.use('/community', require('./routes/community'));
app.use('/jobs', require('./routes/jobs'));
app.use('/hackathons', require('./routes/hackathons'));
app.use('/search', require('./routes/search'));
app.use('/admin', require('./routes/admin'));
app.get('/', (req, res) => res.json({ ok: true, service: 'CodeCommons API' }));

const serverHttp = http.createServer(app);

// -------- MATCHING Socket.IO CORS --------
const io = new Server(serverHttp, {
  cors: {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (/^http:\/\/(localhost|127\.0\.0\.1):517\d$/.test(origin)) return cb(null, true);
      return cb(new Error('Socket.IO CORS not allowed: ' + origin));
    },
    credentials: true,
    methods: ['GET','POST','PUT','DELETE']
  }
});

io.on('connection', (socket) => {
  socket.on('joinProject', ({ projectId }) => {
    if (!projectId) return;
    socket.join(`project:${projectId}`);
  });
  socket.on('leaveProject', ({ projectId }) => {
    if (!projectId) return;
    socket.leave(`project:${projectId}`);
  });
  socket.on('projectMessage', ({ projectId, message }) => {
    if (!projectId || !message) return;
    const messages = read('messages.json');
    const msg = { id: nanoid(), ...message, projectId, createdAt: Date.now() };
    messages.push(msg);
    write('messages.json', messages);
    const projects = read('projects.json');
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      projects[idx].chatHistory.push({ id: msg.id, userId: msg.userId, content: msg.content, createdAt: msg.createdAt });
      projects[idx].chatHistory = projects[idx].chatHistory.slice(-100);
      projects[idx].updatedAt = Date.now();
      write('projects.json', projects);
    }
    io.to(`project:${projectId}`).emit('projectMessage', msg);
  });
  socket.on('deleteProjectMessage', ({ projectId, messageId, userId }) => {
    if (!projectId || !messageId || !userId) return;
    const messages = read('messages.json').filter(m => !(m.id===messageId && m.userId===userId && m.projectId===projectId));
    write('messages.json', messages);
    const projects = read('projects.json');
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      projects[idx].chatHistory = projects[idx].chatHistory.filter(m => m.id !== messageId);
      write('projects.json', projects);
    }
    io.to(`project:${projectId}`).emit('deleteProjectMessage', { messageId });
  });
});

app.use('/upload', require('./routes/upload'));
app.use('/social', require('./routes/social'));
app.use('/dm', require('./routes/dm'));
app.use('/notifications', require('./routes/notifications'));
app.use('/api', require('./routes/adMetrics'));

// --- SOCKET.IO HANDLERS ---
app.set('io', io);
io.on('connection', (socket) => {
  // join user personal room for notifications
  socket.on('joinUser', (userId) => {
    if (userId) socket.join('user:' + userId);
  });
  socket.on('leaveUser', (userId) => {
    if (userId) socket.leave('user:' + userId);
  });
  // join/leave DM rooms
  socket.on('joinDm', (convoId) => {
    if (convoId) socket.join('dm:' + convoId);
  });
  socket.on('leaveDm', (convoId) => {
    if (convoId) socket.leave('dm:' + convoId);
  });
});

serverHttp.listen(PORT, () => {
  console.log('CodeCommons server running on http://localhost:'+PORT);
});
