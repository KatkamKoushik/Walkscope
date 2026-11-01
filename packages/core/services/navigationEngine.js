/**
 * Pure Deterministic Pedestrian Navigation Engine
 * 
 * Manages turn-by-turn waypoint advancement, pedestrian kinematic filtering,
 * 2-reading off-route hysteresis, dynamic remaining distance/duration calculation,
 * and GPS loss timeout.
 * 
 * STRICT HONESTY:
 * - Operates in foreground mode only; Android background location is not active.
 * - Discards inaccurate fixes (> 65m uncertainty).
 * - Discards teleportation glitches (> 25 m/s delta).
 */

export const NAVIGATION_ENGINE_VERSION = '1.0.0-deterministic';

/** Default parameter thresholds */
export const NAV_DEFAULTS = {
  maxAccuracyMeters: 65,
  maxSpeedMps: 25, // 90 km/h (rejects vehicle/GPS spoofing / cell-tower teleportation)
  waypointAdvanceRadiusMeters: 25,
  offRouteThresholdMeters: 50,
  offRouteHysteresisCount: 2,
  gpsTimeoutMs: 15000,
  defaultWalkingSpeedMps: 1.2,
};

/**
 * Calculates great-circle distance between two WGS-84 coordinates in meters.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes minimum perpendicular distance from a point to a 2D polyline corridor.
 * @param {number} lat 
 * @param {number} lon 
 * @param {Array<[number, number]>} polyline - Array of [lon, lat] pairs
 * @returns {number} Distance in meters
 */
export function minDistanceToCorridor(lat, lon, polyline) {
  if (!Array.isArray(polyline) || polyline.length === 0) return 0;
  if (polyline.length === 1) {
    return haversineMeters(lat, lon, polyline[0][1], polyline[0][0]);
  }

  let minMeters = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];

    const dAB = haversineMeters(a[1], a[0], b[1], b[0]);
    let d = 0;

    if (dAB < 0.1) {
      d = haversineMeters(lat, lon, a[1], a[0]);
    } else {
      const u =
        ((lon - a[0]) * (b[0] - a[0]) + (lat - a[1]) * (b[1] - a[1])) /
        ((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));

      const clampedU = Math.max(0, Math.min(1, u));
      const projLon = a[0] + clampedU * (b[0] - a[0]);
      const projLat = a[1] + clampedU * (b[1] - a[1]);

      d = haversineMeters(lat, lon, projLat, projLon);
    }

    if (d < minMeters) minMeters = d;
  }

  return minMeters;
}

/**
 * Creates initial clean navigation state.
 * @param {Object} [route]
 * @returns {Object}
 */
export function createNavigationState(route) {
  const steps = route?.steps || [];
  const totalDist = typeof route?.distanceMeters === 'number' ? route.distanceMeters : 0;
  const totalDur = typeof route?.durationSeconds === 'number' ? route.durationSeconds : 0;

  return {
    currentStepIndex: 0,
    lastValidFix: null,
    consecutiveOffRouteCount: 0,
    isOffRoute: false,
    offRouteMeters: null,
    gpsStatus: 'searching', // 'searching' | 'active' | 'lost' | 'unavailable'
    remainingDistanceMeters: totalDist,
    remainingDurationSeconds: totalDur,
    distanceToNextManeuverMeters: steps[0]?.distanceMeters || 0,
  };
}

/**
 * Ingests a new GPS fix and deterministically updates navigation state.
 * 
 * @param {Object} state - Current navigation state
 * @param {Object} fix - Raw GPS reading
 * @param {number} fix.latitude
 * @param {number} fix.longitude
 * @param {number} [fix.accuracy]
 * @param {number} [fix.timestamp]
 * @param {Object} route - Active route object { geometry: { coordinates }, steps }
 * @param {Object} [options]
 * @returns {{ state: Object, action: 'ACCEPTED' | 'DROPPED_INACCURATE' | 'DROPPED_TELEPORT' }}
 */
