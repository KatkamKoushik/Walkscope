import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../dist/server.js';
import { defaultCache } from '../dist/cache/cacheService.js';

describe('Geospatial Gateway Backend (packages/server)', () => {
  let app;

  before(async () => {
    app = await buildServer({ logger: false });
    await app.ready();
  });

  after(async () => {
    if (defaultCache.stop) defaultCache.stop();
    await app.close();
  });

  describe('GET /health & Security Headers', () => {
    it('returns service status and uptime', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      assert.equal(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.equal(data.status, 'ok');
      assert.equal(data.service, 'Walkscope Geospatial Gateway');
      assert.equal(typeof data.uptime, 'number');
    });

    it('enforces Helmet security headers (MIME-sniffing, X-Frame-Options)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.ok(response.headers['x-frame-options']);
    });
  });

  describe('POST /api/v1/routes/pedestrian', () => {
    it('rejects missing or malformed coordinates with HTTP 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/routes/pedestrian',
        payload: {
          origin: { latitude: 'invalid', longitude: -0.1281 },
          destination: { latitude: 51.5120, longitude: -0.1240 },
        },
      });

      assert.equal(response.statusCode, 400);
      const data = JSON.parse(response.payload);
      assert.equal(data.status, 'INVALID_INPUT');
    });

    it('rejects NaN or non-finite coordinates with HTTP 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/routes/pedestrian',
        payload: {
          origin: { latitude: NaN, longitude: -0.1281 },
          destination: { latitude: 51.5120, longitude: -0.1240 },
        },
      });

      assert.equal(response.statusCode, 400);
      const data = JSON.parse(response.payload);
      assert.equal(data.status, 'INVALID_INPUT');
    });

    it('rejects coordinates exceeding WGS-84 ranges with HTTP 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/routes/pedestrian',
        payload: {
          origin: { latitude: 120.5, longitude: -0.1281 },
          destination: { latitude: 51.5120, longitude: -0.1240 },
        },
      });

      assert.equal(response.statusCode, 400);
      const data = JSON.parse(response.payload);
      assert.match(data.message, /WGS-84/);
    });

    it('returns route result with cache headers', async () => {
      await defaultCache.clear();

      // First request -> MISS
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/routes/pedestrian',
        payload: {
          origin: { latitude: 51.5080, longitude: -0.1281 },
          destination: { latitude: 51.5120, longitude: -0.1240 },
        },
      });

      assert.equal(res1.statusCode, 200);
      assert.equal(res1.headers['x-cache-status'], 'MISS');
      const data1 = JSON.parse(res1.payload);
      assert.ok(data1.routes.length > 0);

      // Second identical request -> HIT
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/routes/pedestrian',
        payload: {
          origin: { latitude: 51.5080, longitude: -0.1281 },
          destination: { latitude: 51.5120, longitude: -0.1240 },
        },
      });

      assert.equal(res2.statusCode, 200);
      assert.equal(res2.headers['x-cache-status'], 'HIT');
      const data2 = JSON.parse(res2.payload);
      assert.equal(data2.routes[0].id, data1.routes[0].id);
    });
  });

  describe('POST /api/v1/context/corridor', () => {
    it('rejects empty coordinates with HTTP 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/context/corridor',
        payload: { coordinates: [] },
      });

      assert.equal(response.statusCode, 400);
      const data = JSON.parse(response.payload);
      assert.match(data.error, /non-empty array/);
    });

    it('rejects coordinates array exceeding 2000 points with HTTP 400', async () => {
      const oversized = Array.from({ length: 2001 }, () => [77.60, 12.97]);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/context/corridor',
        payload: { coordinates: oversized },
      });

      assert.equal(response.statusCode, 400);
      const data = JSON.parse(response.payload);
      assert.match(data.error, /exceeds maximum allowed length/);
    });

    it('rejects malformed coordinate pairs inside array with HTTP 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/context/corridor',
        payload: { coordinates: [[77.6, 12.9], ['bad', null]] },
      });

      assert.equal(response.statusCode, 400);
      const data = JSON.parse(response.payload);
      assert.match(data.error, /finite numeric/);
    });

    it('returns honest context corridor evaluation with caching', async () => {
      await defaultCache.clear();

      const coords = [
        [-0.1281, 51.5080],
        [-0.1240, 51.5120],
      ];

      // Request 1 -> MISS
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/context/corridor',
        payload: {
          coordinates: coords,
          maxCorridorDistanceMeters: 120,
        },
      });

      assert.equal(res1.statusCode, 200);
      assert.equal(res1.headers['x-cache-status'], 'MISS');
      const data1 = JSON.parse(res1.payload);
      assert.equal(data1.evaluatedBufferDistanceM, 120);
      assert.ok('categoryBreakdown' in data1);
      assert.match(data1.disclaimer, /OpenStreetMap/);
    });
  });

  describe('GET /api/v1/imagery/tiles/:z/:x/:y', () => {
    it('rejects invalid tile coordinates with HTTP 400', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/imagery/tiles/abc/1/2',
      });

      assert.equal(response.statusCode, 400);
    });

    it('rejects out-of-bounds zoom or tile index with HTTP 400', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/imagery/tiles/25/1/1',
      });

      assert.equal(response.statusCode, 400);
    });

    it('returns trimmed protobuf vector tile with cache headers', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/v1/imagery/tiles/14/8192/5460',
      });

      assert.equal(res1.statusCode, 200);
      assert.equal(res1.headers['content-type'], 'application/x-protobuf');
      assert.equal(res1.headers['x-cache-status'], 'MISS');

      // Second request -> HIT
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/imagery/tiles/14/8192/5460',
      });

      assert.equal(res2.statusCode, 200);
      assert.equal(res2.headers['x-cache-status'], 'HIT');
    });
  });

  describe('GET /api/v1/imagery/nearby', () => {
    it('rejects invalid or out-of-range coordinates with HTTP 400', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/imagery/nearby?lat=999&lon=0',
      });

      assert.equal(response.statusCode, 400);
      const data = JSON.parse(response.payload);
      assert.match(data.error, /WGS-84/);
    });
  });

  describe('GET /api/v1/geocode/search', () => {
    it('returns empty array for single-character query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/geocode/search?q=a',
      });

      assert.equal(response.statusCode, 200);
      const data = JSON.parse(response.payload);
      assert.deepEqual(data, []);
    });

    it('matches benchmark location (Bengaluru MG Road) with cache', async () => {
      await defaultCache.clear();

      // First query -> MISS
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/v1/geocode/search?q=MG%20Road',
      });

      assert.equal(res1.statusCode, 200);
      assert.equal(res1.headers['x-cache-status'], 'MISS');
      const data1 = JSON.parse(res1.payload);
      assert.ok(data1.length > 0);
      assert.match(data1[0].title, /MG Road/);

      // Second query -> HIT
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/geocode/search?q=MG%20Road',
      });

      assert.equal(res2.statusCode, 200);
      assert.equal(res2.headers['x-cache-status'], 'HIT');
      const data2 = JSON.parse(res2.payload);
      assert.equal(data2[0].title, data1[0].title);
    });
  });
});
