export function requireAdmin(req, res, next){
  if (req.user?.role !== 'Admin') return res.status(403).json({ error:'Admin only' });
  next();
}

