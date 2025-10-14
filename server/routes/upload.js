// server/routes/upload.js
const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const dest = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

/* ---------- helpers ---------- */
const makeStorage = () =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const safe = Date.now() + '_' + file.originalname.replace(/[^\w.\-]/g, '_');
      cb(null, safe);
    }
  });

// Instead of throwing with cb(new Error(...)), mark the request and soft-reject.
// This prevents unhandled errors that would kill the server process.
const softFilter = (predicate, msg) => (req, file, cb) => {
  if (!file || !predicate(file)) {
    req.fileValidationError = msg;
    return cb(null, false); // soft fail
  }
  cb(null, true);
};

/* ---------- avatars: images only (2MB) ---------- */
const avatarUpload = multer({
  storage: makeStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: softFilter(f => /^image\//.test(f.mimetype), 'Only images allowed')
});

router.post('/avatar', authRequired, avatarUpload.single('file'), (req, res) => {
  if (req.fileValidationError) return res.status(400).json({ error: 'invalid_mime', message: req.fileValidationError });
  if (!req.file) return res.status(400).json({ error: 'no_file', message: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

/* ---------- media: images OR videos (50MB) ---------- */
const mediaUpload = multer({
  storage: makeStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: softFilter(
    f => /^image\//.test(f.mimetype) || /^video\//.test(f.mimetype),
    'Only images or videos allowed'
  )
});

router.post('/media', authRequired, mediaUpload.single('file'), (req, res) => {
  if (req.fileValidationError) return res.status(400).json({ error: 'invalid_mime', message: req.fileValidationError });
  if (!req.file) return res.status(400).json({ error: 'no_file', message: 'No file uploaded' });
  const type = /^video\//.test(req.file.mimetype) ? 'video' : 'image';
  res.json({ url: `/uploads/${req.file.filename}`, type });
});

/* ---------- docs: pdf/doc/docx/txt (10MB) ---------- */
const DOC_OK = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);

const docUpload = multer({
  storage: makeStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: softFilter(f => DOC_OK.has(f.mimetype), 'Only PDF, DOC, DOCX, or TXT allowed')
});

router.post('/file', authRequired, docUpload.single('file'), (req, res) => {
  if (req.fileValidationError) return res.status(400).json({ error: 'invalid_mime', message: req.fileValidationError });
  if (!req.file) return res.status(400).json({ error: 'no_file', message: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}`, type: 'file', name: req.file.originalname });
});

module.exports = router;
