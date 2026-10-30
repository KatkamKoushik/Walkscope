/**
 * Route Context Coverage Scoring Service
 * 
 * Computes transparent, explainable Route Context Coverage (0-100%)
 * based on mapped amenity density, astronomical daylight conditions, and street imagery.
 * 
 * STRICT HONESTY RULES:
 * - NEVER labeled as "safety score" or "danger score"
 * - Discloses what is known, what is estimated, and what is missing
 * - Unknown data is not treated as safe or unsafe
 */

export const CONTEXT_SCORE_NAME = 'Route Context Coverage';
export const CONTEXT_SCORE_DISCLAIMER = 
  'Measures mapped information density and astronomical solar conditions. Does NOT measure, infer, or guarantee personal safety.';

/**
 * @typedef {Object} ContextScoringInput
 * @property {number} distanceMeters - Walking route distance in meters
 * @property {Array<{ category: string }>} [amenities] - Mapped amenities along corridor
 * @property {{ state: string; elevationDeg: number }} [solar] - Astronomical twilight result
 * @property {{ available: boolean; capturedAt?: string }} [imagery] - Street imagery result
 * 
 * @typedef {Object} ContextScoreBreakdown
 * @property {number} amenityScore - 0 to 40
 * @property {number} daylightScore - 0 to 30
 * @property {number} imageryScore - 0 to 30
 * @property {number} totalScore - 0 to 100
 * @property {string} ratingLabel - 'Comprehensive' | 'Moderate' | 'Sparse'
 * @property {string} scoreName
 * @property {string} disclaimer
 * @property {number} amenitiesCount
 * @property {number} amenityDensityPer100m
 * @property {string} daylightState
 * @property {number} solarElevationDeg
 * @property {boolean} hasStreetImagery
 * @property {string | null} imageryCaptureDate
 * @property {string[]} missingDataNotices
 */

/**
 * Calculates Route Context Coverage score from available data
 * @param {ContextScoringInput} input
 * @returns {ContextScoreBreakdown}
 */
export function calculateContextCoverage(input) {
  const {
    distanceMeters = 0,
    amenities = [],
    solar = { state: 'UNKNOWN', elevationDeg: 0 },
    imagery = { available: false },
  } = input || {};

  const missingDataNotices = [];

  // 1. Amenity Density Component (0 - 40 points)
  let amenityScore = 0;
  let amenityDensityPer100m = 0;
  const amenitiesCount = Array.isArray(amenities) ? amenities.length : 0;

  if (distanceMeters > 0 && amenitiesCount > 0) {
    amenityDensityPer100m = Number(((amenitiesCount / distanceMeters) * 100).toFixed(2));
    // Benchmark: 4+ amenities per 100m = full 40 points
    amenityScore = Math.min(40, Math.round(amenityDensityPer100m * 10));
  } else {
    missingDataNotices.push('No mapped amenities recorded along this corridor in OpenStreetMap.');
  }

  // 2. Solar Daylight Component (0 - 30 points)
  let daylightScore = 3; // Baseline night/astronomical
  const solarState = solar.state || 'NIGHT';
  const solarElevationDeg = typeof solar.elevationDeg === 'number' ? solar.elevationDeg : 0;

  switch (solarState) {
    case 'DAYLIGHT':
      daylightScore = 30;
      break;
    case 'CIVIL_TWILIGHT':
      daylightScore = 21;
      break;
    case 'NAUTICAL_TWILIGHT':
      daylightScore = 12;
      break;
    case 'ASTRONOMICAL_TWILIGHT':
      daylightScore = 6;
      break;
    case 'NIGHT':
    default:
      daylightScore = 3;
      if (solarState === 'NIGHT') {
        missingDataNotices.push('Night conditions: natural daylight is absent; relies on local street infrastructure.');
      }
      break;
  }

  // 3. Street-level Imagery Component (0 - 30 points)
  let imageryScore = 0;
  const hasStreetImagery = Boolean(imagery && imagery.available);
  const imageryCaptureDate = imagery?.capturedAt || null;

  if (hasStreetImagery) {
    imageryScore = 30;
  } else {
    missingDataNotices.push('No street-level imagery coverage found for this segment.');
  }

  // Total Score (0 - 100)
  const totalScore = Math.min(100, Math.max(0, amenityScore + daylightScore + imageryScore));

  let ratingLabel = 'Sparse';
  if (totalScore >= 70) {
    ratingLabel = 'Comprehensive';
  } else if (totalScore >= 35) {
    ratingLabel = 'Moderate';
  }

  return {
    amenityScore,
    daylightScore,
    imageryScore,
    totalScore,
    ratingLabel,
    scoreName: CONTEXT_SCORE_NAME,
    disclaimer: CONTEXT_SCORE_DISCLAIMER,
    amenitiesCount,
    amenityDensityPer100m,
    daylightState: solarState,
    solarElevationDeg,
    hasStreetImagery,
    imageryCaptureDate,
    missingDataNotices,
  };
}
