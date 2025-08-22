import Transaction from '../models/Transaction.js';
import Member from '../models/Member.js';
import Config from '../models/Config.js';
import { buildSalaryRows } from '../utils/salary.js';

export async function reportRange(req,res){
  const me=req.user;
  const { fromISO, toISO } = req.body;
  const q = { dateISO: { $gte:new Date(fromISO), $lte:new Date(toISO) }};
  if (me.role!=='Admin') q.owner = me.name;
  const rows = await Transaction.find(q).sort({ dateISO:-1, createdAt:-1 }).limit(5000);
  res.json(rows);
}

export async function salaryToday(req,res){
  const me=req.user;
  const today = new Date();
  const cfg = await Config.findOne() || { currencyCode:'USD', bonusRate:0.04, fixedPerTask:1 };
  const [transactions, members] = await Promise.all([
    Transaction.find(me.role==='Admin'?{}:{owner:me.name}),
    Member.find(me.role==='Admin'?{}:{owner:me.name})
  ]);
  const rows = buildSalaryRows({ dayISO: today.toISOString(), cfg, transactions, members, onlyOwner: me.role==='Admin'? null : me.name });
  res.json({ rows });
}
