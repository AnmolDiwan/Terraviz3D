import { Router } from 'express';
import requireAuth from '../middleware/auth.js';
import { indexHandler, queryHandler } from '../controllers/ai.controller.js';

const router = Router();

router.post('/index', requireAuth, indexHandler);
router.post('/query', requireAuth, queryHandler);

export default router;
