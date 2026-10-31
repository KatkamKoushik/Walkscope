import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAlongRouteDistanceMeters,
  evaluateRouteVenues,
  calculateMajorRoadShare,
  evaluateVerifiedSupportPoints,
  computeRouteIntelligence,
  SPEED_PRESETS,
} from './routeIntelligenceService.js';

test('routeIntelligenceService - along-route distance calculation', async (t) => {
  // Straight east-west line 1km long: [0, 0] to [0.009, 0]
  const polyline = [
    [0.0, 0.0],
    [0.0045, 0.0],
    [0.009, 0.0],
  ];

  await t.test('computes along-route distance for start point', () => {
    const dist = computeAlongRouteDistanceMeters([0.0, 0.0], polyline);
    assert.equal(dist, 0);
  });

  await t.test('computes along-route distance for intermediate point', () => {
    const dist = computeAlongRouteDistanceMeters([0.0045, 0.0], polyline);
    assert.ok(dist > 400 && dist < 600, `Expected ~500m, got ${dist}`);
  });
});

test('routeIntelligenceService - venue opening hours & gap evaluation', async (t) => {
  const polyline = [
    [77.6066, 12.9756], // MG Road Metro
    [77.6070, 12.9719], // Brigade Road
  ];
  const totalMeters = 500;

  const amenities = [
    {
      id: 'shop_1',
      name: '24/7 Supermarket',
      category: 'services',
      coordinates: [77.6067, 12.9745],
      tags: { shop: 'convenience', opening_hours: '24/7' },
    },
    {
      id: 'shop_2',
      name: 'Day Cafe',
      category: 'services',
      coordinates: [77.6069, 12.9730],
      tags: { shop: 'cafe', opening_hours: 'Mo-Fr 08:00-16:00' },
    },
    {
      id: 'shop_3',
      name: 'Unknown Kiosk',
      category: 'services',
      coordinates: [77.6070, 12.9722],
      tags: { shop: 'kiosk' }, // No opening_hours tag
    },
  ];

  await t.test('evaluates venues at night arrival time', () => {
    // Departure at 9:00 PM (21:00)
    const departureTime = '2026-10-30T21:00:00Z';
    const result = evaluateRouteVenues(amenities, polyline, totalMeters, {
      walkingSpeedMs: SPEED_PRESETS.standard,
      departureTime,
    });

    assert.equal(result.totalVenuesCount, 3);
    assert.equal(result.openCount, 1);     // 24/7 is OPEN
    assert.equal(result.closedCount, 1);   // Day Cafe is CLOSED at 21:00
    assert.equal(result.unknownCount, 1);  // Kiosk is UNKNOWN (never assumed open)
    assert.ok(result.longestGapMeters > 0);
    assert.ok(result.averageGapMeters > 0);
  });
});

test('routeIntelligenceService - major-road share calculation', async (t) => {
  const steps = [
    { distanceMeters: 300, roadName: 'MG Road' },
    { distanceMeters: 100, roadName: 'Church Street' },
    { distanceMeters: 100, roadName: 'Pedestrian Footway' },
  ];
  const totalMeters = 500;

  await t.test('weights road mix by segment distance', () => {
    const res = calculateMajorRoadShare(steps, totalMeters);
    assert.equal(res.majorRoadPercent, 60);    // 300m of 500m
    assert.equal(res.localRoadPercent, 20);    // 100m of 500m
    assert.equal(res.footwayPercent, 20);      // 100m of 500m
    assert.ok(res.disclaimer.includes('descriptive'));
  });
});

test('routeIntelligenceService - verified support points evaluation', async (t) => {
  // Polyline passing MG Road Metro in Bengaluru
  const polyline = [
    [77.6066, 12.9756],
    [77.6070, 12.9719],
  ];

  await t.test('identifies active benchmark support point near MG Road', () => {
    const res = evaluateVerifiedSupportPoints(polyline);
    assert.ok(res.supportPoints.length >= 1);
    const mgPoint = res.supportPoints.find((p) => p.id === 'bengaluru_erss_helpdesk_mgroad');
    assert.ok(mgPoint, 'Expected to find Bengaluru ERSS Help Desk');
    assert.equal(mgPoint.publicAccessConfirmed, true);
    assert.equal(mgPoint.isExpired, false);
  });
});

test('routeIntelligenceService - full reproducibility report', async () => {
  const polyline = [
    [77.6066, 12.9756],
    [77.6070, 12.9719],
  ];

  const report = computeRouteIntelligence({
    polyline,
    distanceMeters: 560,
    durationSeconds: 480,
    steps: [{ distanceMeters: 560, roadName: 'MG Road' }],
    amenities: [],
  });

  assert.ok(report.reproducibility.scorer_version);
  assert.ok(report.reproducibility.graph_version);
  assert.ok(report.reproducibility.departure_timestamp);
  assert.equal(report.roadShare.majorRoadPercent, 100);
});
