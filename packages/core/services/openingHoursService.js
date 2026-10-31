/**
 * Opening Hours Intelligence Service
 * 
 * Evaluates OpenStreetMap opening_hours tags against pedestrian arrival timestamps
 * in the venue's explicit local timezone.
 * 
 * STRICT HONESTY & NIGHTWISE RULES:
 * - Unknown, unparseable, or missing opening_hours tags must NEVER be assumed open.
 * - Missing or invalid hours evaluate to 'UNKNOWN'.
 * - Overnight intervals (e.g., 20:00-02:00) correctly roll over to next day.
 * - Venue-specific local timezone is explicitly resolved from coordinates or parameter.
 */

export const OPENING_HOURS_PARSER_VERSION = '1.1.0-timezone-aware';

const DAY_MAP = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Resolves an IANA timezone string from geographic coordinates.
 * Covers benchmark pilot corridors and provides deterministic geographic mapping.
 * 
 * @param {number} lon - Longitude in degrees
 * @param {number} lat - Latitude in degrees
 * @returns {string} IANA Timezone Identifier (e.g. 'Asia/Kolkata', 'Europe/London')
 */
export function resolveTimezoneForCoordinates(lon, lat) {
  if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat)) {
    return 'UTC';
  }

  // India & Subcontinent
  if (lon >= 68.0 && lon <= 97.5 && lat >= 6.5 && lat <= 37.5) {
    return 'Asia/Kolkata';
  }

  // United Kingdom & Ireland
  if (lon >= -10.5 && lon <= 2.0 && lat >= 49.5 && lat <= 61.0) {
    return 'Europe/London';
  }

  // Western & Central Europe
  if (lon >= 2.0 && lon <= 16.0 && lat >= 42.0 && lat <= 55.0) {
    return 'Europe/Paris';
  }

  // US East Coast
  if (lon >= -80.0 && lon <= -70.0 && lat >= 38.0 && lat <= 45.0) {
    return 'America/New_York';
  }

  // US West Coast
  if (lon >= -125.0 && lon <= -114.0 && lat >= 32.0 && lat <= 42.0) {
    return 'America/Los_Angeles';
  }

  // Default to UTC for unmapped coordinates
  return 'UTC';
}

const FORMATTER_CACHE = new Map();

function getFormatter(timeZone) {
  const tz = timeZone || 'UTC';
  let fmt = FORMATTER_CACHE.get(tz);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      FORMATTER_CACHE.set(tz, fmt);
    } catch {
      return null;
    }
  }
  return fmt;
}

/**
 * Extracts the local weekday, hour, and minute in a specified IANA timezone.
 * Uses the standard JavaScript Intl.DateTimeFormat with caching and fast-path UTC.
 * 
 * @param {Date} date - Target timestamp
 * @param {string} [timezone='UTC'] - IANA Timezone string
 * @returns {{ day: number, hours: number, minutes: number }}
 */
export function getLocalDateTimeParts(date, timezone = 'UTC') {
  const validDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();

  // Fast path for UTC
  if (!timezone || timezone === 'UTC') {
    return {
      day: validDate.getUTCDay(),
      hours: validDate.getUTCHours(),
      minutes: validDate.getUTCMinutes(),
    };
  }

  const formatter = getFormatter(timezone);
  if (!formatter) {
    return {
      day: validDate.getUTCDay(),
      hours: validDate.getUTCHours(),
      minutes: validDate.getUTCMinutes(),
    };
  }

  try {
    const parts = formatter.formatToParts(validDate);
    let weekdayStr = '';
    let hour = 0;
    let minute = 0;

    for (const p of parts) {
      if (p.type === 'weekday') weekdayStr = p.value;
      if (p.type === 'hour') hour = parseInt(p.value, 10);
      if (p.type === 'minute') minute = parseInt(p.value, 10);
    }

    if (hour === 24) hour = 0;

    const shortDays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = typeof shortDays[weekdayStr] === 'number' ? shortDays[weekdayStr] : validDate.getUTCDay();

    return { day, hours: hour, minutes: minute };
  } catch {
    return {
      day: validDate.getUTCDay(),
      hours: validDate.getUTCHours(),
      minutes: validDate.getUTCMinutes(),
    };
  }
}

/**
 * Parses a HH:MM string into minutes from midnight (0 - 1439).
 * @param {string} timeStr - e.g. "09:30" or "24:00"
 * @returns {number | null}
 */
