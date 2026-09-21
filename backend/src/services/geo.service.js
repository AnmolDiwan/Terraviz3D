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

export const getCountries = async () => {
  const TTL = 86400000; // 24 hours
  const now = Date.now();
  if (cache.countries.data && cache.countries.fetchedAt && (now - cache.countries.fetchedAt < TTL)) {
    console.log('[GeoService] Serving countries from cache...');
    return cache.countries.data;
  }
  console.log('[GeoService] Fetching countries from REST Countries...');
  const response = await fetch('https://restcountries.com/v3.1/all?fields=name,population,latlng,capital,region');
  if (!response.ok) throw new Error('Failed to fetch countries');
  const data = await response.json();
  cache.countries.data = data;
  cache.countries.fetchedAt = now;
  return data;
};
