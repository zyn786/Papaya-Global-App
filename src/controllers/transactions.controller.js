import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Member from '../models/Member.js';

const VALID_TYPES = ['Fiat Convert', 'Payout', 'USDT Top Up', 'Frozen', 'Runaway'];

export async function listTransactions(req, res) {
  try {
    const filter = (req.user?.role === 'Admin') ? {} : { owner: req.user?.name };
    // newest first; cap list so we don't overload the UI
    const rows = await Transaction.find(filter).sort({ dateISO: -1 }).limit(500);
    res.json(rows);
  } catch (e) {
    console.error('listTransactions error', e);
    res.status(500).json({ error: 'Failed to list transactions' });
  }
}

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
    } = req.body || {};

    // ---- validation ----
    if (!mongoose.isValidObjectId(memberId)) {
      return res.status(400).json({ error: 'Invalid memberId' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid transaction type: ${type}` });
    }
    const amt = Number(amount);
    if (!(amt >= 0)) {
      return res.status(400).json({ error: 'Amount must be a number >= 0' });
    }
    const feeNum = Number(fee) || 0;

    // ---- fetch member & ACL ----
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (req.user?.role !== 'Admin' && member.owner !== req.user?.name) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ---- apply totals on the member ----
    if (type === 'USDT Top Up' || type === 'Fiat Convert') {
      member.recv = (member.recv || 0) + amt;
    } else if (type === 'Payout') {
      member.pay = (member.pay || 0) + amt;
    } else if (type === 'Frozen') {
      member.frozen = (member.frozen || 0) + amt;
    } else if (type === 'Runaway') {
      member.runaway = (member.runaway || 0) + amt;
    }
    if (feeNum > 0) {
      member.charges = (member.charges || 0) + feeNum;
    }
    await member.save();

    // ---- create transaction row ----
    const row = await Transaction.create({
      owner: member.owner,
      member: member.name,
      memberId: member._id,
      type,
      amount: amt,
      fee: feeNum,
      bonusRate,
      cryptoAddress,
      bankDetails,
      note,
      dateISO: new Date().toISOString(),
    });

    // ---- push realtime event if bus is present ----
    try {
      if (req.bus) req.bus.emit('event', { type: 'transactions:created', payload: row });
    } catch {}

    return res.status(201).json(row);
  } catch (e) {
    console.error('addTransaction error', e);
    res.status(500).json({ error: e.message || 'Failed to add transaction' });
  }
}
