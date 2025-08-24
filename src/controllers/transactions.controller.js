// backend/src/controllers/transactions.controller.js
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Member from '../models/Member.js';
import { publish } from '../utils/realtime.js';

const TYPES = ['USDT Top Up', 'Fiat Convert', 'Payout', 'Frozen', 'Runaway'];

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Apply or revert the effect of a transaction on a member's aggregates
async function applyEffect(memberId, type, amount, fee, sign = +1) {
  if (!isId(memberId)) return;

  const inc = { charges: 0, recv: 0, pay: 0, frozen: 0, runaway: 0 };
  const a = num(amount);
  const f = num(fee);

  if (type === 'USDT Top Up' || type === 'Fiat Convert') {
    inc.recv += sign * a;
    if (f > 0) inc.charges += sign * f;
  } else if (type === 'Payout') {
    inc.pay += sign * a;
    if (f > 0) inc.charges += sign * f;
  } else if (type === 'Frozen') {
    inc.frozen += sign * a;
  } else if (type === 'Runaway') {
    inc.runaway += sign * a;
  }

  await Member.updateOne({ _id: memberId }, { $inc: inc });
}

/* =========================================================
 * GET /api/transactions
 * Admin  -> all; optional filters (q, type, owner, member, fromISO, toISO)
 * Employee -> only their own (owner===req.user.name), same filters (minus owner)
 * ======================================================= */
export async function listTransactions(req, res) {
  try {
    const { q, type, owner, member, fromISO, toISO } = req.query || {};
    const find = {};

    // Scope by role
    if (req.user?.role === 'Admin') {
      if (owner) {
        find.owner = { $regex: new RegExp(`^${esc(owner)}$`, 'i') };
      }
    } else {
      const self = (req.user?.name || '').trim();
      find.owner = { $regex: new RegExp(`^${esc(self)}$`, 'i') };
    }

    // Type filter
    if (type && TYPES.includes(type)) {
      find.type = type;
    }

    // Member name filter (partial, case-insensitive)
    if (member) {
      find.member = { $regex: new RegExp(esc(member), 'i') };
    }

    // Free-text search across several fields
    if (q) {
      const rx = new RegExp(esc(q), 'i');
      find.$or = [
        { owner: rx },
        { member: rx },
        { type: rx },
        { note: rx },
        { bankDetails: rx },
        { cryptoAddress: rx },
      ];
    }

    // Date range – use createdAt primarily; also fall back to dateISO if present
    if (fromISO || toISO) {
      const createdAt = {};
      if (fromISO) createdAt.$gte = new Date(fromISO);
      if (toISO) createdAt.$lte = new Date(toISO);
      find.createdAt = createdAt;
    }

    const rows = await Transaction.find(find).sort({ createdAt: -1 }).lean();
    return res.json(rows);
  } catch (e) {
    console.error('list transactions error', e);
    return res.status(500).json({ error: 'Failed to list transactions' });
  }
}

/* =========================================================
 * POST /api/transactions   (create)
 * - Enforces ownership for employees (can only add to their members)
 * - Updates member aggregates
 * - Publishes SSE events
 * ======================================================= */
export async function addTransaction(req, res) {
  try {
    const {
      memberId,
      type,
      amount,
      fee = 0,
      note = '',
      bonusRate = null,
      cryptoAddress = null,
      bankDetails = null,
      dateISO = null, // optional (defaults to now)
    } = req.body || {};

    if (!isId(memberId)) return res.status(400).json({ error: 'Invalid memberId' });
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const m = await Member.findById(memberId).lean();
    if (!m) return res.status(404).json({ error: 'Member not found' });

    // Employee can only create transactions for their own member
    if (req.user?.role !== 'Admin' && m.owner !== req.user?.name) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const nowISO = new Date().toISOString();

    const doc = await Transaction.create({
      memberId,
      member: m.name,
      owner: m.owner,
      type,
      amount: num(amount),
      fee: num(fee),
      note: String(note || ''),
      bonusRate: (bonusRate === null || bonusRate === '') ? null : Number(bonusRate),
      cryptoAddress: cryptoAddress || null,
      bankDetails: bankDetails || null,
      dateISO: dateISO || nowISO,
      createdAt: new Date(), // in case schema doesn’t use timestamps
      updatedAt: new Date(),
    });

    // Update member aggregates
    await applyEffect(memberId, type, amount, fee, +1);

    publish('transactions:created', doc);
    // also push member change so dashboards update immediately
    const freshMember = await Member.findById(memberId).lean();
    if (freshMember) publish('members:updated', freshMember);

    return res.status(201).json(doc);
  } catch (e) {
    console.error('add transaction error', e);
    return res.status(500).json({ error: 'Failed to add transaction' });
  }
}

/* =========================================================
 * PATCH /api/transactions/:id   (Admin only)
 * - Allows editing a transaction
 * - Recomputes deltas on the affected member(s)
 * - Publish SSE
 * ======================================================= */
export async function updateTransaction(req, res) {
  try {
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ error: 'Invalid transaction id' });

    const oldTx = await Transaction.findById(id).lean();
    if (!oldTx) return res.status(404).json({ error: 'Transaction not found' });

    // Editable fields
    const {
      memberId,       // may move to another member
      type,
      amount,
      fee,
      note,
      bonusRate,
      cryptoAddress,
      bankDetails,
      dateISO,        // allow admin to adjust date/time if needed
    } = req.body || {};

    // Prepare the new target member (if changed)
    let newMember = null;
    let targetMemberId = oldTx.memberId.toString();

    if (memberId && memberId !== targetMemberId) {
      if (!isId(memberId)) return res.status(400).json({ error: 'Invalid memberId' });
      newMember = await Member.findById(memberId).lean();
      if (!newMember) return res.status(404).json({ error: 'New member not found' });
      targetMemberId = memberId;
    } else {
      newMember = await Member.findById(targetMemberId).lean();
    }

    // Build the new values object (keeping owner/member in sync with member)
    const newVals = {
      memberId: targetMemberId,
      member: newMember.name,
      owner: newMember.owner,
      type: type ?? oldTx.type,
      amount: num(amount, oldTx.amount),
      fee: num(fee, oldTx.fee),
      note: note !== undefined ? String(note) : oldTx.note,
      bonusRate:
        bonusRate === undefined ? oldTx.bonusRate :
        (bonusRate === null || bonusRate === '') ? null : Number(bonusRate),
      cryptoAddress: cryptoAddress === undefined ? oldTx.cryptoAddress : (cryptoAddress || null),
      bankDetails: bankDetails === undefined ? oldTx.bankDetails : (bankDetails || null),
      dateISO: dateISO || oldTx.dateISO || new Date().toISOString(),
      updatedAt: new Date(),
    };

    // Revert the old effect
    await applyEffect(oldTx.memberId, oldTx.type, oldTx.amount, oldTx.fee, -1);
    // Apply the new effect
    await applyEffect(targetMemberId, newVals.type, newVals.amount, newVals.fee, +1);

    const updated = await Transaction.findByIdAndUpdate(id, { $set: newVals }, { new: true });
    publish('transactions:updated', updated);

    // Notify member aggregate changes for both old and new members
    const oldMemberFresh = await Member.findById(oldTx.memberId).lean();
    if (oldMemberFresh) publish('members:updated', oldMemberFresh);
    const newMemberFresh = await Member.findById(targetMemberId).lean();
    if (newMemberFresh) publish('members:updated', newMemberFresh);

    return res.json(updated);
  } catch (e) {
    console.error('update transaction error', e);
    return res.status(500).json({ error: 'Failed to update transaction' });
  }
}
