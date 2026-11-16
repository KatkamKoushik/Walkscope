/**
 * Route Context Coverage Scoring Service
 * 
 * Computes transparent, explainable Route Information Coverage (0-100%)
 * based on mapped amenity density and street-level imagery completeness.
 * 
 * STRICT ARCHITECTURAL & HONESTY RULES:
 * 1. Information Coverage Score strictly measures data completeness and density.
 *    It does NOT vary between day and night for the same mapped corridor.
 * 2. Walking Environmental Conditions (solar daylight, twilight, night) are evaluated
 *    and reported as an independent, first-class dimension.
 * 3. Unavailable / failed amenity queries are explicitly distinguished from an empty corridor
 *    (status: 'UNAVAILABLE' vs 'AVAILABLE' with 0 amenities).
 * 4. NEVER labeled as "safety score" or "danger score".
 */

export const CONTEXT_SCORE_NAME = 'Route Information Coverage';
export const CONTEXT_SCORE_DISCLAIMER = 
  'Measures mapped information density and street-level imagery coverage along the corridor. Does NOT measure, infer, or guarantee personal safety.';

/**
 * @typedef {Object} WalkingConditions
 * @property {string} solarState - 'DAYLIGHT' | 'CIVIL_TWILIGHT' | 'NAUTICAL_TWILIGHT' | 'ASTRONOMICAL_TWILIGHT' | 'NIGHT'
 * @property {number} solarElevationDeg
 * @property {string} conditionLabel
 * @property {string} visibilityNotice
 * @property {number} daylightScore - 0 to 30 environmental lighting index
 */

/**
 * @typedef {Object} ContextScoringInput
 * @property {number} distanceMeters - Walking route distance in meters
 * @property {Array<{ category: string }> | null} [amenities] - Mapped amenities along corridor
 * @property {'AVAILABLE' | 'UNAVAILABLE'} [amenityStatus] - Data availability status
 * @property {{ state: string; elevationDeg: number }} [solar] - Astronomical twilight result
 * @property {{
 *   available?: boolean;
 *   capturedAt?: string;
 *   coverageRatio?: number;
 *   sampledCheckpoints?: number;
 *   availableCheckpoints?: number;
 *   samplingMode?: 'corridor_checkpoints' | 'origin_only';
 * }} [imagery] - Street imagery result
 */

/**
 * @typedef {Object} ContextScoreBreakdown
 * @property {number | null} amenityScore - 0 to 50 (null if UNAVAILABLE)
 * @property {'AVAILABLE' | 'UNAVAILABLE'} amenityStatus
 * @property {number} daylightScore - 0 to 30 (environmental index, reported separately)
 * @property {number} imageryScore - 0 to 50
 * @property {number} totalScore - 0 to 100 (pure Information Coverage)
 * @property {number} informationCoverageScore - 0 to 100
 * @property {string} ratingLabel - 'Comprehensive' | 'Moderate' | 'Sparse' | 'Incomplete Data'
 * @property {string} scoreName
 * @property {string} disclaimer
 * @property {number} amenitiesCount
 * @property {number} amenityDensityPer100m
 * @property {string} daylightState
 * @property {number} solarElevationDeg
 * @property {boolean} hasStreetImagery
 * @property {number} imageryCoverageRatio
 * @property {string} imagerySamplingMode - 'corridor_checkpoints' | 'origin_only' | 'none'
 * @property {string | null} imageryCaptureDate
 * @property {WalkingConditions} walkingConditions
 * @property {string[]} missingDataNotices
 */

/**
 * Calculates Route Information Coverage score from available data
 * @param {ContextScoringInput} input
 * @returns {ContextScoreBreakdown}
 */
