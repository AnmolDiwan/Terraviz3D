import { Router } from 'express';
import { earthquakesHandler, countriesHandler } from '../controllers/geo.controller.js';

const router = Router();

router.get('/earthquakes', earthquakesHandler);
router.get('/countries', countriesHandler);

export default router;
