import { apiFetch } from './api.js';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const geoService = {
  getEarthquakes: () => apiFetch(`${API_BASE}/api/geo/earthquakes`),
  getCountries: () => apiFetch(`${API_BASE}/api/geo/countries`)
};
