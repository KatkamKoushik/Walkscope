/**
 * Route Context Intelligence Service
 * 
 * Implements high-value pedestrian route intelligence based on the NightWise specification:
 * 1. Venue opening-hours intelligence evaluated at projected pedestrian arrival time.
 * 2. Along-route venue distribution and longest-gap calculation.
 * 3. Major-road share and highway classification breakdown.
 * 4. Verified support-point registry model with evidence and expiration tracking.
 * 5. Full reproducibility and audit versioning.
 */

import { haversineKm } from '../providers/common/geo.js';
import {
  evaluateOpeningHours,
  resolveTimezoneForCoordinates,
  OPENING_HOURS_PARSER_VERSION,
} from './openingHoursService.js';

export const SCORER_VERSION = '1.1.0-route-intelligence';
export const GRAPH_VERSION = 'osm-planet-2026-10';

export const SPEED_PRESETS = {
  relaxed: 0.9,   // 3.2 km/h
  standard: 1.2,  // 4.3 km/h
  brisk: 1.5,     // 5.4 km/h
};

/**
 * Calculates Haversine distance in meters between two [lon, lat] points
 */
function distanceMeters(p1, p2) {
  return haversineKm(p1[1], p1[0], p2[1], p2[0]) * 1000;
}

/**
 * Projects a point P onto a line segment A -> B, returning the along-segment distance in meters.
 */
function projectPointOntoSegment(pLon, pLat, aLon, aLat, bLon, bLat) {
  const dSegment = distanceMeters([aLon, aLat], [bLon, bLat]);
  if (dSegment === 0) return 0;

  // Vector AB and AP in approximate Cartesian coordinates
  const cosLat = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const dx = (bLon - aLon) * cosLat;
  const dy = bLat - aLat;
  const px = (pLon - aLon) * cosLat;
  const py = pLat - aLat;

  const dot = px * dx + py * dy;
  const lenSq = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, dot / lenSq));

  return t * dSegment;
}

/**
 * Computes along-route cumulative distance (in meters) for a coordinate along a polyline.
 * @param {[number, number]} point - [lon, lat]
 * @param {Array<[number, number]>} polyline - Route coordinates [[lon, lat], ...]
 * @returns {number} Cumulative distance from start in meters
 */
export function computeAlongRouteDistanceMeters(point, polyline) {
  if (!polyline || polyline.length < 2) return 0;

  let bestDistToPolyline = Infinity;
  let alongRouteDistAtBest = 0;
  let cumulativeDist = 0;

  const pLon = point[0];
  const pLat = point[1];

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segLen = distanceMeters(a, b);

    // Approximate perpendicular distance from point to segment
    const tDist = projectPointOntoSegment(pLon, pLat, a[0], a[1], b[0], b[1]);
    const t = segLen > 0 ? tDist / segLen : 0;

    const projLon = a[0] + (b[0] - a[0]) * t;
    const projLat = a[1] + (b[1] - a[1]) * t;
    const distToSeg = distanceMeters([pLon, pLat], [projLon, projLat]);

    if (distToSeg < bestDistToPolyline) {
      bestDistToPolyline = distToSeg;
      alongRouteDistAtBest = cumulativeDist + tDist;
    }

    cumulativeDist += segLen;
  }

  return Math.round(alongRouteDistAtBest);
}

/**
 * Evaluates along-route venue opening hours intelligence.
 * 
 * @param {Array<any>} amenities - Mapped amenity features along corridor
 * @param {Array<[number, number]>} polyline - Route geometry coordinates
 * @param {number} totalDistanceMeters - Total route distance
 * @param {Object} [options]
 * @param {number} [options.walkingSpeedMs=1.2] - Pedestrian walking speed in m/s
 * @param {Date | string} [options.departureTime=new Date()] - Planned departure time
 * @returns {Object} Venue intelligence breakdown
 */
