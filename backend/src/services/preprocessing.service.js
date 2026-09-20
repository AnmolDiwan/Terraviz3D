export const extractRegion = (place) => {
  if (!place) return '';
  const segments = place.split(',');
  return segments[segments.length - 1].trim();
};

export const classifySeverity = (magnitude) => {
  if (magnitude >= 8.0) return 'great';
  if (magnitude >= 7.0) return 'major';
  if (magnitude >= 6.0) return 'strong';
  if (magnitude >= 5.0) return 'moderate';
  return 'minor';
};

export const preprocessEarthquake = (feature) => {
  const { mag, magnitude = mag, place, time, tsunami, sig } = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  
  const region = extractRegion(place);
  const severity = classifySeverity(magnitude);
  const timestamp = new Date(time).toISOString();

  return {
    primaryText: `Magnitude ${magnitude} earthquake at ${place}`,
    contextText: `A ${severity} earthquake occurred in ${region}. Significance: ${sig}. Tsunami: ${Boolean(tsunami)}.`,
    metadata: {
      magnitude,
      place,
      lat,
      lng,
      timestamp,
      tsunami: Boolean(tsunami),
      significance: sig,
      region,
      severity
    }
  };
};
