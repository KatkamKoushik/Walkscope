import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateContextCoverage,
  CONTEXT_SCORE_NAME,
  CONTEXT_SCORE_DISCLAIMER,
} from './contextScoringService.js';

describe('contextScoringService', () => {
  it('calculates information coverage independently from ambient daylight conditions', () => {
    const amenities = [
      { category: 'transit' },
      { category: 'transit' },
      { category: 'emergency' },
      { category: 'services' },
      { category: 'services' },
      { category: 'lighting' },
      { category: 'lighting' },
      { category: 'lighting' },
      { category: 'lighting' },
      { category: 'lighting' },
    ];

    // Day query
    const dayResult = calculateContextCoverage({
      distanceMeters: 500,
      amenities,
      solar: { state: 'DAYLIGHT', elevationDeg: 35.5 },
      imagery: { available: true, coverageRatio: 1.0, capturedAt: '2025-11-14T10:00:00Z' },
    });

    // Night query for identical corridor
    const nightResult = calculateContextCoverage({
      distanceMeters: 500,
      amenities,
      solar: { state: 'NIGHT', elevationDeg: -25.0 },
      imagery: { available: true, coverageRatio: 1.0, capturedAt: '2025-11-14T10:00:00Z' },
    });

    // Pure information coverage must be identical regardless of time of day
    assert.equal(dayResult.scoreName, CONTEXT_SCORE_NAME);
    assert.equal(dayResult.disclaimer, CONTEXT_SCORE_DISCLAIMER);
    assert.equal(dayResult.amenitiesCount, 10);
    assert.equal(dayResult.amenityDensityPer100m, 2.0);
    assert.equal(dayResult.amenityScore, 25); // 2.0 * 12.5 = 25
    assert.equal(dayResult.imageryScore, 50); // 1.0 * 50 = 50
    assert.equal(dayResult.totalScore, 75); // 25 + 50 = 75
    assert.equal(dayResult.totalScore, nightResult.totalScore); // Mathematical independence
    assert.equal(dayResult.ratingLabel, 'Comprehensive');
    assert.equal(nightResult.ratingLabel, 'Comprehensive');

    // Environmental walking conditions are reported separately
    assert.equal(dayResult.walkingConditions.solarState, 'DAYLIGHT');
    assert.equal(dayResult.walkingConditions.daylightScore, 30);
    assert.equal(nightResult.walkingConditions.solarState, 'NIGHT');
    assert.equal(nightResult.walkingConditions.daylightScore, 3);
  });

  it('honestly distinguishes unavailable data from an empty corridor', () => {
    // 1. Explicitly unavailable amenity data (network error/timeout)
    const unavailableRes = calculateContextCoverage({
      distanceMeters: 500,
      amenities: null,
      amenityStatus: 'UNAVAILABLE',
      imagery: { available: true, coverageRatio: 0.8 },
    });

    assert.equal(unavailableRes.amenityStatus, 'UNAVAILABLE');
    assert.equal(unavailableRes.amenityScore, null);
    assert.equal(unavailableRes.ratingLabel, 'Incomplete Data');
    assert.ok(unavailableRes.missingDataNotices.some((n) => /could not be retrieved/i.test(n)));

    // 2. Available empty corridor (0 mapped amenities in OSM)
    const emptyCorridorRes = calculateContextCoverage({
      distanceMeters: 500,
      amenities: [],
      amenityStatus: 'AVAILABLE',
      imagery: { available: false },
    });

    assert.equal(emptyCorridorRes.amenityStatus, 'AVAILABLE');
    assert.equal(emptyCorridorRes.amenityScore, 0);
    assert.equal(emptyCorridorRes.imageryScore, 0);
    assert.equal(emptyCorridorRes.totalScore, 0);
    assert.equal(emptyCorridorRes.ratingLabel, 'Sparse');
    assert.ok(emptyCorridorRes.missingDataNotices.some((n) => /No mapped amenities recorded/i.test(n)));
  });

  it('evaluates proportional street imagery corridor coverage ratio', () => {
    const res = calculateContextCoverage({
      distanceMeters: 1000,
      amenities: [{ category: 'transit' }],
      imagery: {
        available: true,
        coverageRatio: 0.6, // 3 of 5 checkpoints have imagery
        sampledCheckpoints: 5,
        availableCheckpoints: 3,
        samplingMode: 'corridor_checkpoints',
      },
    });

    assert.equal(res.imageryCoverageRatio, 0.6);
    assert.equal(res.imageryScore, 30); // 0.6 * 50 = 30
    assert.equal(res.imagerySamplingMode, 'corridor_checkpoints');
  });

  it('flags origin-only imagery sampling honestly', () => {
    const res = calculateContextCoverage({
      distanceMeters: 800,
      amenities: [],
      imagery: {
        available: true,
        samplingMode: 'origin_only',
      },
    });

    assert.equal(res.imagerySamplingMode, 'origin_only');
    assert.ok(res.missingDataNotices.some((n) => /near starting point only/i.test(n)));
  });

  it('handles empty or null input without throwing', () => {
    const res = calculateContextCoverage(null);
    assert.ok(res);
    assert.equal(res.totalScore, 0);
    assert.equal(res.ratingLabel, 'Sparse');
    assert.equal(res.amenitiesCount, 0);
    assert.equal(res.scoreName, 'Route Information Coverage');
  });

  it('strictly excludes the word safety from scoreName and warns in disclaimer', () => {
    const res = calculateContextCoverage({});
    assert.ok(!res.scoreName.toLowerCase().includes('safety'));
    assert.match(res.disclaimer, /Does NOT measure, infer, or guarantee personal safety/i);
  });
});
