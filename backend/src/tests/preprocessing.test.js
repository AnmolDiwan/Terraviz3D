import { extractRegion, classifySeverity, preprocessEarthquake } from '../services/preprocessing.service.js';

describe('Preprocessing Service', () => {
  describe('extractRegion', () => {
    it('should return last comma-separated segment trimmed', () => {
      expect(extractRegion('10km SSW of Idyllwild, CA')).toBe('CA');
      expect(extractRegion('South of Java, Indonesia')).toBe('Indonesia');
      expect(extractRegion('   San Francisco,   California  ')).toBe('California');
    });

    it('should return full place string if no comma', () => {
      expect(extractRegion('Pacific-Antarctic Ridge')).toBe('Pacific-Antarctic Ridge');
      expect(extractRegion('California')).toBe('California');
    });
  });

  describe('classifySeverity', () => {
    it('should classify magnitude >= 8.0 as great', () => {
      expect(classifySeverity(8.0)).toBe('great');
      expect(classifySeverity(9.5)).toBe('great');
    });
    
    it('should classify magnitude >= 7.0 as major', () => {
      expect(classifySeverity(7.0)).toBe('major');
      expect(classifySeverity(7.9)).toBe('major');
    });

    it('should classify magnitude >= 6.0 as strong', () => {
      expect(classifySeverity(6.0)).toBe('strong');
      expect(classifySeverity(6.9)).toBe('strong');
    });

    it('should classify magnitude >= 5.0 as moderate', () => {
      expect(classifySeverity(5.0)).toBe('moderate');
      expect(classifySeverity(5.9)).toBe('moderate');
    });

    it('should classify magnitude below 5.0 as minor', () => {
      expect(classifySeverity(4.9)).toBe('minor');
      expect(classifySeverity(1.2)).toBe('minor');
      expect(classifySeverity(-1.0)).toBe('minor');
    });
  });

  describe('preprocessEarthquake', () => {
    it('should preprocess a mock USGS feature correctly without mutating', () => {
      const mockFeature = {
        type: 'Feature',
        properties: {
          mag: 6.5,
          place: '12km NE of Chignik Lake, Alaska',
          time: 1627027110000,
          tsunami: 1,
          sig: 650
        },
        geometry: {
          type: 'Point',
          coordinates: [-158.0, 56.0, 10.0]
        }
      };

      const originalFeatureStr = JSON.stringify(mockFeature);

      const result = preprocessEarthquake(mockFeature);

      expect(result.metadata).toEqual({
        magnitude: 6.5,
        place: '12km NE of Chignik Lake, Alaska',
        lat: 56.0,
        lng: -158.0,
        timestamp: new Date(1627027110000).toISOString(),
        tsunami: true,
        significance: 650,
        region: 'Alaska',
        severity: 'strong'
      });

      expect(typeof result.primaryText).toBe('string');
      expect(typeof result.contextText).toBe('string');
      
      // Ensure input wasn't mutated
      expect(JSON.stringify(mockFeature)).toBe(originalFeatureStr);
    });
  });
});
