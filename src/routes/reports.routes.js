import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { reportRange, salaryToday } from '../controllers/reports.controller.js';

const r = Router();
r.use(requireAuth);
r.post('/range', reportRange);
r.get('/salary/today', salaryToday);
export default r;
