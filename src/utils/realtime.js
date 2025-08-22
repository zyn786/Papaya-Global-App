// src/utils/realtime.js
import { EventEmitter } from 'node:events';

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function publish(type, payload = {}) {
  bus.emit('event', { type, payload, ts: Date.now() });
}

export function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write('retry: 10000\n');
  res.write('event: hello\n');
  res.write('data: {}\n\n');

  const forward = (evt) => {
    res.write(`event: ${evt.type}\n`);
    res.write(`data: ${JSON.stringify({ ...evt.payload, ts: evt.ts })}\n\n`);
  };

  bus.on('event', forward);
  const ka = setInterval(() => res.write(`: keep-alive ${Date.now()}\n\n`), 25000);

  req.on('close', () => {
    clearInterval(ka);
    bus.off('event', forward);
  });
}
