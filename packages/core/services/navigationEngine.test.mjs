import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createNavigationState,
  processGpsFix,
  checkGpsTimeout,
} from './navigationEngine.js';

describe('Pedestrian Navigation Engine (Deterministic Mock GPS Traces)', () => {
  // Test Route: Bengaluru MG Road Corridor (approx. 500m straight line then right turn onto Brigade Road)
  // Step 0: MG Road heading East (0m to 300m)
  // Step 1: Right turn onto Brigade Road heading South (300m to 500m)
  const mockRoute = {
    distanceMeters: 500,
    durationSeconds: 416, // ~1.2 m/s
    geometry: {
      type: 'LineString',
      coordinates: [
        [77.6000, 12.9750], // Start: MG Road west
        [77.6027, 12.9750], // Waypoint 1: MG Road / Brigade Road junction (~300m east)
        [77.6027, 12.9732], // End: Brigade Road south (~200m south)
      ],
    },
    steps: [
      {
        type: 'depart',
        modifier: 'straight',
        distanceMeters: 300,
        durationSeconds: 250,
        maneuver: {
          type: 'depart',
          location: [77.6000, 12.9750],
        },
      },
      {
        type: 'turn',
        modifier: 'right',
        distanceMeters: 200,
        durationSeconds: 166,
        maneuver: {
          type: 'turn',
          modifier: 'right',
          location: [77.6027, 12.9750],
        },
      },
    ],
  };

  it('1. Straight movement: advances smoothly and decrements remaining distance and duration', () => {
    let navState = createNavigationState(mockRoute);
    assert.strictEqual(navState.currentStepIndex, 0);
    assert.strictEqual(navState.remainingDistanceMeters, 500);

    // Initial fix at start: [77.6000, 12.9750]
    const fix1 = { latitude: 12.9750, longitude: 77.6000, accuracy: 5, timestamp: 1000 };
    const res1 = processGpsFix(navState, fix1, mockRoute);
    assert.strictEqual(res1.action, 'ACCEPTED');
    navState = res1.state;

    assert.strictEqual(navState.gpsStatus, 'active');
    assert.strictEqual(navState.isOffRoute, false);
    assert.strictEqual(navState.currentStepIndex, 0);
    // User is ~300m from next maneuver
    assert.ok(navState.distanceToNextManeuverMeters >= 290 && navState.distanceToNextManeuverMeters <= 310);

    // Walking 150m east: [77.60135, 12.9750] after 125 seconds
    const fix2 = { latitude: 12.9750, longitude: 77.60135, accuracy: 4, timestamp: 126000 };
    const res2 = processGpsFix(navState, fix2, mockRoute);
    assert.strictEqual(res2.action, 'ACCEPTED');
    navState = res2.state;

    // Remaining maneuver distance should have halved to ~150m
    assert.ok(navState.distanceToNextManeuverMeters >= 140 && navState.distanceToNextManeuverMeters <= 160);
    // Remaining total distance decreased from 500m to ~350m (150m on step 0 + 200m on step 1)
    assert.ok(navState.remainingDistanceMeters >= 340 && navState.remainingDistanceMeters <= 360);
    assert.ok(navState.remainingDurationSeconds < 416);
  });

  it('2. Waypoint advancement: advances currentStepIndex when within 25m of maneuver waypoint', () => {
    let navState = createNavigationState(mockRoute);

    // Fix 15m away from junction [77.6027, 12.9750]
    // 15m west of junction is approx lon = 77.60256
    const fixNearJunction = { latitude: 12.9750, longitude: 77.60256, accuracy: 3, timestamp: 200000 };
    const res = processGpsFix(navState, fixNearJunction, mockRoute);
    assert.strictEqual(res.action, 'ACCEPTED');
    navState = res.state;

    // Must have automatically advanced to step 1 (the right turn)
    assert.strictEqual(navState.currentStepIndex, 1);
    assert.strictEqual(navState.isOffRoute, false);
  });

  it('3. GPS jitter rejection: drops inaccurate fixes with uncertainty > 65m without corrupting state', () => {
    let navState = createNavigationState(mockRoute);
    const validFix = { latitude: 12.9750, longitude: 77.6000, accuracy: 8, timestamp: 1000 };
    navState = processGpsFix(navState, validFix, mockRoute).state;

    // Jitter fix with accuracy 95m (e.g. cell tower triangulation bounce)
    const jitterFix = { latitude: 12.9755, longitude: 77.6005, accuracy: 95, timestamp: 3500 };
    const result = processGpsFix(navState, jitterFix, mockRoute);

    assert.strictEqual(result.action, 'DROPPED_INACCURATE');
    // State remains unaffected
    assert.strictEqual(result.state.lastValidFix.latitude, 12.9750);
    assert.strictEqual(result.state.lastValidFix.timestamp, 1000);
  });

  it('4. Teleportation rejection: rejects physically impossible speed jumps (> 25 m/s delta)', () => {
    let navState = createNavigationState(mockRoute);
    const fix1 = { latitude: 12.9750, longitude: 77.6000, accuracy: 5, timestamp: 10000 };
    navState = processGpsFix(navState, fix1, mockRoute).state;

    // Teleportation fix 400m away just 2 seconds later (speed = 200 m/s > 25 m/s)
    const teleportFix = { latitude: 12.9786, longitude: 77.6000, accuracy: 5, timestamp: 12000 };
    const result = processGpsFix(navState, teleportFix, mockRoute);

    assert.strictEqual(result.action, 'DROPPED_TELEPORT');
    assert.strictEqual(result.state.lastValidFix.latitude, 12.9750);
  });

  it('5. Loss of GPS signal timeout: transitions to lost when no fix received for 15s', () => {
    let navState = createNavigationState(mockRoute);
    const fix = { latitude: 12.9750, longitude: 77.6000, accuracy: 5, timestamp: 10000 };
    navState = processGpsFix(navState, fix, mockRoute).state;
    assert.strictEqual(navState.gpsStatus, 'active');

    // After 10s: still active
    navState = checkGpsTimeout(navState, 20000);
    assert.strictEqual(navState.gpsStatus, 'active');

    // After 16s: signal timeout
    navState = checkGpsTimeout(navState, 26001);
    assert.strictEqual(navState.gpsStatus, 'lost');
  });

  it('6. Off-route detection with 2-fix hysteresis and corridor recovery', () => {
    let navState = createNavigationState(mockRoute);

    // Initial on-route fix
    navState = processGpsFix(
      navState,
      { latitude: 12.9750, longitude: 77.6000, accuracy: 5, timestamp: 1000 },
      mockRoute
    ).state;
    assert.strictEqual(navState.isOffRoute, false);

    // Straying 67m North of MG road: latitude 12.9756, 11 seconds later (speed = ~6 m/s, realistic run/walk)
    const offFix1 = { latitude: 12.9756, longitude: 77.6000, accuracy: 5, timestamp: 12000 };
    navState = processGpsFix(navState, offFix1, mockRoute).state;

    // 1st off-route fix: hysteresis prevents immediate alarm (consecutiveOffRouteCount = 1)
    assert.strictEqual(navState.consecutiveOffRouteCount, 1);
    assert.strictEqual(navState.isOffRoute, false);

    // 2nd consecutive off-route fix: hysteresis triggers alarm (3 seconds later)
    const offFix2 = { latitude: 12.97565, longitude: 77.6001, accuracy: 5, timestamp: 15000 };
    navState = processGpsFix(navState, offFix2, mockRoute).state;
    assert.strictEqual(navState.consecutiveOffRouteCount, 2);
    assert.strictEqual(navState.isOffRoute, true);
    assert.ok(navState.offRouteMeters >= 60 && navState.offRouteMeters <= 85);

    // Recovery fix: user walks back onto corridor 13 seconds later
    const recoveryFix = { latitude: 12.9750, longitude: 77.6002, accuracy: 5, timestamp: 28000 };
    navState = processGpsFix(navState, recoveryFix, mockRoute).state;
    assert.strictEqual(navState.consecutiveOffRouteCount, 0);
    assert.strictEqual(navState.isOffRoute, false);
    assert.strictEqual(navState.offRouteMeters, null);
  });
});