export function evaluateRouteVenues(
  amenities,
  polyline,
  totalDistanceMeters,
  options = {}
) {
  const rawSpeed = options.walkingSpeedMs;
  const walkingSpeedMs = (typeof rawSpeed === 'number' && Number.isFinite(rawSpeed) && rawSpeed > 0)
    ? rawSpeed
    : SPEED_PRESETS.standard;
  const departureDate = options.departureTime instanceof Date 
    ? options.departureTime 
    : new Date(options.departureTime || Date.now());

  const validDeparture = !isNaN(departureDate.getTime()) ? departureDate : new Date();

  const venueFeatures = (amenities || []).filter(
    (a) => a.category === 'services' || a.category === 'emergency' || a.tags?.shop || a.tags?.amenity
  );

  let openCount = 0;
  let closedCount = 0;
  let unknownCount = 0;

  const evaluatedVenues = venueFeatures.map((v) => {
    const alongMeters = computeAlongRouteDistanceMeters(v.coordinates, polyline);
    const walkSeconds = Math.round(alongMeters / walkingSpeedMs);
    const arrivalTime = new Date(validDeparture.getTime() + walkSeconds * 1000);
    const venueTz = resolveTimezoneForCoordinates(v.coordinates?.[0], v.coordinates?.[1]);

    const openingResult = evaluateOpeningHours(v.tags?.opening_hours, arrivalTime, venueTz);

    if (openingResult.status === 'OPEN') openCount++;
    else if (openingResult.status === 'CLOSED') closedCount++;
    else unknownCount++;

    return {
      id: v.id,
      name: v.name,
      category: v.category,
      coordinates: v.coordinates,
      alongRouteDistanceMeters: alongMeters,
      estimatedPassingTime: arrivalTime.toISOString(),
      timezone: venueTz,
      localTimeFormatted: openingResult.localTimeFormatted,
      openingStatus: openingResult.status,
      openingReason: openingResult.reason || openingResult.ruleMatched || 'Open',
      rawOpeningHours: v.tags?.opening_hours || null,
    };
  });

  // Sort venues by along-route distance to calculate gaps
  evaluatedVenues.sort((a, b) => a.alongRouteDistanceMeters - b.alongRouteDistanceMeters);

  // Calculate along-route venue continuity & gaps
  let longestGapMeters = 0;
  if (evaluatedVenues.length === 0) {
    longestGapMeters = totalDistanceMeters;
  } else {
    // Gap 1: from start to first venue
    let prevDist = 0;
    for (const v of evaluatedVenues) {
      const gap = Math.max(0, v.alongRouteDistanceMeters - prevDist);
      if (gap > longestGapMeters) longestGapMeters = gap;
      prevDist = v.alongRouteDistanceMeters;
    }
    // Gap N+1: from last venue to destination
    const finalGap = Math.max(0, totalDistanceMeters - prevDist);
    if (finalGap > longestGapMeters) longestGapMeters = finalGap;
  }

  const averageGapMeters = evaluatedVenues.length > 0 
    ? Math.round(totalDistanceMeters / (evaluatedVenues.length + 1))
    : totalDistanceMeters;

  return {
    totalVenuesCount: evaluatedVenues.length,
    openCount,
    closedCount,
    unknownCount,
    longestGapMeters: Math.round(longestGapMeters),
    averageGapMeters,
    walkingSpeedMs,
    departureTime: validDeparture.toISOString(),
    venues: evaluatedVenues,
  };
}

/**
 * Official OpenStreetMap Highway Classifications.
 * Used for deterministic, explainable road mix measurement without string name guessing.
 */
export const OSM_HIGHWAY_TAGS = {
  major: new Set([
    'motorway', 'motorway_link',
    'trunk', 'trunk_link',
    'primary', 'primary_link',
    'secondary', 'secondary_link',
    'tertiary', 'tertiary_link',
  ]),
  local: new Set([
    'residential', 'living_street', 'service', 'unclassified',
  ]),
  footway: new Set([
    'footway', 'pedestrian', 'path', 'cycleway', 'steps', 'bridleway', 'track', 'sidewalk', 'crossing',
  ]),
};

/**
 * Classifies an individual route step into an OSM highway category:
 * 'major' | 'local' | 'footway' | 'other'
 * 
 * Does NOT guess from street name substrings (e.g., 'road', 'avenue').
 * 
 * @param {Object} step
 * @returns {'major' | 'local' | 'footway' | 'other'}
 */
export function classifyStepHighway(step) {
  if (!step) return 'other';

  // 1. Direct OSM highway tag (authoritative)
  const tag = (step.highway || step.osmHighway || step.tags?.highway || '').toLowerCase().trim();
  if (tag) {
    if (OSM_HIGHWAY_TAGS.major.has(tag)) return 'major';
    if (OSM_HIGHWAY_TAGS.footway.has(tag)) return 'footway';
    if (OSM_HIGHWAY_TAGS.local.has(tag)) return 'local';
    return 'other';
  }

  // 2. High-confidence infrastructure indicators (OSM route refs e.g., Motorways, National/State Highways)
  const ref = (step.ref || '').toUpperCase().trim();
  if (ref) {
    if (/^(M\d+|A\d+|NH\s*\d+|SH\s*\d+|I-\d+|US\s*\d+|B\d+|E\d+)/.test(ref)) {
      return 'major';
    }
  }

  // 3. Explicit pedestrian mode / maneuver type from OSRM foot engine
  const maneuverType = (step.maneuver?.type || step.maneuverType || step.type || '').toLowerCase();
  const mode = (step.mode || '').toLowerCase();
  if (mode === 'footway' || mode === 'pedestrian' || mode === 'path' || maneuverType === 'footway') {
    return 'footway';
  }

  // 4. Default to 'other' (honest representation of unclassified or omitted tag)
  return 'other';
}

