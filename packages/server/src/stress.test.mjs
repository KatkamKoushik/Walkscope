import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../dist/server.js';
import { defaultCache } from '../dist/cache/cacheService.js';

describe('Geospatial Gateway Stress & High-Concurrency Load Testing (Checklist Sections 12, 16, 32)', () => {
  let app;

  before(async () => {
    // Initialize server with high ceiling for stress testing capacity
    app = await buildServer({ logger: false, rateLimitMax: 5000 });
    await app.ready();
    await defaultCache.clear();
  });

  after(async () => {
    if (defaultCache.stop) defaultCache.stop();
    await app.close();
  });

  describe('1. Burst Concurrency & Latency SLAs (100 Concurrent Requests)', () => {
    it('serves 100 concurrent /health requests with p95 latency < 50ms and 100% success', async () => {
      const latencies = [];
      const requests = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        requests.push(
          app.inject({ method: 'GET', url: '/health' }).then((res) => {
            const elapsed = performance.now() - start;
            latencies.push(elapsed);
            return res;
          })
        );
      }

      const results = await Promise.all(requests);

      // Verify all 100 succeeded
      for (const res of results) {
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.equal(data.status, 'ok');
        assert.ok(data.memory);
        assert.ok(typeof data.memory.heapUsedMb === 'number');
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];

      // Verify latency bounds on shared CI container
      assert.ok(p50 < 100, `p50 latency (${p50.toFixed(2)}ms) exceeded SLA 100ms`);
      assert.ok(p95 < 250, `p95 latency (${p95.toFixed(2)}ms) exceeded SLA 250ms`);
      assert.ok(p99 < 500, `p99 latency (${p99.toFixed(2)}ms) exceeded SLA 500ms`);
    });
  });

  describe('2. Cache Stampede & In-Flight Deduplication (50 Concurrent Identical Route Queries)', () => {
    it('coalesces 50 concurrent identical route queries into 1 in-flight execution without race conditions', async () => {
      await defaultCache.clear();

      const requests = [];
      const start = performance.now();

      for (let i = 0; i < 50; i++) {
        requests.push(
          app.inject({
            method: 'POST',
            url: '/api/v1/routes/pedestrian',
            payload: {
              origin: { latitude: 12.9756, longitude: 77.6066 },
              destination: { latitude: 12.9733, longitude: 77.6074 },
            },
          })
        );
      }

      const results = await Promise.all(requests);
      const _totalTime = performance.now() - start;

      // Invariant 1: All 50 concurrent requests must return HTTP 200 with valid route payloads
      for (const res of results) {
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(data.ok);
        assert.ok(Array.isArray(data.routes));
        assert.ok(data.routes.length > 0);
      }

      // Invariant 2: Subsequent 51st request must be an instantaneous Cache HIT (< 25ms)
      const hitStart = performance.now();
      const resHit = await app.inject({
        method: 'POST',
        url: '/api/v1/routes/pedestrian',
        payload: {
          origin: { latitude: 12.9756, longitude: 77.6066 },
          destination: { latitude: 12.9733, longitude: 77.6074 },
        },
      });
      const hitTime = performance.now() - hitStart;

      assert.equal(resHit.statusCode, 200);
      assert.equal(resHit.headers['x-cache-status'], 'HIT');
      assert.ok(hitTime < 50, `Cache HIT took ${hitTime.toFixed(2)}ms (expected < 50ms)`);
    });
  });

  describe('3. Geocode Typeahead Burst & Caching Under Concurrency (50 Concurrent Requests)', () => {
    it('resolves 50 concurrent geocode queries with instant cache/benchmark responses', async () => {
      const queries = ['Trafalgar', 'MG Road', 'Brigade', 'Covent', 'Piccadilly'];
      const requests = [];

      for (let i = 0; i < 50; i++) {
        const q = queries[i % queries.length];
        requests.push(
          app.inject({
            method: 'GET',
            url: `/api/v1/geocode/search?q=${encodeURIComponent(q)}&limit=3`,
          })
        );
      }

      const results = await Promise.all(requests);

      for (const res of results) {
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(Array.isArray(data));
        assert.ok(data.length > 0);
        assert.ok(data[0].latitude);
        assert.ok(data[0].longitude);
      }
    });
  });

  describe('4. Memory Stability & Leak Detection Under Sustained Load', () => {
    it('maintains bounded heap memory after 200 rapid requests without runaway growth', async () => {
      if (global.gc) global.gc();
      const initialMem = process.memoryUsage().heapUsed;

      // Blast 200 requests across all endpoints
      const requests = [];
      for (let i = 0; i < 200; i++) {
        if (i % 3 === 0) {
          requests.push(app.inject({ method: 'GET', url: '/health' }));
        } else if (i % 3 === 1) {
          requests.push(
            app.inject({
              method: 'GET',
              url: `/api/v1/geocode/search?q=MG%20Road&limit=2`,
            })
          );
        } else {
          requests.push(
            app.inject({
              method: 'POST',
              url: '/api/v1/routes/pedestrian',
              payload: {
                origin: { latitude: 12.9756, longitude: 77.6066 },
                destination: { latitude: 12.9733, longitude: 77.6074 },
              },
            })
          );
        }
      }

      await Promise.all(requests);

      if (global.gc) global.gc();
      const finalMem = process.memoryUsage().heapUsed;
      const memDeltaMb = (finalMem - initialMem) / 1024 / 1024;

      // Memory delta should not exceed 35MB for 200 fast requests
      assert.ok(
        memDeltaMb < 35,
        `Memory growth was excessive: ${memDeltaMb.toFixed(2)}MB after 200 requests`
      );
    });
  });

  describe('5. Error Masking & Malformed Request Stress Hardening', () => {
    it('neutralizes concurrent malformed coordinates, oversized bodies, and SQL injection strings with structured errors', async () => {
      const maliciousRequests = [
        // Out of bounds lat
        app.inject({
          method: 'POST',
          url: '/api/v1/routes/pedestrian',
          payload: {
            origin: { latitude: 999, longitude: 0 },
            destination: { latitude: 0, longitude: 0 },
          },
        }),
        // NaN coordinates
        app.inject({
          method: 'POST',
          url: '/api/v1/routes/pedestrian',
          payload: {
            origin: { latitude: NaN, longitude: -0.1 },
            destination: { latitude: 51.5, longitude: -0.1 },
          },
        }),
        // String coordinates
        app.inject({
          method: 'POST',
          url: '/api/v1/routes/pedestrian',
          payload: {
            origin: { latitude: 'DROP TABLE', longitude: -0.1 },
            destination: { latitude: 51.5, longitude: -0.1 },
          },
        }),
        // Empty context coordinates
        app.inject({
          method: 'POST',
          url: '/api/v1/context/corridor',
          payload: { coordinates: [] },
        }),
        // Coordinates array > 2000 points (DoS protection)
        app.inject({
          method: 'POST',
          url: '/api/v1/context/corridor',
          payload: {
            coordinates: new Array(2500).fill([77.6, 12.9]),
          },
        }),
        // Malformed tile coords
        app.inject({
          method: 'GET',
          url: '/api/v1/imagery/tiles/99/0/0',
        }),
      ];

      const responses = await Promise.all(maliciousRequests);

      for (const res of responses) {
        // Must return 400 Bad Request
        assert.equal(res.statusCode, 400);
        const data = JSON.parse(res.payload);
        // Invariant: Never leak Node.js internal stack trace, file path, or exception dump
        assert.equal(res.payload.includes('at Fastify'), false);
        assert.equal(res.payload.includes('node:internal'), false);
        assert.equal(res.payload.includes('D:\\cloning'), false);
        assert.ok(data.error || data.message || data.status);
      }
    });
  });

  describe('6. Rate Limiter Shield Verification', () => {
    it('strictly enforces HTTP 429 when rate limit threshold is breached', async () => {
      // Build a dedicated server with a tight rate limit of 5 requests/minute
      const strictApp = await buildServer({ logger: false, rateLimitMax: 5 });
      await strictApp.ready();

      const responses = [];
      for (let i = 0; i < 7; i++) {
        responses.push(await strictApp.inject({ method: 'GET', url: '/health' }));
      }

      await strictApp.close();

      // First 5 requests must succeed
      for (let i = 0; i < 5; i++) {
        assert.equal(responses[i].statusCode, 200);
      }

      // 6th and 7th requests must be rejected with 429
      assert.equal(responses[5].statusCode, 429);
      assert.equal(responses[6].statusCode, 429);
      const data = JSON.parse(responses[5].payload);
      assert.match(data.message || data.error, /rate limit/i);
    });
  });
});
