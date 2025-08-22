// src/controllers/codes.controller.js
import InviteCode from '../models/InviteCode.js';
import { publish } from '../utils/realtime.js';

function gen5Digit() {
  // 10000..99999
  return Math.floor(10000 + Math.random() * 90000).toString();
}

export async function listCodes(_req, res) {
  const rows = await InviteCode.find().sort({ createdAt: -1 }).lean();
  res.json(rows);
}

export async function generate(req, res) {
  let count = parseInt(req.body?.count, 10);
  if (!Number.isFinite(count)) count = 1;
  count = Math.max(1, Math.min(count, 50)); // safety cap

  // make sure we don't create duplicates
  const existing = new Set(
    (await InviteCode.find({}, { code: 1, _id: 0 }).lean()).map((x) => x.code)
  );

  const toInsert = [];
  while (toInsert.length < count) {
    const c = gen5Digit();
    if (!existing.has(c)) {
      existing.add(c);
      toInsert.push({ code: c, used: false, issuedTo: '', createdAt: new Date() });
    }
  }

  const docs = await InviteCode.insertMany(toInsert);
  publish('codes:generated', { count: docs.length, codes: docs.map((d) => d.code) });

  res.json({ ok: true, codes: docs.map((d) => d.code) });
}

export async function remove(req, res) {
  const { id } = req.params;
  const del = await InviteCode.findByIdAndDelete(id);
  if (!del) return res.status(404).json({ error: 'Code not found' });
  publish('codes:deleted', { _id: id });
  res.json({ ok: true });
}