/**
 * Classifies road types and computes major-road share from route steps.
 * Uses official OpenStreetMap highway classifications.
 * 
 * @param {Array<any>} steps - Maneuver steps from route provider
 * @param {number} totalDistanceMeters - Total route distance
 * @returns {Object} Road mix percentages and breakdown
 */
export function calculateMajorRoadShare(steps, totalDistanceMeters) {
  if (!steps || steps.length === 0 || totalDistanceMeters <= 0) {
    return {
      majorRoadPercent: 0,
      localRoadPercent: 0,
      footwayPercent: 0,
      otherPercent: 100,
      majorDistanceMeters: 0,
      localDistanceMeters: 0,
      footwayDistanceMeters: 0,
      otherDistanceMeters: 0,
      disclaimer: 'Road classification uses OpenStreetMap highway tags. Unclassified steps are reported under Other / Unspecified.',
    };
  }

  let majorMeters = 0;
  let localMeters = 0;
  let footwayMeters = 0;
  let otherMeters = 0;

  for (const step of steps) {
    const dist = typeof step.distanceMeters === 'number' && Number.isFinite(step.distanceMeters) && step.distanceMeters > 0
      ? step.distanceMeters
      : 0;

    const classification = classifyStepHighway(step);
    if (classification === 'major') {
      majorMeters += dist;
    } else if (classification === 'footway') {
      footwayMeters += dist;
    } else if (classification === 'local') {
      localMeters += dist;
    } else {
      otherMeters += dist;
    }
  }

  const computedTotal = majorMeters + localMeters + footwayMeters + otherMeters;
  const effectiveTotal = computedTotal > 0 ? computedTotal : totalDistanceMeters;
  const hasClassificationData = (majorMeters + localMeters + footwayMeters) > 0;

  const majorRoadPercent = Math.min(100, Math.round((majorMeters / effectiveTotal) * 100));
  const footwayPercent = Math.min(100, Math.round((footwayMeters / effectiveTotal) * 100));
  const localRoadPercent = Math.min(100, Math.round((localMeters / effectiveTotal) * 100));
  const otherPercent = Math.max(0, 100 - (majorRoadPercent + footwayPercent + localRoadPercent));

  return {
    isAvailable: hasClassificationData,
    status: hasClassificationData ? 'AVAILABLE' : 'UNAVAILABLE',
    majorRoadPercent,
    localRoadPercent,
    footwayPercent,
    otherPercent,
    majorDistanceMeters: Math.round(majorMeters),
    localDistanceMeters: Math.round(localMeters),
    footwayDistanceMeters: Math.round(footwayMeters),
    otherDistanceMeters: Math.round(otherMeters),
    disclaimer: hasClassificationData
      ? 'Road classification uses OpenStreetMap highway tags. Unclassified steps are reported under Other / Unspecified.'
      : 'Way-tag enrichment is unavailable for these route steps; highway classification cannot be reliably inferred.',
  };
}

/**
 * Validates whether an evidence URL points to a specific document or location audit,
 * rather than a generic top-level organisation homepage (e.g. https://112.gov.in).
 * 
 * @param {string} url
 * @returns {boolean}
 */
export function isLocationSpecificEvidence(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return path.length > 1; // Requires specific subpath e.g. /audit/station-12 or /kiosk-audit.pdf
  } catch {
    return false;
  }
}

/**
 * Built-in Verified Support Point Registry.
 * Strictly empty by default to eliminate false security claims.
 * Verified public assistance desks require location-specific independent access audit,
 * confirmed public 24/7 operating desk, and unexpired verification date.
 */
export const BENCHMARK_SUPPORT_POINTS = [];

/**
 * Evaluates verified support points within buffer distance of route.
 * 
 * @param {Array<[number, number]>} polyline - Route coordinates
 * @param {Array<any>} [customRegistry] - Optional custom verified support registry
 * @param {number} [bufferMeters=250] - Proximity radius
 * @returns {Object} Verified support points evaluation
 */
