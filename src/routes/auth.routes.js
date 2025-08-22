import { Router } from 'express';
import { bootstrapAdmin, login, signup, me, logout } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.post('/bootstrap', bootstrapAdmin);      // only works when no users exist
r.post('/login', login);
r.post('/signup', signup);
r.get('/me', requireAuth, me);
r.post('/logout', requireAuth, logout);
export default r;
