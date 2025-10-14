const fs = require('fs').promises;
const path = require('path');

const defaultFile = path.join(__dirname, '..', 'data', 'adMetrics.json');

async function ensureDirAndFile(filePath = defaultFile) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  try { await fs.access(filePath); }
  catch { await fs.writeFile(filePath, JSON.stringify({}, null, 2), 'utf8'); }
}

async function read(filePath = defaultFile) {
  await ensureDirAndFile(filePath);
  const raw = await fs.readFile(filePath, 'utf8');
  try { return JSON.parse(raw || '{}'); }
  catch { return {}; }
}

async function write(data, filePath = defaultFile) {
  await ensureDirAndFile(filePath);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { read, write, ensureDirAndFile, defaultFile };
