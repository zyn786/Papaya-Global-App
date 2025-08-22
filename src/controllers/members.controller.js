import Member from '../models/Member.js';

export async function listMembers(req,res){
  const me = req.user;
  const query = (me.role==='Admin') ? {} : { owner: me.name };
  const rows = await Member.find(query).sort({ owner:1, name:1 });
  res.json(rows);
}
export async function createOrUpdateMember(req,res){
  const me = req.user;
  const payload = req.body;

  if (me.role !== 'Admin') {
    payload.owner = me.name;
    // lock sensitive fields for non-admin edits
    if (payload.bonusRateOverride !== undefined) delete payload.bonusRateOverride;
    if (payload.comm !== undefined) delete payload.comm;
  }
  if (payload._id){
    const row = await Member.findByIdAndUpdate(payload._id, payload, { new:true });
    return res.json(row);
  }
  const row = await Member.create(payload);
  res.json(row);
}
export async function deleteMember(req,res){
  const { id } = req.params;
  await Member.findByIdAndDelete(id);
  res.json({ ok:true });
}
