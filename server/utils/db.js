const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function ensureFile(name, defaultData) {
  const p = path.join(DATA_DIR, name);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(defaultData, null, 2), 'utf-8');
  return p;
}

function read(name) {
  const p = ensureFile(name, []);
  const raw = fs.readFileSync(p, 'utf-8') || '[]';
  try { return JSON.parse(raw); } catch { return []; }
}

function write(name, data) {
  const p = ensureFile(name, []);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { read, write, ensureFile, DATA_DIR };
