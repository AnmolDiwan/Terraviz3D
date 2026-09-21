import * as geoService from '../services/geo.service.js';

export const earthquakesHandler = async (req, res, next) => {
  try {
    const data = await geoService.getEarthquakes();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const countriesHandler = async (req, res, next) => {
  try {
    const data = await geoService.getCountries();
    res.json(data);
  } catch (err) {
    next(err);
  }
};
