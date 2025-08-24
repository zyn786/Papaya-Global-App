// src/controllers/config.controller.js
import Config from '../models/Config.js';
import { publish } from '../utils/realtime.js';

const ALLOWED = ['USD','EUR','GBP','PKR','INR','AED','SAR'];

export async function getConfig(req, res) {
  const cfg = await Config.findOne() || await Config.create({});
  res.json(cfg);
}

export async function saveConfig(req, res) {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  // Accept both currencyCode and currency (alias), normalize & validate
  const raw = (req.body.currencyCode || req.body.currency || 'USD').toUpperCase();
  const currencyCode = ALLOWED.includes(raw) ? raw : 'USD';

  const bonusRate = typeof req.body.bonusRate === 'number' ? req.body.bonusRate : undefined;
  const fixedPerTask = typeof req.body.fixedPerTask === 'number' ? req.body.fixedPerTask : undefined;

  const update = { currencyCode };
  if (bonusRate !== undefined) update.bonusRate = bonusRate;
  if (fixedPerTask !== undefined) update.fixedPerTask = fixedPerTask;

  const cfg = await Config.findOneAndUpdate({}, update, { upsert: true, new: true });
  publish('config:updated', cfg);              // <-- notify clients via SSE
  res.json(cfg);
}
