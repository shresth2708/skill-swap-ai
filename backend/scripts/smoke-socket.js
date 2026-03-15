const { io } = require('socket.io-client');

/**
 * Minimal websocket smoke test.
 *
 * Usage:
 *   BASE_URL=http://localhost:5001 TOKEN=... node backend/scripts/smoke-socket.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  // eslint-disable-next-line no-console
  console.error('Missing TOKEN env var');
  process.exit(1);
}

const socket = io(BASE_URL, {
  transports: ['websocket'],
  auth: { token: TOKEN },
  timeout: 8000,
});

const done = (code) => {
  try {
    socket.disconnect();
  } catch {}
  process.exit(code);
};

socket.onAny((event, ...args) => {
  // eslint-disable-next-line no-console
  console.log('event', event, args?.[0]);
});

socket.on('connect', () => {
  // eslint-disable-next-line no-console
  console.log('socket connected', socket.id);

  // Ensure server responds (join invalid swap -> should error NOT_FOUND)
  setTimeout(() => {
    socket.emit('chat:join', { swapId: '00000000-0000-0000-0000-000000000000' });
  }, 100);
});

socket.on('chat:error', (payload) => {
  // eslint-disable-next-line no-console
  console.log('chat:error received', payload);
  if (payload?.code === 'NOT_FOUND') return done(0);
  return done(2);
});

socket.on('connect_error', (err) => {
  // eslint-disable-next-line no-console
  console.error('connect_error', err?.message);
  done(3);
});

socket.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('socket error', err);
  done(5);
});

setTimeout(() => {
  // eslint-disable-next-line no-console
  console.error('timeout waiting for chat:error');
  done(4);
}, 8000);

