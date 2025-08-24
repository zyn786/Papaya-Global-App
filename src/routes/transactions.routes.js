// src/routes/transactions.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listTransactions,
  addTransaction,
  updateTransaction,
} from '../controllers/transactions.controller.js';

const r = Router();
r.use(requireAuth);

r.get('/', listTransactions);
r.post('/', addTransaction);
r.patch('/:id', updateTransaction);

export default r;
