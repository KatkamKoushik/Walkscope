import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeRouteIntelligence,
  calculateContextCoverage,
  calculateMajorRoadShare,
} from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(filename) {
  const filepath = path.join(__dirname, filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(raw);
}

describe('Golden Corridor Analytic Fixtures (WS-008 & WS-077)', () => {
  it('reproduces golden analytics for Bengaluru MG Road corridor deterministically', () => {
    const fixture = loadFixture('bengaluruMgRoadCorridor.json');
    assert.equal(fixture.corridorId, 'bengaluru_mg_road_to_brigade_road');
    assert.equal(fixture.provenance.isSanitizedDemoFixture, true);

    // 1. Road Share Intelligence
    const roadShare = calculateMajorRoadShare(fixture.route.steps, fixture.route.distanceMeters);
    assert.equal(roadShare.majorRoadPercent, fixture.goldenExpected.roadShare.majorRoadPercent);
    assert.equal(roadShare.footwayPercent, fixture.goldenExpected.roadShare.footwayPercent);

    // 2. Information Coverage Score
    const coverage = calculateContextCoverage({
      distanceMeters: fixture.route.distanceMeters,
      amenities: fixture.amenities,
      imagery: fixture.imagery,
    });
    assert.equal(coverage.totalScore, fixture.goldenExpected.informationCoverageScore);
    assert.equal(coverage.imageryCoverageRatio, 0.8);
    assert.equal(coverage.hasStreetImagery, true);

    // 3. Full Route Context Intelligence
    const intel = computeRouteIntelligence({
      polyline: fixture.route.geometry.coordinates,
      distanceMeters: fixture.route.distanceMeters,
      steps: fixture.route.steps,
      amenities: fixture.amenities,
      options: {
        walkingSpeedMs: 1.2,
        departureTime: '2026-10-31T20:00:00Z',
      },
    });

    assert.equal(intel.venueIntelligence.totalVenuesCount, fixture.goldenExpected.totalVenuesCount);
    assert.equal(intel.roadShare.majorRoadPercent, fixture.goldenExpected.roadShare.majorRoadPercent);
    assert.ok(intel.reproducibility.scorer_version);
  });

  it('reproduces golden analytics for London Westminster corridor deterministically', () => {
    const fixture = loadFixture('londonWestminsterCorridor.json');
    assert.equal(fixture.corridorId, 'london_westminster_to_covent_garden');

    // 1. Road Share Intelligence
    const roadShare = calculateMajorRoadShare(fixture.route.steps, fixture.route.distanceMeters);
    assert.equal(roadShare.majorRoadPercent, fixture.goldenExpected.roadShare.majorRoadPercent);
    assert.equal(roadShare.footwayPercent, fixture.goldenExpected.roadShare.footwayPercent);

    // 2. Information Coverage Score
    const coverage = calculateContextCoverage({
      distanceMeters: fixture.route.distanceMeters,
      amenities: fixture.amenities,
      imagery: fixture.imagery,
    });
    assert.equal(coverage.totalScore, fixture.goldenExpected.informationCoverageScore);
    assert.equal(coverage.imageryCoverageRatio, 1.0);

    // 3. Full Route Context Intelligence
    const intel = computeRouteIntelligence({
      polyline: fixture.route.geometry.coordinates,
      distanceMeters: fixture.route.distanceMeters,
      steps: fixture.route.steps,
      amenities: fixture.amenities,
      options: {
        walkingSpeedMs: 1.2,
        departureTime: '2026-10-31T21:00:00Z',
      },
    });

    assert.equal(intel.venueIntelligence.totalVenuesCount, fixture.goldenExpected.totalVenuesCount);
  });
});
