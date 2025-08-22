// src/routes/transactions.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Transaction from '../models/Transaction.js';
import { addTransaction } from '../controllers/transactions.controller.js';

const r = Router();
r.use(requireAuth);

// Admin → all transactions
// Employee → only transactions where owner === req.user.name (case-insensitive)
r.get('/', async (req, res) => {
  try {
    if (req.user?.role === 'Admin') {
      const rows = await Transaction.find({}).sort({ createdAt: -1 }).lean();
      return res.json(rows);
    }

    const owner = (req.user?.name || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rows = await Transaction.find({
      owner: { $regex: new RegExp(`^${owner}$`, 'i') },
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(rows);
  } catch (e) {
    console.error('list transactions error', e);
    res.status(500).json({ error: 'Failed to list transactions' });
  }
});

// Create stays in the controller (it should enforce ownership rules)
r.post('/', addTransaction);

export default r;
