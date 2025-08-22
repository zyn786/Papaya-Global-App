import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roles.js';
import { listEmployees, createEmployee, deleteEmployee } from '../controllers/employees.controller.js';

const r = Router();
r.use(requireAuth, requireAdmin);
r.get('/', listEmployees);
r.post('/', createEmployee);
r.delete('/:id', deleteEmployee);
export default r;
