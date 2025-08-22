import { Router } from 'express';
import { requireAuth, } from '../middleware/auth.js';
const r = Router();
r.get('/me', requireAuth, (req,res)=> res.json({ user:req.user }));
export default r;
