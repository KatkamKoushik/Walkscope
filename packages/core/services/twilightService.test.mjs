import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSolarZenith,
  estimateDaylightState,
  SOLAR_DISCLAIMER,
} from './twilightService.js';

test('twilightService: rejects invalid inputs safely without throwing or propagating NaN', () => {
  const safe1 = calculateSolarZenith(NaN, 77.6066, new Date());
  assert.equal(safe1.zenithDeg, 90.0);
  assert.equal(safe1.elevationDeg, 0.0);

  const safe2 = calculateSolarZenith(12.9756, 77.6066, new Date('invalid date'));
  assert.equal(safe2.zenithDeg, 90.0);
  assert.equal(safe2.elevationDeg, 0.0);
});

test('twilightService: solar noon in London on summer solstice produces high daylight elevation', () => {
  // 2026-06-21 12:00 UTC, London (51.5080, -0.1281)
  const summerNoon = new Date('2026-06-21T12:00:00Z');
  const res = calculateSolarZenith(51.508, -0.1281, summerNoon);

  assert.ok(res.elevationDeg > 55, `Expected elevation > 55 deg, got ${res.elevationDeg}`);
  assert.ok(res.zenithDeg < 35, `Expected zenith < 35 deg, got ${res.zenithDeg}`);

  const estimate = estimateDaylightState(51.508, -0.1281, summerNoon);
  assert.equal(estimate.solarState, 'DAYLIGHT');
  assert.equal(estimate.disclaimer, SOLAR_DISCLAIMER);
});

test('twilightService: midnight in London on winter solstice produces astronomical night', () => {
  // 2026-12-21 00:00 UTC, London (51.5080, -0.1281)
  const winterMidnight = new Date('2026-12-21T00:00:00Z');
  const res = calculateSolarZenith(51.508, -0.1281, winterMidnight);

  assert.ok(res.elevationDeg < -50, `Expected elevation < -50 deg, got ${res.elevationDeg}`);
  assert.ok(res.zenithDeg > 140, `Expected zenith > 140 deg, got ${res.zenithDeg}`);

  const estimate = estimateDaylightState(51.508, -0.1281, winterMidnight);
  assert.equal(estimate.solarState, 'NIGHT');
});

test('twilightService: civil twilight boundary in Bengaluru (elevation between 0 and -6 deg)', () => {
  // Bengaluru sunset on equinox is ~18:25 local time (12:55 UTC)
  // At ~13:10 UTC the sun is around -3.5 deg (civil twilight)
  const duskBengaluru = new Date('2026-03-20T13:10:00Z');
  const res = calculateSolarZenith(12.9756, 77.6066, duskBengaluru);

  assert.ok(res.elevationDeg < 0 && res.elevationDeg >= -6, `Expected civil twilight (-6 <= elev < 0), got ${res.elevationDeg}`);

  const estimate = estimateDaylightState(12.9756, 77.6066, duskBengaluru);
  assert.equal(estimate.solarState, 'CIVIL_TWILIGHT');
  assert.match(estimate.label, /Civil Twilight/);
});

test('twilightService: nautical twilight boundary (-6 to -12 deg)', () => {
  // 25 minutes after civil twilight, ~13:35 UTC in Bengaluru
  const lateDusk = new Date('2026-03-20T13:35:00Z');
  const estimate = estimateDaylightState(12.9756, 77.6066, lateDusk);

  assert.ok(estimate.solarElevationDeg < -6 && estimate.solarElevationDeg >= -12, `Expected nautical twilight, got ${estimate.solarElevationDeg}`);
  assert.equal(estimate.solarState, 'NAUTICAL_TWILIGHT');
});

test('twilightService: disclaimer explicitly denies measuring physical streetlights', () => {
  const estimate = estimateDaylightState(12.9756, 77.6066, new Date());
  assert.ok(estimate.disclaimer.includes('Does not measure streetlights'));
  assert.ok(!estimate.disclaimer.includes('safety'));
});

