import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateOpeningHours,
  parseTimeToMinutes,
  parseDayRange,
  resolveTimezoneForCoordinates,
  getLocalDateTimeParts,
} from './openingHoursService.js';

test('openingHoursService - time and day parsing', async (t) => {
  await t.test('parses HH:MM correctly', () => {
    assert.equal(parseTimeToMinutes('00:00'), 0);
    assert.equal(parseTimeToMinutes('08:30'), 510);
    assert.equal(parseTimeToMinutes('23:59'), 1439);
    assert.equal(parseTimeToMinutes('24:00'), 1440);
    assert.equal(parseTimeToMinutes('24:01'), null);
    assert.equal(parseTimeToMinutes('invalid'), null);
  });

  await t.test('parses day ranges correctly', () => {
    // Mo-Fr is [1, 2, 3, 4, 5]
    const moFr = parseDayRange('Mo-Fr');
    assert.deepEqual(moFr, [1, 2, 3, 4, 5]);

    // Sa,Su is [6, 0]
    const weekend = parseDayRange('Sa,Su');
    assert.deepEqual(weekend, [6, 0]);
  });
});

test('openingHoursService - timezone resolution from coordinates', async (t) => {
  await t.test('resolves Bengaluru coordinates to Asia/Kolkata', () => {
    assert.equal(resolveTimezoneForCoordinates(77.6068, 12.9754), 'Asia/Kolkata');
  });

  await t.test('resolves London coordinates to Europe/London', () => {
    assert.equal(resolveTimezoneForCoordinates(-0.1281, 51.5080), 'Europe/London');
  });

  await t.test('resolves unmapped coordinates to UTC safely', () => {
    assert.equal(resolveTimezoneForCoordinates(0, 0), 'UTC');
    assert.equal(resolveTimezoneForCoordinates(NaN, NaN), 'UTC');
  });

  await t.test('extracts local date-time parts in specified timezone', () => {
    // 2026-10-31T18:45:00Z -> London is Saturday 18:45, Kolkata is Sunday 00:15
    const instant = new Date('2026-10-31T18:45:00Z');
    const londonParts = getLocalDateTimeParts(instant, 'Europe/London');
    const kolkataParts = getLocalDateTimeParts(instant, 'Asia/Kolkata');

    assert.equal(londonParts.day, 6); // Saturday
    assert.equal(londonParts.hours, 18);
    assert.equal(londonParts.minutes, 45);

    assert.equal(kolkataParts.day, 0); // Sunday
    assert.equal(kolkataParts.hours, 0);
    assert.equal(kolkataParts.minutes, 15);
  });
});

