import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roles.js';
import { getConfig, saveConfig } from '../controllers/config.controller.js';

const r = Router();
r.use(requireAuth);
r.get('/', getConfig);
r.post('/', requireAdmin, saveConfig);
export default r;
