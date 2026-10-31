import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateOpeningHours,
  parseTimeToMinutes,
  parseDayRange,
} from './openingHoursService.js';
import {
  evaluateRouteVenues,
  calculateMajorRoadShare,
  evaluateVerifiedSupportPoints,
  computeRouteIntelligence,
} from './routeIntelligenceService.js';
import {
  calculateCorridorBounds,
  minDistancePointToPolylineM,
} from '../providers/amenities/overpassClient.js';
import { haversineKm } from '../providers/common/geo.js';

describe('Fuzz Testing & Invariant Hardening (Checklist Sections 9, 24)', () => {
  describe('Opening Hours Parser Fuzzer & ReDoS Resistance', () => {
    it('handles malformed, extreme, and catastrophic backtracking pattern candidates safely in <5ms', () => {
      const candidates = [
        // ReDoS / catastrophic backtrack traps
        'Mo-Fr '.repeat(100) + '09:00-18:00',
        'Su,'.repeat(200) + '24/7',
        '09:00-10:00;'.repeat(150),
        'Mo-Fr 08:00-12:00,13:00-17:00,18:00-22:00,23:00-02:00; Sa 09:00-14:00',
        // 5000+ character spam
        'a'.repeat(5000),
        '99:99-99:99; '.repeat(50),
        // Unicode & emojis
        '🕒 24/7 🚀 Mo-Su 10:00-20:00 🌟',
        'مفتوح 24 ساعة',
        '24/7\x00NULL\r\nDROP TABLE',
        // Broken intervals and edge times
        '24:01-25:00',
        '-05:00-12:00',
        '12:00-',
        '-18:00',
        '12:60-14:00',
        'sunrise-sunset; Mo-Fr 09:00-17:00',
        'Mo-We,Fr,Sa-Su 08:30-17:30',
        'off; Mo-Fr 09:00-18:00',
        'Mo-Su 00:00-24:00',
        // Null / undefined / object types
        null,
        undefined,
        '',
        '   ',
        '\t\n\r',
      ];

      for (const raw of candidates) {
        const start = performance.now();
        const res = evaluateOpeningHours(raw, new Date('2026-10-31T21:00:00Z'));
        const duration = performance.now() - start;

        // Invariant 1: Must never hang (must complete in under 5ms even for 5000 chars)
        assert.ok(duration < 5, `Parsing took too long (${duration.toFixed(2)}ms) for input: ${String(raw).slice(0, 30)}`);
        // Invariant 2: Must return a valid structured result
        assert.ok(['OPEN', 'CLOSED', 'UNKNOWN'].includes(res.status));
        assert.ok(typeof res.status === 'string');
      }
    });

    it('fuzzes parseTimeToMinutes with invalid and out-of-range times', () => {
      const invalidTimes = [
        '24:01', '25:00', '-01:00', '12:60', '12:99', 'ab:cd',
        '1:2', '123:45', '', ' ', null, undefined, 123, {}, [],
        '12:00:00', '12.00', 'noon', 'midnight'
      ];

      for (const t of invalidTimes) {
        const mins = parseTimeToMinutes(t);
        assert.equal(mins, null, `Expected null for invalid time ${t}`);
      }

      // Valid boundary times
      assert.equal(parseTimeToMinutes('00:00'), 0);
      assert.equal(parseTimeToMinutes('23:59'), 1439);
      assert.equal(parseTimeToMinutes('24:00'), 1440);
    });

    it('fuzzes parseDayRange with chaotic day strings', () => {
      const inputs = [
        'Mo-Fr', 'Sa,Su', 'Mo,We,Fr', 'Su-Sa', 'Invalid-Day',
        '', '   ', 'Mo-', '-Fr', 'Mo-Fr-Sa', 'Mo,Mo,Mo',
        'Mo-Su,Mo-Su', '123', null, undefined
      ];

      for (const input of inputs) {
        assert.doesNotThrow(() => {
          const res = parseDayRange(input || '');
          assert.ok(Array.isArray(res));
          for (const day of res) {
            assert.ok(day >= 0 && day <= 6);
          }
        });
      }
    });
  });

  describe('Geospatial Polyline & Coordinate Fuzzer', () => {
    it('handles single-point, degenerate, and zero-distance polylines', () => {
      // Single point polyline
      const singlePointPoly = [[77.6066, 12.9756]];
      const dist = minDistancePointToPolylineM([77.6066, 12.9756], singlePointPoly);
      assert.equal(dist, 0);

      // Distance to distant point
      const distFar = minDistancePointToPolylineM([77.6066, 13.0], singlePointPoly);
      assert.ok(distFar > 0 && Number.isFinite(distFar));

      // Empty polyline returns Infinity safely
      const distEmpty = minDistancePointToPolylineM([77.6066, 12.9756], []);
      assert.equal(distEmpty, Infinity);
    });

    it('haversineKm never returns NaN for any coordinate pair', () => {
      const pairs = [
        [0, 0, 0, 0],
        [90, 0, -90, 0], // Antipodal points (poles)
        [0, 180, 0, -180], // Date line boundary
        [12.9756, 77.6066, 12.9756, 77.6066], // Identical points
        [-89.999, -179.999, 89.999, 179.999], // Maximum diagonal
      ];

      for (const [lat1, lon1, lat2, lon2] of pairs) {
        const d = haversineKm(lat1, lon1, lat2, lon2);
        assert.ok(Number.isFinite(d), `Distance was non-finite for (${lat1},${lon1}) -> (${lat2},${lon2})`);
        assert.ok(d >= 0, `Distance was negative for (${lat1},${lon1}) -> (${lat2},${lon2})`);
      }
    });

    it('calculateCorridorBounds clamps and rejects out-of-bounds geometries', () => {
      // Anti-DoS degree span guard (> 1.0 degree span throws)
      assert.throws(() => {
        calculateCorridorBounds([[70.0, 10.0], [75.0, 15.0]]);
      }, /span exceeds/i);

      // Empty coordinates throw cleanly
      assert.throws(() => {
        calculateCorridorBounds([]);
      }, /non-empty array/i);

      // Valid corridor bounding box
      const validCoords = [
        [77.6066, 12.9756],
        [77.6074, 12.9733],
      ];
      const bbox = calculateCorridorBounds(validCoords, 0.001);
      assert.ok(bbox.south < bbox.north);
      assert.ok(bbox.west < bbox.east);
      assert.ok(bbox.south >= -90 && bbox.north <= 90);
      assert.ok(bbox.west >= -180 && bbox.east <= 180);
    });
  });

  describe('Route Context Intelligence Boundary Fuzzing', () => {
    const samplePolyline = [
      [77.6066, 12.9756],
      [77.6070, 12.9745],
      [77.6074, 12.9733],
    ];

    it('evaluates venues safely under extreme walking speeds (0, negative, 1000, NaN)', () => {
      const venues = [
        {
          id: 'v1',
          name: 'Night Coffee',
          category: 'services',
          coordinates: [77.6070, 12.9745],
          tags: { opening_hours: '20:00-04:00', shop: 'coffee' },
        },
      ];

      const extremeSpeeds = [0, -5, 1000, NaN, null, undefined];
      for (const speed of extremeSpeeds) {
        assert.doesNotThrow(() => {
          const res = evaluateRouteVenues(
            venues,
            samplePolyline,
            500,
            { walkingSpeedMs: speed, departureTime: new Date('2026-10-31T21:00:00Z') }
          );
          assert.ok(res);
          assert.ok(typeof res.totalVenuesCount === 'number');
          assert.ok(typeof res.longestGapMeters === 'number');
        });
      }
    });

    it('calculateMajorRoadShare handles empty steps and malformed road distances', () => {
      assert.doesNotThrow(() => {
        const res = calculateMajorRoadShare([], 0);
        assert.equal(res.majorRoadPercent, 0);
      });

      assert.doesNotThrow(() => {
        const res = calculateMajorRoadShare(
          [
            { distanceMeters: NaN, roadName: null },
            { distanceMeters: -100, roadName: undefined },
          ],
          0
        );
        assert.ok(Number.isFinite(res.majorRoadPercent));
      });
    });

    it('evaluateVerifiedSupportPoints handles empty routes and extreme search radii', () => {
      const res = evaluateVerifiedSupportPoints([], undefined, 0);
      assert.equal(res.verifiedPointsCount, 0);

      const resHuge = evaluateVerifiedSupportPoints(samplePolyline, undefined, 100000);
      assert.ok(resHuge.verifiedPointsCount >= 0);
    });

    it('computeRouteIntelligence executes end-to-end without throwing on empty or partial data', () => {
      assert.doesNotThrow(() => {
        const intel = computeRouteIntelligence({
          polyline: samplePolyline,
          distanceMeters: 500,
          steps: [],
          amenities: [],
          options: {
            walkingSpeedMs: 1.2,
            departureTime: new Date().toISOString(),
          },
        });

        assert.ok(intel);
        assert.ok(intel.reproducibility);
        assert.equal(intel.venueIntelligence.totalVenuesCount, 0);
        // By default, 0 verified support points are returned without audited location evidence
        assert.equal(intel.supportIntelligence.verifiedPointsCount, 0);
      });
    });
  });

  describe('Multi-Timezone Verification (Checklist Section 6 & 32)', () => {
    it('evaluates opening hours in the venue local timezone rather than the host runtime timezone', () => {
      // UTC Instant: 2026-10-31T18:45:00Z (Saturday evening in London, Sunday early morning in Bengaluru)
      const targetUtc = new Date('2026-10-31T18:45:00.000Z');

      // Venue 1: in London (coordinates ~ [-0.1281, 51.5080]), local time: Saturday 18:45 (UTC+0)
      const londonVenue = {
        id: 'v-london',
        name: 'West End Bookshop',
        category: 'services',
        coordinates: [-0.1281, 51.5080],
        tags: { opening_hours: 'Mo-Sa 10:00-20:00; Su off' },
      };

      // Venue 2: in Bengaluru (coordinates ~ [77.6070, 12.9745]), local time: Sunday 00:15 (UTC+5:30)
      const bengaluruVenue = {
        id: 'v-bengaluru',
        name: 'MG Road Bookshop',
        category: 'services',
        coordinates: [77.6070, 12.9745],
        tags: { opening_hours: 'Mo-Sa 10:00-20:00; Su off' },
      };

      // At UTC 18:45, London venue is OPEN (Saturday 18:45 within 10:00-20:00)
      const londonRes = evaluateRouteVenues(
        [londonVenue],
        [[-0.1281, 51.5080], [-0.1240, 51.5120]],
        400,
        { walkingSpeedMs: 1.2, departureTime: targetUtc }
      );
      assert.equal(londonRes.venues[0].openingStatus, 'OPEN', 'London venue should be OPEN at Saturday 18:45 local');

      // At the exact same UTC instant, Bengaluru venue is CLOSED (Sunday 00:15 is Sunday off!)
      const bengaluruRes = evaluateRouteVenues(
        [bengaluruVenue],
        [[77.6066, 12.9756], [77.6074, 12.9733]],
        400,
        { walkingSpeedMs: 1.2, departureTime: targetUtc }
      );
      assert.equal(bengaluruRes.venues[0].openingStatus, 'CLOSED', 'Bengaluru venue should be CLOSED at Sunday 00:15 local');
    });
  });
});