export function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  if (hours === 24 && minutes > 0) return null; // 24:00 is allowed as midnight boundary, but 24:01+ is invalid
  return hours * 60 + minutes;
}

/**
 * Expands a day range like "Mo-Fr" or "Sa,Su" into day indices (0=Su..6=Sa).
 * @param {string} dayStr
 * @returns {number[]}
 */
export function parseDayRange(dayStr) {
  const clean = dayStr.trim().toLowerCase();
  const days = [];

  // Split by comma first (e.g. "Mo,We,Fr")
  const parts = clean.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const startIdx = DAY_MAP[startStr?.trim()];
      const endIdx = DAY_MAP[endStr?.trim()];
      if (typeof startIdx === 'number' && typeof endIdx === 'number') {
        let curr = startIdx;
        let count = 0;
        while (count < 7) {
          days.push(curr);
          if (curr === endIdx) break;
          curr = (curr + 1) % 7;
          count++;
        }
      }
    } else if (typeof DAY_MAP[trimmed] === 'number') {
      days.push(DAY_MAP[trimmed]);
    }
  }

  return [...new Set(days)];
}

/**
 * Evaluates an OSM opening_hours string at a target timestamp in the venue's timezone.
 * 
 * @param {string | undefined | null} rawOpeningHours - Raw OSM tag value
 * @param {Date | string | number} [targetDate=new Date()] - Projected pedestrian passing time
 * @param {string} [timezone='UTC'] - Venue's IANA timezone
 * @returns {{
 *   status: 'OPEN' | 'CLOSED' | 'UNKNOWN';
 *   ruleMatched?: string;
 *   reason?: string;
 *   rawTag: string | null;
 *   evaluatedTimezone?: string;
 *   localTimeFormatted?: string;
 * }}
 */
