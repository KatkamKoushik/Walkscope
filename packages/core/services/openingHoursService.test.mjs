import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateOpeningHours,
  parseTimeToMinutes,
  parseDayRange,
} from './openingHoursService.js';

test('openingHoursService - time and day parsing', async (t) => {
  await t.test('parses HH:MM correctly', () => {
    assert.equal(parseTimeToMinutes('00:00'), 0);
    assert.equal(parseTimeToMinutes('08:30'), 510);
    assert.equal(parseTimeToMinutes('23:59'), 1439);
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

test('openingHoursService - evaluation scenarios', async (t) => {
  await t.test('evaluates 24/7 as always OPEN', () => {
    const res = evaluateOpeningHours('24/7', new Date('2026-10-31T03:00:00Z'));
    assert.equal(res.status, 'OPEN');
    assert.equal(res.ruleMatched, '24/7');
  });

  await t.test('evaluates missing/empty tag as UNKNOWN (never assumes open)', () => {
    const resNull = evaluateOpeningHours(null);
    assert.equal(resNull.status, 'UNKNOWN');

    const resEmpty = evaluateOpeningHours('');
    assert.equal(resEmpty.status, 'UNKNOWN');

    const resUndefined = evaluateOpeningHours(undefined);
    assert.equal(resUndefined.status, 'UNKNOWN');
  });

  await t.test('evaluates weekday daytime venue accurately', () => {
    // Wednesday 2026-10-28 at 14:00 (day = 3)
    const openTime = new Date('2026-10-28T14:00:00');
    const closedTime = new Date('2026-10-28T22:30:00');

    const rule = 'Mo-Fr 09:00-18:00';
    assert.equal(evaluateOpeningHours(rule, openTime).status, 'OPEN');
    assert.equal(evaluateOpeningHours(rule, closedTime).status, 'CLOSED');
  });

  await t.test('evaluates multi-interval days (e.g. lunch break)', () => {
    // Tuesday 2026-10-27
    const morning = new Date('2026-10-27T10:30:00');
    const lunchBreak = new Date('2026-10-27T13:30:00');
    const afternoon = new Date('2026-10-27T15:30:00');

    const rule = 'Mo-Fr 08:30-13:00, 14:30-19:00';
    assert.equal(evaluateOpeningHours(rule, morning).status, 'OPEN');
    assert.equal(evaluateOpeningHours(rule, lunchBreak).status, 'CLOSED');
    assert.equal(evaluateOpeningHours(rule, afternoon).status, 'OPEN');
  });

  await t.test('handles overnight spans across midnight', () => {
    // Friday night at 23:30 (Day 5 = Friday, Oct 30)
    const friNight = new Date('2026-10-30T23:30:00');
    // Saturday early morning at 01:30 (Day 6 = Saturday, Oct 31)
    const satEarlyMorning = new Date('2026-10-31T01:30:00');
    // Saturday morning at 05:00 (closed)
    const satMorningClosed = new Date('2026-10-31T05:00:00');

    const rule = 'Fr-Sa 21:00-03:00';
    assert.equal(evaluateOpeningHours(rule, friNight).status, 'OPEN');
    assert.equal(evaluateOpeningHours(rule, satEarlyMorning).status, 'OPEN');
    assert.equal(evaluateOpeningHours(rule, satMorningClosed).status, 'CLOSED');
  });

  await t.test('handles explicit "off" rules', () => {
    // Sunday Oct 25
    const sunday = new Date('2026-10-25T12:00:00');
    const rule = 'Mo-Sa 09:00-18:00; Su off';
    const res = evaluateOpeningHours(rule, sunday);
    assert.equal(res.status, 'CLOSED');
  });

  await t.test('returns UNKNOWN on unparseable complex rules', () => {
    const res = evaluateOpeningHours('sunrise-sunset; irregular holidays vary');
    assert.equal(res.status, 'UNKNOWN');
  });
});
