// backend/src/utils/realtime.js
import { createClient } from 'redis';

// ---- In-process SSE client registry ----
const clients = new Set(); // Set<http.ServerResponse>
let heartbeat;

// Helper: send one SSE event to one client
function send(res, event, payload) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload ?? {})}\n\n`);
  } catch {
    // socket likely closed
    clients.delete(res);
  }
}

// Helper: fanout to all local clients
function sendAll(event, payload) {
  for (const res of clients) send(res, event, payload);
}

// ---- Optional Redis (multi-instance fanout) ----
let pub = null;
let sub = null;
const CHANNEL = 'papaya:sse';

async function initRedis() {
  if (!process.env.REDIS_URL) return;

  pub = createClient({ url: process.env.REDIS_URL });
  sub = createClient({ url: process.env.REDIS_URL });

  pub.on('error', (e) => console.warn('[redis pub] error', e.message));
  sub.on('error', (e) => console.warn('[redis sub] error', e.message));

  await Promise.all([pub.connect(), sub.connect()]);
  await sub.subscribe(CHANNEL, (message) => {
    // Messages coming from other instances -> forward to local SSE clients
    try {
      const { event, data } = JSON.parse(message);
      sendAll(event, data);
    } catch (e) {
      console.warn('[redis sub] bad message', e?.message || e);
    }
  });

  console.log('[realtime] Redis Pub/Sub connected');
}

initRedis().catch((e) => console.warn('[realtime] Redis disabled:', e?.message || e));

// ---- Public API ----

// Express handler for GET /api/stream
export function sseHandler(req, res) {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Register client
  clients.add(res);

  // Greet this client
  send(res, 'hello', { ok: true });

  // Heartbeat comment to keep proxies from closing idle connections
  if (!heartbeat) {
    heartbeat = setInterval(() => {
      for (const r of clients) r.write(':hb\n\n');
    }, 25000);
    heartbeat.unref?.();
  }

  // Clean up on disconnect
  req.on('close', () => {
    clients.delete(res);
    if (!clients.size && heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  });
}

/**
 * Publish an event to all connected clients (and via Redis if configured).
 * @param {string} event - e.g. 'members:created'
 * @param {any} data - JSON-serializable payload
 */
export async function publish(event, data) {
  // Local fanout
  sendAll(event, data);
  // Cross-instance fanout
  if (pub) {
    try {
      await pub.publish(CHANNEL, JSON.stringify({ event, data }));
    } catch (e) {
      console.warn('[redis pub] publish failed:', e?.message || e);
    }
  }
}
