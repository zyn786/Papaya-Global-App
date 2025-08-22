import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error:'Unauthenticated' });
  try{
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, name, email }
    next();
  }catch(e){
    return res.status(401).json({ error:'Invalid token' });
  }
}