export function calculateContextCoverage(input) {
  const {
    distanceMeters = 0,
    amenities = [],
    amenityStatus = input?.amenities === null ? 'UNAVAILABLE' : (input?.amenityStatus || 'AVAILABLE'),
    solar = { state: 'UNKNOWN', elevationDeg: 0 },
    imagery = { available: false },
  } = input || {};

  const missingDataNotices = [];

  // 1. Amenity Density Component (0 - 50 points)
  let amenityScore = 0;
  let amenityDensityPer100m = 0;
  let amenitiesCount = 0;

  if (amenityStatus === 'UNAVAILABLE') {
    amenityScore = null;
    missingDataNotices.push('Amenity data could not be retrieved from OpenStreetMap; corridor amenity density cannot be evaluated.');
  } else {
    amenitiesCount = Array.isArray(amenities) ? amenities.length : 0;
    if (distanceMeters > 0 && amenitiesCount > 0) {
      amenityDensityPer100m = Number(((amenitiesCount / distanceMeters) * 100).toFixed(2));
      // Benchmark: 4+ amenities per 100m = full 50 points (each 1 amenity/100m = 12.5 pts)
      amenityScore = Math.min(50, Math.round(amenityDensityPer100m * 12.5));
    } else {
      amenityScore = 0;
      missingDataNotices.push('No mapped amenities recorded along this corridor in OpenStreetMap.');
    }
  }

  // 2. Street-level Imagery Component (0 - 50 points)
  let imageryScore = 0;
  let imageryCoverageRatio = 0;
  let imagerySamplingMode = 'none';
  const hasStreetImagery = Boolean(imagery && (imagery.available || (typeof imagery.coverageRatio === 'number' && imagery.coverageRatio > 0)));
  const imageryCaptureDate = imagery?.capturedAt || null;

  if (hasStreetImagery) {
    if (typeof imagery.coverageRatio === 'number' && Number.isFinite(imagery.coverageRatio)) {
      imageryCoverageRatio = Math.max(0, Math.min(1, imagery.coverageRatio));
      imagerySamplingMode = imagery.samplingMode || 'corridor_checkpoints';
    } else {
      // Legacy binary fallback or single-checkpoint lookup
      imageryCoverageRatio = 1.0;
      imagerySamplingMode = imagery.samplingMode || 'origin_only';
    }

    imageryScore = Math.round(imageryCoverageRatio * 50);

    if (imagerySamplingMode === 'origin_only') {
      missingDataNotices.push('Street imagery sampled near starting point only; corridor coverage not verified.');
    }
  } else {
    imageryScore = 0;
    missingDataNotices.push('No street-level imagery coverage found for this segment.');
  }

  // 3. Environmental Walking Conditions (Evaluated Separately from Information Coverage)
  let daylightScore = 3;
  const solarState = solar.state || 'NIGHT';
  const solarElevationDeg = typeof solar.elevationDeg === 'number' ? solar.elevationDeg : 0;
  let conditionLabel = 'Night';
  let visibilityNotice = 'Natural daylight is absent; visibility depends entirely on local street lighting.';

  switch (solarState) {
    case 'DAYLIGHT':
      daylightScore = 30;
      conditionLabel = 'Natural Daylight';
      visibilityNotice = 'Full natural daylight conditions across the corridor.';
      break;
    case 'CIVIL_TWILIGHT':
      daylightScore = 21;
      conditionLabel = 'Civil Twilight';
      visibilityNotice = 'Sun is just below horizon; ambient light is sufficient for ordinary outdoor activities.';
      break;
    case 'NAUTICAL_TWILIGHT':
      daylightScore = 12;
      conditionLabel = 'Nautical Twilight';
      visibilityNotice = 'Dim horizon illumination; artificial street lighting is active.';
      break;
    case 'ASTRONOMICAL_TWILIGHT':
      daylightScore = 6;
      conditionLabel = 'Astronomical Twilight';
      visibilityNotice = 'Minimal atmospheric glow; darkness prevails.';
      break;
    case 'NIGHT':
    default:
      daylightScore = 3;
      conditionLabel = 'Night';
      visibilityNotice = 'Night conditions: natural daylight is absent; relies on local street infrastructure.';
      break;
  }

  const walkingConditions = {
    solarState,
    solarElevationDeg,
    conditionLabel,
    visibilityNotice,
    daylightScore,
  };

  // Pure Information Coverage Score (0 - 100)
  // Determined solely by data completeness (amenity score + imagery score)
  let totalScore = 0;
  let ratingLabel = 'Sparse';

  if (amenityScore === null) {
    // Partial data availability: scale based on available imagery component
    totalScore = imageryScore;
    ratingLabel = 'Incomplete Data';
  } else {
    totalScore = Math.min(100, Math.max(0, amenityScore + imageryScore));
    if (totalScore >= 70) {
      ratingLabel = 'Comprehensive';
    } else if (totalScore >= 35) {
      ratingLabel = 'Moderate';
    } else {
      ratingLabel = 'Sparse';
    }
  }

  return {
    amenityScore,
    amenityStatus,
    daylightScore,
    imageryScore,
    totalScore,
    informationCoverageScore: totalScore,
    ratingLabel,
    scoreName: CONTEXT_SCORE_NAME,
    disclaimer: CONTEXT_SCORE_DISCLAIMER,
    amenitiesCount,
    amenityDensityPer100m,
    daylightState: solarState,
    solarElevationDeg,
    hasStreetImagery,
    imageryCoverageRatio,
    imagerySamplingMode,
    imageryCaptureDate,
    walkingConditions,
    missingDataNotices,
  };
}
