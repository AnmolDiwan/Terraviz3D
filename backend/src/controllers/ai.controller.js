import * as ragService from '../services/rag.service.js';

export const indexHandler = async (req, res, next) => {
  try {
    const { dataPoints } = req.body;
    if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
      return res.status(400).json({ error: 'dataPoints must be a non-empty array' });
    }
    const count = await ragService.indexDataPoints(dataPoints);
    res.status(200).json({ success: true, message: `Indexed ${count} points` });
  } catch (error) {
    next(error);
  }
};

export const queryHandler = async (req, res, next) => {
  try {
    const { query, layerContext } = req.body;
    if (typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ error: 'query must be a non-empty string' });
    }
    const result = await ragService.ragQuery(query, layerContext);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
