const cache = {
  earthquakes: { data: null, fetchedAt: null },
  countries: { data: null, fetchedAt: null }
};

export const getEarthquakes = async () => {
  const TTL = 300000; // 5 minutes
  const now = Date.now();
  if (cache.earthquakes.data && cache.earthquakes.fetchedAt && (now - cache.earthquakes.fetchedAt < TTL)) {
    console.log('[GeoService] Serving earthquakes from cache...');
    return cache.earthquakes.data;
  }
  console.log('[GeoService] Fetching earthquakes from USGS...');
  const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson');
  if (!response.ok) throw new Error('Failed to fetch earthquakes');
  const data = await response.json();
  cache.earthquakes.data = data;
  cache.earthquakes.fetchedAt = now;
  return data;
};

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COUNTRIES_PATH = path.join(__dirname, '..', 'data', 'countries.json');

export const getCountries = async () => {
  const TTL = 86400000; // 24 hours
  const now = Date.now();
  if (cache.countries.data && cache.countries.fetchedAt && (now - cache.countries.fetchedAt < TTL)) {
    console.log('[GeoService] Serving countries from cache...');
    return cache.countries.data;
  }

  // 1. Try local verified dataset first (fast, reliable, offline-ready)
  try {
    if (fs.existsSync(COUNTRIES_PATH)) {
      const raw = fs.readFileSync(COUNTRIES_PATH, 'utf-8');
      const data = JSON.parse(raw);
      cache.countries.data = data;
      cache.countries.fetchedAt = now;
      console.log(`[GeoService] Loaded ${data.length} countries from local dataset.`);
      return data;
    }
  } catch (err) {
    console.warn('[GeoService] Failed to read local countries dataset:', err.message);
  }

  // 2. Fallback to remote mirror
  console.log('[GeoService] Fetching countries data from remote mirror...');
  try {
    const response = await fetch('https://gist.githubusercontent.com/yesoreyeram/2433ce69862f452b9d0460c947ee191f/raw/countries.json');
    if (!response.ok) throw new Error('Remote mirror failed');
    const d = await response.json();
    const mapped = d.map(c => ({
      name: typeof c.name === 'string' ? { common: c.name } : c.name,
      population: c.population || 0,
      latlng: c.latlng || [],
      capital: Array.isArray(c.capital) ? c.capital : (c.capital ? [c.capital] : []),
      region: c.region || ''
    }));
    cache.countries.data = mapped;
    cache.countries.fetchedAt = now;
    return mapped;
  } catch (err) {
    console.error('[GeoService] Failed to fetch countries:', err.message);
    throw err;
  }
};
