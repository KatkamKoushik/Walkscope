import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateContextCoverage,
  CONTEXT_SCORE_NAME,
  CONTEXT_SCORE_DISCLAIMER,
} from './contextScoringService.js';

describe('contextScoringService', () => {
  it('calculates comprehensive coverage when amenities, daylight, and imagery exist', () => {
    const input = {
      distanceMeters: 500,
      amenities: [
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
      ],
      solar: { state: 'DAYLIGHT', elevationDeg: 35.5 },
      imagery: { available: true, capturedAt: '2025-11-14T10:00:00Z' },
    };

    const res = calculateContextCoverage(input);
    assert.equal(res.scoreName, CONTEXT_SCORE_NAME);
    assert.equal(res.disclaimer, CONTEXT_SCORE_DISCLAIMER);
    assert.equal(res.amenitiesCount, 10);
    assert.equal(res.amenityDensityPer100m, 2.0); // 10 / 500 * 100 = 2.0
    assert.equal(res.amenityScore, 20); // 2.0 * 10 = 20
    assert.equal(res.daylightScore, 30);
    assert.equal(res.imageryScore, 30);
    assert.equal(res.totalScore, 80);
    assert.equal(res.ratingLabel, 'Comprehensive');
    assert.equal(res.hasStreetImagery, true);
    assert.equal(res.missingDataNotices.length, 0);
  });

  it('calculates sparse coverage and surfaces honest missing data notices', () => {
    const input = {
      distanceMeters: 1000,
      amenities: [],
      solar: { state: 'NIGHT', elevationDeg: -25.0 },
      imagery: { available: false },
    };

    const res = calculateContextCoverage(input);
    assert.equal(res.amenityScore, 0);
    assert.equal(res.daylightScore, 3);
    assert.equal(res.imageryScore, 0);
    assert.equal(res.totalScore, 3);
    assert.equal(res.ratingLabel, 'Sparse');
    assert.equal(res.hasStreetImagery, false);
    assert.ok(res.missingDataNotices.length >= 2);
    assert.match(res.missingDataNotices[0], /No mapped amenities/i);
    assert.match(res.missingDataNotices[1], /Night conditions/i);
  });

  it('handles empty or null input without throwing', () => {
    const res = calculateContextCoverage(null);
    assert.ok(res);
    assert.equal(res.totalScore, 3);
    assert.equal(res.ratingLabel, 'Sparse');
    assert.equal(res.amenitiesCount, 0);
    assert.equal(res.scoreName, 'Route Context Coverage');
  });

  it('strictly excludes the word safety from scoreName and warns in disclaimer', () => {
    const res = calculateContextCoverage({});
    assert.ok(!res.scoreName.toLowerCase().includes('safety'));
    assert.match(res.disclaimer, /Does NOT measure, infer, or guarantee personal safety/i);
  });
});