test('openingHoursService - evaluation scenarios with explicit timezones', async (t) => {
  await t.test('evaluates 24/7 as always OPEN', () => {
    const res = evaluateOpeningHours('24/7', new Date('2026-10-31T03:00:00Z'), 'Asia/Kolkata');
    assert.equal(res.status, 'OPEN');
    assert.equal(res.ruleMatched, '24/7');
  });

  await t.test('evaluates missing/empty tag as UNKNOWN (never assumes open)', () => {
    assert.equal(evaluateOpeningHours(null).status, 'UNKNOWN');
    assert.equal(evaluateOpeningHours('').status, 'UNKNOWN');
    assert.equal(evaluateOpeningHours(undefined).status, 'UNKNOWN');
  });

  await t.test('evaluates weekday daytime venue accurately in UTC', () => {
    // Wednesday 2026-10-28 at 14:00 UTC
    const openTime = new Date('2026-10-28T14:00:00Z');
    const closedTime = new Date('2026-10-28T22:30:00Z');

    const rule = 'Mo-Fr 09:00-18:00';
    assert.equal(evaluateOpeningHours(rule, openTime, 'UTC').status, 'OPEN');
    assert.equal(evaluateOpeningHours(rule, closedTime, 'UTC').status, 'CLOSED');
  });

  await t.test('evaluates multi-interval days (e.g. lunch break)', () => {
    // Tuesday 2026-10-27 in UTC
    const morning = new Date('2026-10-27T10:30:00Z');
    const lunchBreak = new Date('2026-10-27T13:30:00Z');
    const afternoon = new Date('2026-10-27T15:30:00Z');

    const rule = 'Mo-Fr 08:30-13:00, 14:30-19:00';
    assert.equal(evaluateOpeningHours(rule, morning, 'UTC').status, 'OPEN');
    assert.equal(evaluateOpeningHours(rule, lunchBreak, 'UTC').status, 'CLOSED');
    assert.equal(evaluateOpeningHours(rule, afternoon, 'UTC').status, 'OPEN');
  });

  await t.test('handles overnight spans across midnight', () => {
    // Friday night at 23:30 UTC
    const friNight = new Date('2026-10-30T23:30:00Z');
    // Saturday early morning at 01:30 UTC
    const satEarlyMorning = new Date('2026-10-31T01:30:00Z');
    // Saturday morning at 05:00 UTC (closed)
    const satMorningClosed = new Date('2026-10-31T05:00:00Z');

    const rule = 'Fr-Sa 21:00-03:00';
    assert.equal(evaluateOpeningHours(rule, friNight, 'UTC').status, 'OPEN');
    assert.equal(evaluateOpeningHours(rule, satEarlyMorning, 'UTC').status, 'OPEN');
    assert.equal(evaluateOpeningHours(rule, satMorningClosed, 'UTC').status, 'CLOSED');
  });

  await t.test('handles explicit "off" rules', () => {
    // Sunday Oct 25 UTC
    const sunday = new Date('2026-10-25T12:00:00Z');
    const rule = 'Mo-Sa 09:00-18:00; Su off';
    const res = evaluateOpeningHours(rule, sunday, 'UTC');
    assert.equal(res.status, 'CLOSED');
  });

  await t.test('proves true multi-timezone variance at the same absolute UTC instant', () => {
    // At UTC instant 2026-10-31T18:45:00Z:
    // London local time: Saturday 18:45
    // Bengaluru local time: Sunday 00:15 (next day!)
    const instant = new Date('2026-10-31T18:45:00Z');
    const rule = 'Mo-Sa 09:00-22:00; Su off';

    const londonEval = evaluateOpeningHours(rule, instant, 'Europe/London');
    const bengaluruEval = evaluateOpeningHours(rule, instant, 'Asia/Kolkata');

    assert.equal(londonEval.status, 'OPEN', 'Expected London venue to be OPEN at Saturday 18:45');
    assert.equal(bengaluruEval.status, 'CLOSED', 'Expected Bengaluru venue to be CLOSED at Sunday 00:15 (Su off)');
  });

  await t.test('returns UNKNOWN on unparseable complex rules and unsupported expressions', () => {
    assert.equal(evaluateOpeningHours('sunrise-sunset').status, 'UNKNOWN');
    assert.equal(evaluateOpeningHours('PH off').status, 'UNKNOWN');
    assert.equal(evaluateOpeningHours('Mo-Fr 09:00-18:00; PH off').status, 'UNKNOWN');
    assert.equal(evaluateOpeningHours('2026-12-25 off').status, 'UNKNOWN');
    assert.equal(evaluateOpeningHours('Dec 25 off').status, 'UNKNOWN');
    assert.equal(evaluateOpeningHours('Sa[1] 10:00-14:00').status, 'UNKNOWN');
    assert.equal(evaluateOpeningHours('Mo-Fr 08:00+').status, 'UNKNOWN');
  });

  await t.test('resolves DST boundaries accurately for Europe/London', () => {
    // 2026-03-29: UK transitions GMT (UTC+0) to BST (UTC+1) at 01:00 UTC
    // At 00:59 UTC: GMT -> local time is 00:59
    const preDst = new Date('2026-03-29T00:59:00Z');
    const preParts = getLocalDateTimeParts(preDst, 'Europe/London');
    assert.equal(preParts.hours, 0);
    assert.equal(preParts.minutes, 59);

    // At 01:01 UTC: Clocks advance 1 hour to BST -> local time is 02:01
    const postDst = new Date('2026-03-29T01:01:00Z');
    const postParts = getLocalDateTimeParts(postDst, 'Europe/London');
    assert.equal(postParts.hours, 2);
    assert.equal(postParts.minutes, 1);

    // Rule: Mo-Su 01:00-03:00
    // Pre-DST at 00:59 UTC (local 00:59): CLOSED
    assert.equal(evaluateOpeningHours('Mo-Su 01:00-03:00', preDst, 'Europe/London').status, 'CLOSED');
    // Post-DST at 01:01 UTC (local 02:01): OPEN
    assert.equal(evaluateOpeningHours('Mo-Su 01:00-03:00', postDst, 'Europe/London').status, 'OPEN');
  });

  await t.test('resolves coordinates for all 5 supported pilot regions', () => {
    // Kolkata
    assert.equal(resolveTimezoneForCoordinates(77.5946, 12.9716), 'Asia/Kolkata');
    // London
    assert.equal(resolveTimezoneForCoordinates(-0.1278, 51.5074), 'Europe/London');
    // Paris
    assert.equal(resolveTimezoneForCoordinates(2.3522, 48.8566), 'Europe/Paris');
    // New York
    assert.equal(resolveTimezoneForCoordinates(-74.0060, 40.7128), 'America/New_York');
    // Los Angeles
    assert.equal(resolveTimezoneForCoordinates(-118.2437, 34.0522), 'America/Los_Angeles');
  });
});