export function evaluateOpeningHours(rawOpeningHours, targetDate = new Date(), timezone = 'UTC') {
  const dateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const validDate = !isNaN(dateObj.getTime()) ? dateObj : new Date();

  const raw = typeof rawOpeningHours === 'string' ? rawOpeningHours.trim() : null;

  // 1. Missing or empty tag: Never assume open
  if (!raw) {
    return {
      status: 'UNKNOWN',
      reason: 'No opening_hours tag recorded in OpenStreetMap',
      rawTag: null,
      evaluatedTimezone: timezone,
    };
  }

  // Guard against ReDoS and payload attacks: cap length to 500 chars
  if (raw.length > 500) {
    return {
      status: 'UNKNOWN',
      reason: 'Opening hours tag exceeds maximum allowable string length (500 chars)',
      rawTag: raw.slice(0, 500),
      evaluatedTimezone: timezone,
    };
  }

  // Reject unsupported complex OSM opening_hours grammar (astronomical, holiday offsets, date-specific, week offsets)
  // Walkscope is an honest partial parser; unsupported expressions strictly return 'UNKNOWN' rather than guessing.
  if (
    /\b(PH|SH|sunrise|sunset|dusk|dawn|Easter)\b/i.test(raw) ||
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(raw) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(raw) ||
    /\[\s*[-+]?\d+\s*\]/.test(raw) ||
    /\+$/.test(raw)
  ) {
    return {
      status: 'UNKNOWN',
      reason: 'Unsupported OSM opening_hours grammar (astronomical, calendar dates, holiday calendars, or variable offsets)',
      rawTag: raw,
      evaluatedTimezone: timezone,
    };
  }

  // 2. Standard 24/7 rule
  if (raw === '24/7' || raw === '24/7; open') {
    return {
      status: 'OPEN',
      ruleMatched: '24/7',
      rawTag: raw,
      evaluatedTimezone: timezone,
    };
  }

  // Extract date components in the venue's specific local timezone
  const localTime = getLocalDateTimeParts(validDate, timezone);
  const currentDay = localTime.day; // 0 = Su .. 6 = Sa
  const currentMinutes = localTime.hours * 60 + localTime.minutes;
  const yesterdayDay = (currentDay + 6) % 7;
  const localTimeFormatted = `${DAY_NAMES[currentDay]} ${String(localTime.hours).padStart(2, '0')}:${String(localTime.minutes).padStart(2, '0')}`;

  let anyRuleMatchedDay = false;
  let isOpen = false;
  let isExplicitlyClosed = false;
  let matchedRuleDesc = '';

  // Rules are separated by ';'
  const rules = raw.split(';').map((r) => r.trim()).filter(Boolean);

  for (const rule of rules) {
    // Check for "off" keyword e.g. "Su off" or "PH off"
    if (rule.toLowerCase().includes('off')) {
      const parts = rule.split(/\s+/);
      if (parts.length >= 2) {
        const days = parseDayRange(parts[0]);
        if (days.includes(currentDay)) {
          anyRuleMatchedDay = true;
          isExplicitlyClosed = true;
          matchedRuleDesc = rule;
        }
      }
      continue;
    }

    // Match rules with days and time intervals:
    // e.g., "Mo-Fr 08:30-20:00" or "09:00-18:00" (all days)
    const match = rule.match(/^([A-Za-z,\-]+)?\s*(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/);

    if (match) {
      const dayPart = match[1]?.trim();
      const timePart = match[2]?.trim();

      const applicableDays = dayPart ? parseDayRange(dayPart) : [0, 1, 2, 3, 4, 5, 6];
      const intervals = timePart.split(',').map((iv) => iv.trim());

      // Case A: Rule applies to today
      if (applicableDays.includes(currentDay)) {
        anyRuleMatchedDay = true;

        for (const interval of intervals) {
          const [startStr, endStr] = interval.split('-').map((s) => s.trim());
          const startMin = parseTimeToMinutes(startStr);
          const endMin = parseTimeToMinutes(endStr);

          if (startMin !== null && endMin !== null) {
            if (endMin > startMin) {
              // Same-day span (e.g. 09:00 - 18:00)
              if (currentMinutes >= startMin && currentMinutes < endMin) {
                isOpen = true;
                matchedRuleDesc = `${DAY_NAMES[currentDay]} ${interval}`;
                break;
              }
            } else {
              // Overnight span on current day (e.g. 20:00 - 02:00)
              if (currentMinutes >= startMin) {
                isOpen = true;
                matchedRuleDesc = `${DAY_NAMES[currentDay]} ${interval} (overnight)`;
                break;
              }
            }
          }
        }
      }

      // Case B: Yesterday had an overnight rule rolling into today
      if (applicableDays.includes(yesterdayDay)) {
        for (const interval of intervals) {
          const [startStr, endStr] = interval.split('-').map((s) => s.trim());
          const startMin = parseTimeToMinutes(startStr);
          const endMin = parseTimeToMinutes(endStr);

          if (startMin !== null && endMin !== null && endMin <= startMin) {
            // Overnight span ending early morning today (00:00 - endMin)
            if (currentMinutes < endMin) {
              isOpen = true;
              matchedRuleDesc = `${DAY_NAMES[yesterdayDay]} ${interval} (rolled past midnight)`;
              break;
            }
          }
        }
      }
    }
  }

  if (isOpen) {
    return {
      status: 'OPEN',
      ruleMatched: matchedRuleDesc,
      rawTag: raw,
      evaluatedTimezone: timezone,
      localTimeFormatted,
    };
  }

  if (isExplicitlyClosed) {
    return {
      status: 'CLOSED',
      reason: `Explicitly listed as closed (${matchedRuleDesc})`,
      rawTag: raw,
      evaluatedTimezone: timezone,
      localTimeFormatted,
    };
  }

  if (anyRuleMatchedDay) {
    return {
      status: 'CLOSED',
      reason: `Outside operating hours for ${localTimeFormatted}`,
      rawTag: raw,
      evaluatedTimezone: timezone,
      localTimeFormatted,
    };
  }

  const hasSpecificDays = rules.some((r) => /^(Mo|Tu|We|Th|Fr|Sa|Su)\b/i.test(r));
  if (hasSpecificDays && anyRuleMatchedDay === false) {
    return {
      status: 'CLOSED',
      reason: `No operating hours listed for ${DAY_NAMES[currentDay]}`,
      rawTag: raw,
      evaluatedTimezone: timezone,
      localTimeFormatted,
    };
  }

  // Complex or unparseable: Must NEVER assume open
  return {
    status: 'UNKNOWN',
    reason: 'Complex or unparseable opening_hours rule format',
    rawTag: raw,
    evaluatedTimezone: timezone,
    localTimeFormatted,
  };
}
