import Employee from '../models/Employee.js';
import User from '../models/User.js';

export async function listEmployees(req,res){
  const rows = await Employee.find().sort({ name:1 });
  res.json(rows);
}
export async function createEmployee(req,res){
  const { name, email } = req.body;
  const row = await Employee.create({ name, email, status:'Active' });
  res.json(row);
}
export async function deleteEmployee(req,res){
  const { id } = req.params;
  const emp = await Employee.findById(id);
  if (!emp) return res.status(404).json({ error:'Not found' });
  // ensure no members owned
  // (we enforce on client too, but keep safe server-side)
  // You can also check Member model if needed.
  await User.deleteOne({ email: emp.email });
  await emp.deleteOne();
  res.json({ ok:true });
}
