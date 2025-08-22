// backend/src/server.js
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { connectDB } from '../db.js';
import { requireAuth } from './middleware/auth.js';
import { sseHandler } from './utils/realtime.js';

// ---- API route modules ----
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import employeesRoutes from './routes/employees.routes.js';
import membersRoutes from './routes/members.routes.js';
import transactionsRoutes from './routes/transactions.routes.js';
import codesRoutes from './routes/codes.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import configRoutes from './routes/config.routes.js';

// Resolve dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

// ---- Security (Helmet + CSP tuned for your app) ----
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // all JS is local (no CDN)
        styleSrc: ["'self'", "'unsafe-inline'"], // allow inline style attrs/classes
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"], // fetch + SSE to same origin
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// Expose Chart.js locally as /vendor/chart.umd.js to keep CSP strict
app.use(
  '/vendor',
  express.static(path.resolve(process.cwd(), 'node_modules/chart.js/dist'))
);

// ---- Core middleware ----
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// ---- Realtime stream (SSE) ----
app.get('/api/stream', requireAuth, sseHandler);

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/codes', codesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/config', configRoutes);

// ---- Static frontend (outside backend) ----
// You can point PUBLIC_DIR to anywhere; fallback to ../public (sibling to /backend)
const publicDir =
  process.env.PUBLIC_DIR
    ? path.resolve(process.env.PUBLIC_DIR)
    : path.resolve(__dirname, '../../public');

const indexHtml = path.join(publicDir, 'index.html');

// Serve static assets if the folder exists
if (fs.existsSync(publicDir)) {
  console.log('[static] Serving frontend from:', publicDir);
  app.use(express.static(publicDir, { index: false, extensions: ['html'] }));
} else {
  console.warn('[static] Public directory not found:', publicDir);
}

// Avoid 500s if a browser asks for /favicon.ico and you don’t ship one
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// SPA fallback for any non-API route (only if index.html is present)
app.get(/^\/(?!api\/).*/, (_req, res, next) => {
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  return res
    .status(404)
    .json({ error: `index.html not found at ${indexHtml}` });
});

// ---- Error handler (last) ----
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ---- Start server after DB connects ----
const port = process.env.PORT || 4000;

connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(port, () => {
      console.log('MongoDB connected');
      console.log(`API on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('DB connect failed', err);
    process.exit(1);
  });

  