import { test, expect } from '@playwright/test';

test.describe('Walkscope Geospatial Gateway E2E Contract & Security Tests', () => {
  test('GET /health returns 200 with runtime memory & multi-tier cache telemetry', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('Walkscope Geospatial Gateway');
    expect(data.version).toBe('1.0.0');
    expect(typeof data.uptime).toBe('number');
    expect(typeof data.cacheEntries).toBe('number');
    expect(data.cacheTier).toBe('in-memory-l1');
    expect(data.memory).toBeDefined();
    expect(typeof data.memory.heapUsedMb).toBe('number');
    expect(typeof data.memory.rssMb).toBe('number');
  });

  test('GET /health/live and GET /health/ready container probes return 200', async ({ request }) => {
    const liveRes = await request.get('/health/live');
    expect(liveRes.status()).toBe(200);
    const liveData = await liveRes.json();
    expect(liveData.status).toBe('live');

    const readyRes = await request.get('/health/ready');
    expect(readyRes.status()).toBe(200);
    const readyData = await readyRes.json();
    expect(readyData.status).toBe('ready');
  });

  test('enforces Helmet security headers on all responses', async ({ request }) => {
    const response = await request.get('/health');
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  test('POST /api/v1/routes/pedestrian returns valid routing options with deterministic IDs', async ({ request }) => {
    const response = await request.post('/api/v1/routes/pedestrian', {
      data: {
        origin: { latitude: 12.9756, longitude: 77.6066 },
        destination: { latitude: 12.9719, longitude: 77.6070 },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.routes)).toBe(true);
    expect(data.routes.length).toBeGreaterThan(0);

    const primaryRoute = data.routes[0];
    expect(typeof primaryRoute.distanceMeters).toBe('number');
    expect(typeof primaryRoute.durationSeconds).toBe('number');
    expect(typeof primaryRoute.id).toBe('string');
    expect(primaryRoute.id.length).toBeGreaterThan(0);
    expect(Array.isArray(primaryRoute.geometry.coordinates)).toBe(true);
  });

  test('POST /api/v1/context/corridor computes honest amenities & density', async ({ request }) => {
    const response = await request.post('/api/v1/context/corridor', {
      data: {
        coordinates: [
          [77.6066, 12.9756],
          [77.6070, 12.9719],
        ],
        maxCorridorDistanceMeters: 120,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(typeof data.ok).toBe('boolean');
    expect(Array.isArray(data.features)).toBe(true);
    expect(typeof data.totalAmenitiesCount).toBe('number');
    expect(data.categoryBreakdown).toBeDefined();
    expect(data.disclaimer).toContain('OpenStreetMap');
  });

  test('GET /api/v1/geocode/search returns matching place suggestions', async ({ request }) => {
    const response = await request.get('/api/v1/geocode/search?q=MG%20Road&limit=5');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('rejects malformed and out-of-range coordinates with structured error responses', async ({ request }) => {
    const response = await request.post('/api/v1/routes/pedestrian', {
      data: {
        origin: { latitude: 999, longitude: 77.6066 },
        destination: { latitude: 12.9719, longitude: 77.6070 },
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.message).toBeDefined();
    expect(data.status).toBe('INVALID_INPUT');
    // Verify no filesystem paths or Node.js internal stacks leaked
    expect(JSON.stringify(data)).not.toContain('node_modules');
    expect(JSON.stringify(data)).not.toContain('.ts:');
  });
});
