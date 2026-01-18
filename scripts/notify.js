#!/usr/bin/env node
// ccmonitor hooks notification script
// Usage: node notify.js <type>
// type: waiting | completed

const type = process.argv[2] || 'waiting';
const cwd = process.cwd();

fetch('http://localhost:3000/api/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type, cwd }),
}).catch(() => {
  // Silently ignore errors (server may not be running)
});
