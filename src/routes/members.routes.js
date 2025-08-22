import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import Member from '../models/Member.js';
import Transaction from '../models/Transaction.js';
import { publish } from '../utils/realtime.js';

const r = Router();
r.use(requireAuth);

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

/* GET /api/members
   Admin  -> all
   Employee -> only own (case-insensitive, trimmed) */
r.get('/', async (req, res) => {
  try {
    if (req.user?.role === 'Admin') {
      const rows = await Member.find({}).sort({ createdAt: -1 }).lean();
      return res.json(rows);
    }
    const owner = (req.user?.name || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rows = await Member.find({ owner: { $regex: new RegExp(`^${owner}$`, 'i') } })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(rows);
  } catch (e) {
    console.error('list members error', e);
    res.status(500).json({ error: 'Failed to list members' });
  }
});

/* GET /api/members/:id (admin or owner) */
r.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ error: 'Invalid member id' });
    const m = await Member.findById(id).lean();
    if (!m) return res.status(404).json({ error: 'Member not found' });
    if (req.user?.role !== 'Admin' && m.owner !== req.user?.name) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(m);
  } catch (e) {
    console.error('get member error', e);
    res.status(500).json({ error: 'Failed to get member' });
  }
});

/* POST /api/members (create/update) — employees forced to own data, admin free */
r.post('/', async (req, res) => {
  try {
    const { _id, ...payload } = req.body || {};

    if (req.user?.role !== 'Admin') {
      payload.owner = req.user?.name;
      if (_id) {
        const old = await Member.findById(_id).lean();
        if (!old || old.owner !== req.user?.name) return res.status(403).json({ error: 'Forbidden' });
        payload.comm = old.comm;
        payload.bonusRateOverride = typeof old.bonusRateOverride === 'number' ? old.bonusRateOverride : null;
        payload.charges = old.charges || 0;
      }
    }

    if (!payload.owner || !payload.name) {
      return res.status(400).json({ error: 'Owner and name are required' });
    }

    if (_id) {
      if (!isId(_id)) return res.status(400).json({ error: 'Invalid member id' });
      const updated = await Member.findByIdAndUpdate(_id, payload, { new: true, runValidators: true });
      if (!updated) return res.status(404).json({ error: 'Member not found' });
      publish('members:updated', updated);
      return res.json(updated);
    } else {
      const created = await Member.create(payload);
      publish('members:created', created);
      return res.status(201).json(created);
    }
  } catch (e) {
    console.error('save member error', e);
    res.status(500).json({ error: 'Failed to save member' });
  }
});

/* DELETE /api/members/:id — admin or owner; cascade transactions */
r.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ error: 'Invalid member id' });

    const m = await Member.findById(id).lean();
    if (!m) return res.status(404).json({ error: 'Member not found' });
    if (req.user?.role !== 'Admin' && m.owner !== req.user?.name) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await Promise.all([
      Transaction.deleteMany({ memberId: id }),
      Member.deleteOne({ _id: id }),
    ]);

    publish('members:deleted', { _id: id, owner: m.owner, name: m.name });
    publish('transactions:deleted', { memberId: id });
    res.json({ ok: true });
  } catch (e) {
    console.error('delete member error', e);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

export default r;