export function processGpsFix(state, fix, route, options = {}) {
  const opts = { ...NAV_DEFAULTS, ...options };
  const now = typeof fix.timestamp === 'number' ? fix.timestamp : Date.now();
  const { latitude, longitude, accuracy } = fix;

  // 1. Accuracy Kinematic Filter
  if (typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy > opts.maxAccuracyMeters) {
    return {
      state: { ...state },
      action: 'DROPPED_INACCURATE',
    };
  }

  // 2. Teleportation / Jitter Guard
  if (state.lastValidFix) {
    const dtSeconds = Math.max(0.2, (now - state.lastValidFix.timestamp) / 1000);
    const jumpDist = haversineMeters(
      state.lastValidFix.latitude,
      state.lastValidFix.longitude,
      latitude,
      longitude
    );
    const speedMps = jumpDist / dtSeconds;

    if (dtSeconds < 10 && speedMps > opts.maxSpeedMps) {
      return {
        state: { ...state },
        action: 'DROPPED_TELEPORT',
      };
    }
  }

  const polyline = route?.geometry?.coordinates || [];
  const steps = route?.steps || [];
  let currentStepIdx = Math.min(state.currentStepIndex, Math.max(0, steps.length - 1));

  // 3. Off-route detection with 2-fix hysteresis
  const distToCorridor = minDistanceToCorridor(latitude, longitude, polyline);
  let consecutiveOff = state.consecutiveOffRouteCount;
  let isOff = state.isOffRoute;
  let offMeters = state.offRouteMeters;

  if (distToCorridor > opts.offRouteThresholdMeters) {
    consecutiveOff += 1;
    if (consecutiveOff >= opts.offRouteHysteresisCount) {
      isOff = true;
      offMeters = Math.round(distToCorridor);
    }
  } else {
    consecutiveOff = 0;
    isOff = false;
    offMeters = null;
  }

  // 4. Waypoint advancement
  // Next maneuver location is step's endpoint / next step's start
  const currentStep = steps[currentStepIdx];
  const nextStep = steps[currentStepIdx + 1];

  let nextManeuverCoords = null;
  if (nextStep?.maneuver?.location) {
    nextManeuverCoords = nextStep.maneuver.location; // [lon, lat]
  } else if (currentStep?.maneuver?.location) {
    nextManeuverCoords = currentStep.maneuver.location;
  }

  let distToNextManeuver = 0;
  if (nextManeuverCoords) {
    distToNextManeuver = Math.round(
      haversineMeters(latitude, longitude, nextManeuverCoords[1], nextManeuverCoords[0])
    );

    // Advance if within radius and not final step
    if (distToNextManeuver <= opts.waypointAdvanceRadiusMeters && currentStepIdx < steps.length - 1) {
      currentStepIdx += 1;
      const newlyActiveNext = steps[currentStepIdx + 1];
      if (newlyActiveNext?.maneuver?.location) {
        distToNextManeuver = Math.round(
          haversineMeters(
            latitude,
            longitude,
            newlyActiveNext.maneuver.location[1],
            newlyActiveNext.maneuver.location[0]
          )
        );
      }
    }
  }

  // 5. Dynamic remaining distance and duration calculation
  let remainingDist = distToNextManeuver;
  for (let s = currentStepIdx + 1; s < steps.length; s++) {
    remainingDist += steps[s]?.distanceMeters || 0;
  }
  const remainingDur = Math.round(remainingDist / opts.defaultWalkingSpeedMps);

  const nextState = {
    currentStepIndex: currentStepIdx,
    lastValidFix: { latitude, longitude, timestamp: now },
    consecutiveOffRouteCount: consecutiveOff,
    isOffRoute: isOff,
    offRouteMeters: offMeters,
    gpsStatus: 'active',
    remainingDistanceMeters: remainingDist,
    remainingDurationSeconds: remainingDur,
    distanceToNextManeuverMeters: distToNextManeuver,
  };

  return {
    state: nextState,
    action: 'ACCEPTED',
  };
}

/**
 * Checks if GPS signal has timed out and updates status to 'lost'.
 * @param {Object} state 
 * @param {number} now 
 * @param {number} [timeoutMs=15000] 
 * @returns {Object} Updated state
 */
export function checkGpsTimeout(state, now, timeoutMs = NAV_DEFAULTS.gpsTimeoutMs) {
  if (state.gpsStatus === 'active' && state.lastValidFix) {
    if (now - state.lastValidFix.timestamp > timeoutMs) {
      return {
        ...state,
        gpsStatus: 'lost',
      };
    }
  }
  return state;
}
