import { apiFetch } from './api.js';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const aiService = {
  indexPoints: (dataPoints) =>
    apiFetch(`${API_BASE}/api/ai/index`, { method: 'POST', body: JSON.stringify({ dataPoints }) }),
    
  query: (queryText, layerContext) =>
    apiFetch(`${API_BASE}/api/ai/query`, { method: 'POST', body: JSON.stringify({ query: queryText, layerContext }) })
};
