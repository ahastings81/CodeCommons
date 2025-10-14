// dev.js - run server and client concurrently without extra deps
const { spawn } = require('child_process');
const path = require('path');

function run(name, cmd, args, cwd) {
  const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: true });
  p.stdout.on('data', d => process.stdout.write(`[${name}] ${d}`));
  p.stderr.on('data', d => process.stderr.write(`[${name} ERR] ${d}`));
  p.on('exit', code => console.log(`[${name}] exited with code ${code}`));
  return p;
}

const server = run('server', 'npm', ['start'], path.join(__dirname, 'server'));
const client = run('client', 'npm', ['run', 'dev'], path.join(__dirname, 'client'));

function shutdown() {
  if (server) server.kill();
  if (client) client.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
