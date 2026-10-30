import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCorridorBounds,
  distancePointToSegmentM,
  minDistancePointToPolylineM,
  buildOverpassQuery,
  categorizeOsmTags,
  normalizeOsmElement,
  fetchCorridorAmenities,
  OVERPASS_DISCLAIMER,
} from './overpassClient.js';

describe('overpassClient', () => {
  describe('calculateCorridorBounds', () => {
    it('computes correct bounding box with buffer', () => {
      const coords = [
        [-0.1281, 51.5080],
        [-0.1240, 51.5120],
      ];
      const bounds = calculateCorridorBounds(coords, 0.001);
      assert.ok(Math.abs(bounds.south - (51.5080 - 0.001)) < 1e-6);
      assert.ok(Math.abs(bounds.north - (51.5120 + 0.001)) < 1e-6);
      assert.ok(Math.abs(bounds.west - (-0.1281 - 0.001)) < 1e-6);
      assert.ok(Math.abs(bounds.east - (-0.1240 + 0.001)) < 1e-6);
    });

    it('clamps values at world boundaries', () => {
      const coords = [[-179.999, -89.999]];
      const bounds = calculateCorridorBounds(coords, 0.01);
      assert.equal(bounds.south, -90);
      assert.equal(bounds.west, -180);
    });

    it('throws when coordinates array is empty or malformed', () => {
      assert.throws(() => calculateCorridorBounds([]), /non-empty array/);
      assert.throws(() => calculateCorridorBounds('not an array'), /non-empty array/);
    });

    it('throws when coordinate span exceeds 1.0 degree', () => {
      const farCoords = [
        [0, 50],
        [2.5, 52],
      ];
      assert.throws(() => calculateCorridorBounds(farCoords), /exceeds maximum allowable pedestrian bounding box/);
    });
  });

  describe('polyline distance calculation', () => {
    it('calculates point to segment distance correctly', () => {
      // Segment along equator: (0, 0) to (0.01, 0)
      // Point directly 0.0005 deg north (~55 meters)
      const dist = distancePointToSegmentM(0.005, 0.0005, 0, 0, 0.01, 0);
      assert.ok(dist > 50 && dist < 60, `Expected ~55m, got ${dist}`);
    });

    it('handles point beyond segment endpoints by clamping', () => {
      // Point 0.001 deg west of start endpoint
      const dist = distancePointToSegmentM(-0.001, 0, 0, 0, 0.01, 0);
      assert.ok(dist > 100 && dist < 120, `Expected ~111m, got ${dist}`);
    });

    it('calculates minimum distance to multi-segment polyline', () => {
      const polyline = [
        [77.605, 12.975],
        [77.606, 12.975],
        [77.606, 12.976],
      ];
      // Point right on first segment
      const d1 = minDistancePointToPolylineM([77.6055, 12.975], polyline);
      assert.ok(d1 < 1, `Expected < 1m, got ${d1}`);

      // Point ~50m away from the corner
      const d2 = minDistancePointToPolylineM([77.6065, 12.975], polyline);
      assert.ok(d2 > 40 && d2 < 65, `Expected ~50m, got ${d2}`);
    });
  });

  describe('buildOverpassQuery', () => {
    it('generates a valid Overpass QL query string', () => {
      const bounds = { south: 12.97, west: 77.59, north: 12.98, east: 77.60 };
      const query = buildOverpassQuery(bounds, 5);
      assert.match(query, /\[out:json\]\[timeout:5\];/);
      assert.match(query, /node\["highway"="bus_stop"\]/);
      assert.match(query, /node\["amenity"~"police\|fire_station/);
      assert.match(query, /node\["highway"="street_lamp"\]/);
    });
  });

  describe('categorizeOsmTags', () => {
    it('identifies transit tags', () => {
      assert.equal(categorizeOsmTags({ highway: 'bus_stop' }), 'transit');
      assert.equal(categorizeOsmTags({ railway: 'subway_entrance' }), 'transit');
    });

    it('identifies emergency tags', () => {
      assert.equal(categorizeOsmTags({ amenity: 'police' }), 'emergency');
      assert.equal(categorizeOsmTags({ amenity: 'fire_station' }), 'emergency');
    });

    it('identifies services tags', () => {
      assert.equal(categorizeOsmTags({ amenity: 'pharmacy' }), 'services');
      assert.equal(categorizeOsmTags({ shop: 'convenience' }), 'services');
    });

    it('identifies lighting tags', () => {
      assert.equal(categorizeOsmTags({ highway: 'street_lamp' }), 'lighting');
    });

    it('falls back to other for unknown tags', () => {
      assert.equal(categorizeOsmTags({ tourism: 'artwork' }), 'other');
    });
  });

  describe('normalizeOsmElement', () => {
    it('normalizes OSM element with honest context disclosures', () => {
      const elem = {
        type: 'node',
        id: 123456,
        lat: 51.5085,
        lon: -0.1275,
        tags: {
          amenity: 'pharmacy',
          name: 'St. Martin Pharmacy',
        },
      };

      const norm = normalizeOsmElement(elem);
      assert.ok(norm);
      assert.equal(norm.id, 'osm_node_123456');
      assert.equal(norm.name, 'St. Martin Pharmacy');
      assert.equal(norm.category, 'services');
      assert.equal(norm.verificationStatus, 'mapped_unverified');
      assert.equal(norm.disclaimer, OVERPASS_DISCLAIMER);
      assert.deepEqual(norm.coordinates, [-0.1275, 51.5085]);
    });

    it('returns null for invalid elements', () => {
      assert.equal(normalizeOsmElement(null), null);
      assert.equal(normalizeOsmElement({ type: 'node' }), null);
    });
  });

  describe('fetchCorridorAmenities', () => {
    it('fetches and filters features strictly within route corridor', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          elements: [
            {
              type: 'node',
              id: 999,
              lat: 12.97505, // ~6 meters from polyline
              lon: 77.605,
              tags: { highway: 'bus_stop', name: 'Near Metro Stop' },
            },
            {
              type: 'node',
              id: 888,
              lat: 12.979, // ~440 meters away (in bbox corner)
              lon: 77.605,
              tags: { amenity: 'pharmacy', name: 'Far Away Pharmacy' },
            },
          ],
        }),
      });

      const res = await fetchCorridorAmenities([[77.605, 12.97500], [77.606, 12.97500]], {
        fetchFn: mockFetch,
        maxCorridorDistanceMeters: 100,
      });

      // Far Away Pharmacy (440m) must be filtered out!
      assert.equal(res.features.length, 1);
      assert.equal(res.features[0].name, 'Near Metro Stop');
      assert.equal(res.features[0].category, 'transit');
      assert.ok(res.features[0].distanceFromRouteM !== undefined);
      assert.ok(res.features[0].distanceFromRouteM < 20);
    });

    it('handles HTTP 429 rate limit gracefully', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 429,
      });

      const res = await fetchCorridorAmenities([[77.605, 12.975]], { fetchFn: mockFetch });
      assert.equal(res.features.length, 0);
      assert.match(res.error, /rate-limited/i);
    });

    it('filters out elements located in bounding box corner on route bends', async () => {
      // L-shaped route: East from (77.600, 12.970) to (77.610, 12.970), then North to (77.610, 12.980)
      const bendCoords = [
        [77.600, 12.970],
        [77.610, 12.970],
        [77.610, 12.980],
      ];

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          elements: [
            {
              type: 'node',
              id: 101,
              // Corner of bbox (North-West corner) - ~1.1 km away from path
              lat: 12.980,
              lon: 77.600,
              tags: { amenity: 'hospital', name: 'Far Bbox Corner Hospital' },
            },
            {
              type: 'node',
              id: 102,
              // Along the North-running leg, ~30m East of segment
              lat: 12.975,
              lon: 77.6103,
              tags: { amenity: 'pharmacy', name: 'Bend Pharmacy' },
            },
          ],
        }),
      });

      const res = await fetchCorridorAmenities(bendCoords, {
        fetchFn: mockFetch,
        maxCorridorDistanceMeters: 100,
      });

      assert.equal(res.features.length, 1);
      assert.equal(res.features[0].id, 'osm_node_102');
      assert.equal(res.features[0].name, 'Bend Pharmacy');
      assert.ok(res.features[0].distanceFromRouteM < 50);
    });

    it('correctly filters features along diagonal walking routes', async () => {
      // Diagonal route from (0,0) to (0.01, 0.01)
      const diagonalRoute = [
        [0.0, 0.0],
        [0.01, 0.01],
      ];

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          elements: [
            {
              type: 'node',
              id: 201,
              // Slightly off diagonal (~15m)
              lat: 0.0050,
              lon: 0.0051,
              tags: { highway: 'bus_stop', name: 'Diagonal Bus Stop' },
            },
            {
              type: 'node',
              id: 202,
              // Bounding box corner (0.0, 0.01), ~780m off diagonal
              lat: 0.01,
              lon: 0.0,
              tags: { amenity: 'police', name: 'Off-Axis Station' },
            },
          ],
        }),
      });

      const res = await fetchCorridorAmenities(diagonalRoute, {
        fetchFn: mockFetch,
        maxCorridorDistanceMeters: 80,
      });

      assert.equal(res.features.length, 1);
      assert.equal(res.features[0].id, 'osm_node_201');
      assert.equal(res.features[0].name, 'Diagonal Bus Stop');
    });

    it('deduplicates features with identical element IDs from overlapping queries', async () => {
      const coords = [
        [77.605, 12.975],
        [77.606, 12.975],
      ];

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          elements: [
            {
              type: 'node',
              id: 301,
              lat: 12.97505,
              lon: 77.6055,
              tags: { highway: 'bus_stop', name: 'Shared Metro Stop' },
            },
            {
              type: 'node',
              id: 301, // duplicate node from overlapping partition
              lat: 12.97505,
              lon: 77.6055,
              tags: { highway: 'bus_stop', name: 'Shared Metro Stop' },
            },
          ],
        }),
      });

      const res = await fetchCorridorAmenities(coords, { fetchFn: mockFetch });
      assert.equal(res.features.length, 1);
      assert.equal(res.features[0].id, 'osm_node_301');
    });

    it('strictly enforces configured maxCorridorDistanceMeters threshold', async () => {
      const coords = [
        [0.0, 0.0],
        [0.01, 0.0],
      ];

      // Point at 0.005 lon, 0.0013 lat (~143 meters North)
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          elements: [
            {
              type: 'node',
              id: 401,
              lat: 0.0013,
              lon: 0.005,
              tags: { shop: 'convenience', name: 'Edge Store' },
            },
          ],
        }),
      });

      // At 100m cutoff: excluded
      const resNarrow = await fetchCorridorAmenities(coords, {
        fetchFn: mockFetch,
        maxCorridorDistanceMeters: 100,
      });
      assert.equal(resNarrow.features.length, 0);

      // At 200m cutoff: included
      const resWide = await fetchCorridorAmenities(coords, {
        fetchFn: mockFetch,
        maxCorridorDistanceMeters: 200,
      });
      assert.equal(resWide.features.length, 1);
      assert.equal(resWide.features[0].id, 'osm_node_401');
      assert.ok(resWide.features[0].distanceFromRouteM > 130 && resWide.features[0].distanceFromRouteM < 160);
    });

    it('handles timeout gracefully', async () => {
      const mockFetch = async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      };

      const res = await fetchCorridorAmenities([[77.605, 12.975]], { fetchFn: mockFetch });
      assert.equal(res.features.length, 0);
      assert.match(res.error, /timed out/i);
    });
  });
});
