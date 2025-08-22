// src/routes/codes.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listCodes, generate, remove } from '../controllers/codes.controller.js';

const r = Router();
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

r.use(requireAuth);

r.get('/',        requireAdmin, listCodes);
r.post('/generate', requireAdmin, generate);
r.delete('/:id',  requireAdmin, remove);

export default r;
