#!/usr/bin/env node
// ccmonitor hooks notification script
// Usage: node notify.js <type>
// type: waiting | running | completed

const type = process.argv[2] || 'waiting';
const cwd = process.cwd();
const sessionId = process.env.CCMONITOR_SESSION_ID;

fetch('http://localhost:3000/api/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type, cwd, sessionId }),
}).catch(() => {
  // Silently ignore errors (server may not be running)
});
