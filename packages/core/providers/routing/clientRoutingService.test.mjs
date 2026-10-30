import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePedestrianRoutes, generateRouteSignature } from './clientRoutingService.js';

test('clientRoutingService: rejects invalid coordinates upfront', async () => {
  const result = await calculatePedestrianRoutes(
    { latitude: 95, longitude: 0 },
    { latitude: 51.5, longitude: -0.1 }
  );
  assert.equal(result.ok, false);
  assert.equal(result.status, 'INVALID_INPUT');
  assert.equal(result.routes.length, 0);
});

test('clientRoutingService: handles NoRoute (0 routes found) cleanly without fabricating a route', async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      code: 'NoRoute',
      routes: [],
    }),
  });

  const result = await calculatePedestrianRoutes(
    { latitude: 51.5, longitude: -0.1 },
    { latitude: 51.6, longitude: -0.2 },
    { fetchFn: fakeFetch }
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'NO_ROUTE_FOUND');
  assert.equal(result.routes.length, 0);
  assert.match(result.message, /No walking route found/);
});

test('clientRoutingService: parses multiple alternative walking routes with instructions', async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      code: 'Ok',
      routes: [
        {
          distance: 1250,
          duration: 900,
          geometry: {
            type: 'LineString',
            coordinates: [[-0.1, 51.5], [-0.105, 51.505], [-0.11, 51.51]],
          },
          legs: [
            {
              steps: [
                {
                  name: 'Fleet Street',
                  distance: 400,
                  duration: 300,
                  maneuver: { type: 'depart', modifier: 'straight', location: [-0.1, 51.5] },
                },
                {
                  name: 'Chancery Lane',
                  distance: 850,
                  duration: 600,
                  maneuver: { type: 'turn', modifier: 'right', location: [-0.105, 51.505] },
                },
              ],
            },
          ],
        },
        {
          distance: 1400,
          duration: 1020,
          geometry: {
            type: 'LineString',
            coordinates: [[-0.1, 51.5], [-0.095, 51.508], [-0.11, 51.51]],
          },
          legs: [
            {
              steps: [
                {
                  name: 'Strand',
                  distance: 1400,
                  duration: 1020,
                  maneuver: { type: 'depart', modifier: 'straight', location: [-0.1, 51.5] },
                },
              ],
            },
          ],
        },
      ],
    }),
  });

  const result = await calculatePedestrianRoutes(
    { latitude: 51.5, longitude: -0.1 },
    { latitude: 51.51, longitude: -0.11 },
    { fetchFn: fakeFetch }
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.routes.length, 2);

  // Check first alternative
  const r1 = result.routes[0];
  assert.equal(r1.distanceMeters, 1250);
  assert.equal(r1.distanceFormatted, '1.3 km');
  assert.equal(r1.durationFormatted, '15 min');
  assert.equal(r1.steps.length, 2);
  assert.equal(r1.steps[0].instruction, 'Head out on Fleet Street');
  assert.equal(r1.steps[1].instruction, 'Turn right onto Chancery Lane');

  // Check second alternative
  const r2 = result.routes[1];
  assert.equal(r2.distanceMeters, 1400);
  assert.equal(r2.distanceFormatted, '1.4 km');
  assert.equal(r2.durationFormatted, '17 min');

  // Verify alignment with RouteOption domain contract
  assert.equal(r1.profile, 'foot');
  assert.equal(r1.provider, 'osrm-foot');
  assert.ok(Array.isArray(r1.geometry.coordinates));
  assert.ok(r1.steps[0].maneuver);
  assert.equal(typeof r1.steps[0].maneuver.instruction, 'string');
  assert.ok(Array.isArray(r1.steps[0].maneuver.location));
});

test('clientRoutingService: generates stable deterministic route IDs from route signatures', async () => {
  const fakeRoute = {
    distance: 750,
    duration: 540,
    geometry: {
      type: 'LineString',
      coordinates: [[-0.128, 51.508], [-0.126, 51.509], [-0.124, 51.511]],
    },
    legs: [
      {
        steps: [
          {
            name: 'Strand',
            distance: 750,
            duration: 540,
            maneuver: { type: 'depart', modifier: 'straight', location: [-0.128, 51.508] },
          },
        ],
      },
    ],
  };

  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      code: 'Ok',
      routes: [fakeRoute],
    }),
  });

  const run1 = await calculatePedestrianRoutes(
    { latitude: 51.508, longitude: -0.128 },
    { latitude: 51.511, longitude: -0.124 },
    { fetchFn: fakeFetch }
  );

  const run2 = await calculatePedestrianRoutes(
    { latitude: 51.508, longitude: -0.128 },
    { latitude: 51.511, longitude: -0.124 },
    { fetchFn: fakeFetch }
  );

  assert.equal(run1.ok, true);
  assert.equal(run2.ok, true);
  // Route ID must be identical across calls (no Date.now() timestamp drift)
  assert.equal(run1.routes[0].id, run2.routes[0].id);
  assert.match(run1.routes[0].id, /^route-foot-1-[a-f0-9]{8}$/);

  // Different geometry must produce different route ID
  const sig1 = generateRouteSignature(0, [[0, 0], [1, 1]], 100, 60, 'foot');
  const sig2 = generateRouteSignature(0, [[0, 0], [2, 2]], 200, 120, 'foot');
  assert.notEqual(sig1, sig2);
});

test('clientRoutingService: handles HTTP 429 rate limit error gracefully', async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 429,
  });

  const result = await calculatePedestrianRoutes(
    { latitude: 51.5, longitude: -0.1 },
    { latitude: 51.51, longitude: -0.11 },
    { fetchFn: fakeFetch }
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'RATE_LIMITED');
  assert.match(result.message, /rate-limited/);
});
