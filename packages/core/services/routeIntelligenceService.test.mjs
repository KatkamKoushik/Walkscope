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
    { distanceMeters: 300, highway: 'primary', roadName: 'MG Road' },
    { distanceMeters: 100, highway: 'residential', roadName: 'Church Street' },
    { distanceMeters: 100, highway: 'footway', roadName: 'Pedestrian Walkway' },
  ];
  const totalMeters = 500;

  await t.test('weights road mix by segment distance and OSM highway tags', () => {
    const res = calculateMajorRoadShare(steps, totalMeters);
    assert.equal(res.majorRoadPercent, 60);    // 300m of 500m
    assert.equal(res.localRoadPercent, 20);    // 100m of 500m
    assert.equal(res.footwayPercent, 20);      // 100m of 500m
    assert.ok(res.disclaimer.includes('OpenStreetMap'));
  });

  await t.test('reports unclassified steps under other without string guessing', () => {
    const unclassifiedSteps = [
      { distanceMeters: 200, roadName: 'Unknown Lane' }, // No highway tag, no major ref
    ];
    const res = calculateMajorRoadShare(unclassifiedSteps, 200);
    assert.equal(res.otherPercent, 100);
    assert.equal(res.majorRoadPercent, 0);
    assert.equal(res.isAvailable, false);
    assert.equal(res.status, 'UNAVAILABLE');
    assert.equal(res.majorDistanceMeters + res.localDistanceMeters + res.footwayDistanceMeters + res.otherDistanceMeters, 200);
  });

  await t.test('proves segment lengths sum consistently to route distance', () => {
    const steps = [
      { distanceMeters: 142.5, highway: 'primary' },
      { distanceMeters: 250.2, highway: 'residential' },
      { distanceMeters: 107.3, highway: 'footway' },
    ];
    const res = calculateMajorRoadShare(steps, 500);
    assert.equal(res.isAvailable, true);
    assert.equal(res.status, 'AVAILABLE');
    assert.equal(res.majorDistanceMeters + res.localDistanceMeters + res.footwayDistanceMeters + res.otherDistanceMeters, 500);
  });
});

test('routeIntelligenceService - verified support points evaluation', async (t) => {
  const polyline = [
    [77.6066, 12.9756],
    [77.6070, 12.9719],
  ];

  await t.test('honestly returns 0 verified points by default when no audited registry is configured', () => {
    const res = evaluateVerifiedSupportPoints(polyline);
    assert.equal(res.verifiedPointsCount, 0);
    assert.equal(res.supportPoints.length, 0);
  });

  await t.test('requires location-specific evidence and unexpired access to count as verified', () => {
    const sampleRegistry = [
      {
        id: 'audited_helpdesk_mgroad',
        name: 'Audited Public Help Desk (MG Road Metro)',
        type: 'help_centre',
        coordinates: [77.6068, 12.9754],
        publicAccessConfirmed: true,
        operatingHours: '24/7',
        verificationSource: 'Location Field Audit Report #2026-A12',
        evidenceUrl: 'https://example.gov/audits/2026-A12',
        verifiedAt: '2026-10-15T00:00:00Z',
        expiresAt: '2026-11-15T00:00:00Z',
      },
      {
        id: 'unconfirmed_kiosk',
        name: 'Unverified Information Kiosk',
        type: 'kiosk',
        coordinates: [77.6068, 12.9754],
        publicAccessConfirmed: false,
        operatingHours: 'unknown',
        verificationSource: '',
        evidenceUrl: '',
        verifiedAt: '2026-10-15T00:00:00Z',
        expiresAt: '2026-11-15T00:00:00Z',
      },
    ];

    const res = evaluateVerifiedSupportPoints(polyline, sampleRegistry);
    assert.equal(res.verifiedPointsCount, 1);
    assert.equal(res.supportPoints.length, 2);
    const audited = res.supportPoints.find((p) => p.id === 'audited_helpdesk_mgroad');
    assert.equal(audited.verificationStatus, 'verified_active');
    const unconfirmed = res.supportPoints.find((p) => p.id === 'unconfirmed_kiosk');
    assert.equal(unconfirmed.verificationStatus, 'unverified_candidate');
  });

  await t.test('rejects generic organisation homepage as location-specific evidence', () => {
    const genericRegistry = [
      {
        id: 'generic_homepage_point',
        name: 'Helpdesk With Generic URL',
        type: 'help_centre',
        coordinates: [77.6068, 12.9754],
        publicAccessConfirmed: true,
        evidenceUrl: 'https://112.gov.in', // Generic top-level homepage without subpath
        verifiedAt: '2026-10-15T00:00:00Z',
        expiresAt: '2026-12-31T00:00:00Z',
      },
    ];

    const res = evaluateVerifiedSupportPoints(polyline, genericRegistry);
    assert.equal(res.verifiedPointsCount, 0);
    assert.equal(res.supportPoints[0].verificationStatus, 'unverified_candidate');
  });

  await t.test('drops invalid coordinates from support registry', () => {
    const malformedRegistry = [
      {
        id: 'bad_coords',
        name: 'Bad Coords Point',
        type: 'help_centre',
        coordinates: [NaN, 12.9754],
        publicAccessConfirmed: true,
        evidenceUrl: 'https://example.gov/doc/1',
        expiresAt: '2026-12-31T00:00:00Z',
      },
    ];

    const res = evaluateVerifiedSupportPoints(polyline, malformedRegistry);
    assert.equal(res.supportPoints.length, 0);
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
    steps: [{ distanceMeters: 560, highway: 'primary', roadName: 'MG Road' }],
    amenities: [],
  });

  assert.ok(report.reproducibility.scorer_version);
  assert.ok(report.reproducibility.graph_version);
  assert.ok(report.reproducibility.departure_timestamp);
  assert.equal(report.roadShare.majorRoadPercent, 100);
});