export function evaluateVerifiedSupportPoints(
  polyline,
  customRegistry = BENCHMARK_SUPPORT_POINTS,
  bufferMeters = 250
) {
  const safePolyline = Array.isArray(polyline) ? polyline : [];
  const registry = Array.isArray(customRegistry) ? customRegistry : BENCHMARK_SUPPORT_POINTS;
  const safeBuffer = (typeof bufferMeters === 'number' && Number.isFinite(bufferMeters) && bufferMeters > 0)
    ? bufferMeters
    : 250;
  const now = new Date();

  if (safePolyline.length < 2) {
    return {
      verifiedPointsCount: 0,
      expiredPointsCount: 0,
      supportPoints: [],
      evaluatedBufferMeters: safeBuffer,
      registryVersion: 'nightwise-v1.1',
      disclaimer: 'Verified support locations require independently confirmed public access and current verification expiry.',
    };
  }

  const matchingPoints = [];

  for (const point of registry) {
    // Validate coordinates
    if (
      !Array.isArray(point.coordinates) ||
      point.coordinates.length !== 2 ||
      typeof point.coordinates[0] !== 'number' ||
      typeof point.coordinates[1] !== 'number' ||
      !Number.isFinite(point.coordinates[0]) ||
      !Number.isFinite(point.coordinates[1])
    ) {
      continue;
    }

    const expiryDate = point.expiresAt ? new Date(point.expiresAt) : null;
    const isExpiryValid = expiryDate instanceof Date && !isNaN(expiryDate.getTime());
    const isExpired = isExpiryValid ? expiryDate < now : true;
    const isAccessConfirmed = point.publicAccessConfirmed === true;
    const hasSpecificEvidence = isLocationSpecificEvidence(point.evidenceUrl) || Boolean(point.locationVerificationDocument);

    // Compute min perpendicular distance to polyline
    let minPerpDist = Infinity;
    for (let i = 0; i < safePolyline.length - 1; i++) {
      const a = safePolyline[i];
      const b = safePolyline[i + 1];
      const d = projectPointOntoSegment(point.coordinates[0], point.coordinates[1], a[0], a[1], b[0], b[1]);
      const segLen = distanceMeters(a, b);
      const t = segLen > 0 ? d / segLen : 0;
      const proj = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const pDist = distanceMeters(point.coordinates, proj);
      if (pDist < minPerpDist) minPerpDist = pDist;
    }

    if (minPerpDist <= safeBuffer) {
      let verificationStatus = 'unverified_candidate';
      if (isAccessConfirmed && hasSpecificEvidence && isExpiryValid) {
        verificationStatus = isExpired ? 'expired_needs_recheck' : 'verified_active';
      }

      matchingPoints.push({
        ...point,
        distanceFromRouteMeters: Math.round(minPerpDist),
        isExpired,
        verificationStatus,
      });
    }
  }

  const activeCount = matchingPoints.filter((p) => p.verificationStatus === 'verified_active').length;

  return {
    verifiedPointsCount: activeCount,
    expiredPointsCount: matchingPoints.filter((p) => p.verificationStatus === 'expired_needs_recheck').length,
    supportPoints: matchingPoints,
    disclaimer: 'Verified support locations require independently confirmed public access and current verification expiry.',
  };
}

/**
 * Computes complete Route Intelligence Report for the Evidence Drawer.
 * 
 * @param {Object} params
 * @param {Array<[number, number]>} params.polyline
 * @param {number} params.distanceMeters
 * @param {number} params.durationSeconds
 * @param {Array<any>} params.steps
 * @param {Array<any>} params.amenities
 * @param {Object} [params.options]
 * @returns {Object} Full reproducible route intelligence model
 */
export function computeRouteIntelligence({
  polyline,
  distanceMeters,
  _durationSeconds,
  steps = [],
  amenities = [],
  options = {},
}) {
  const walkingSpeedMs = options.walkingSpeedMs || SPEED_PRESETS.standard;
  const departureTime = options.departureTime || new Date().toISOString();

  // 1. Venue Opening Hours & Gap Intelligence
  const venueIntelligence = evaluateRouteVenues(
    amenities,
    polyline,
    distanceMeters,
    { walkingSpeedMs, departureTime }
  );

  // 2. Road Class Share
  const roadShare = calculateMajorRoadShare(steps, distanceMeters);

  // 3. Verified Support Point Registry Check
  const supportIntelligence = evaluateVerifiedSupportPoints(polyline);

  // 4. Reproducible Version Snapshot
  const reproducibility = {
    scorer_version: SCORER_VERSION,
    opening_hours_parser_version: OPENING_HOURS_PARSER_VERSION,
    graph_version: GRAPH_VERSION,
    walking_speed_ms: walkingSpeedMs,
    departure_timestamp: departureTime,
    computed_at: new Date().toISOString(),
  };

  return {
    reproducibility,
    venueIntelligence,
    roadShare,
    supportIntelligence,
  };
}
