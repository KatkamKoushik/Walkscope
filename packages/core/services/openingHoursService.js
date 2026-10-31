/**
 * Opening Hours Intelligence Service
 * 
 * Evaluates OpenStreetMap opening_hours tags against pedestrian arrival timestamps.
 * 
 * STRICT HONESTY & NIGHTWISE RULES:
 * - Unknown, unparseable, or missing opening_hours tags must NEVER be assumed open.
 * - Missing or invalid hours evaluate to 'UNKNOWN'.
 * - Overnight intervals (e.g., 20:00-02:00) correctly roll over to next day.
 * - Local time considerations are preserved.
 */

export const OPENING_HOURS_PARSER_VERSION = '1.0.0';

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
 * Evaluates an OSM opening_hours string at a target timestamp.
 * 
 * @param {string | undefined | null} rawOpeningHours - Raw OSM tag value
 * @param {Date | string | number} [targetDate=new Date()] - Projected pedestrian passing time
 * @returns {{
 *   status: 'OPEN' | 'CLOSED' | 'UNKNOWN';
 *   ruleMatched?: string;
 *   reason?: string;
 *   rawTag: string | null;
 * }}
 */
export function evaluateOpeningHours(rawOpeningHours, targetDate = new Date()) {
  const dateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const validDate = !isNaN(dateObj.getTime()) ? dateObj : new Date();

  const raw = typeof rawOpeningHours === 'string' ? rawOpeningHours.trim() : null;

  // 1. Missing or empty tag
  if (!raw) {
    return {
      status: 'UNKNOWN',
      reason: 'No opening_hours tag recorded in OpenStreetMap',
      rawTag: null,
    };
  }

  // 2. Standard 24/7 rule
  if (raw === '24/7' || raw === '24/7; open') {
    return {
      status: 'OPEN',
      ruleMatched: '24/7',
      rawTag: raw,
    };
  }

  const currentDay = validDate.getDay(); // 0 = Su .. 6 = Sa
  const currentMinutes = validDate.getHours() * 60 + validDate.getMinutes();

  // Also check yesterday for overnight spans that roll past midnight
  const yesterdayDay = (currentDay + 6) % 7;

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

      // Parse intervals e.g. "08:00-13:00, 14:00-18:00"
      const intervals = timePart.split(',').map((iv) => iv.trim());

      // Case A: Check if rule applies to today
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
              // Open if current time >= startMin
              if (currentMinutes >= startMin) {
                isOpen = true;
                matchedRuleDesc = `${DAY_NAMES[currentDay]} ${interval} (overnight)`;
                break;
              }
            }
          }
        }
      }

      // Case B: Check if yesterday had an overnight rule rolling into today
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
    };
  }

  if (isExplicitlyClosed) {
    return {
      status: 'CLOSED',
      reason: `Explicitly listed as closed (${matchedRuleDesc})`,
      rawTag: raw,
    };
  }

  if (anyRuleMatchedDay) {
    return {
      status: 'CLOSED',
      reason: 'Outside listed operating hours for today',
      rawTag: raw,
    };
  }

  // If rules were specified for specific days and today is not one of them
  const hasSpecificDays = rules.some((r) => /^(Mo|Tu|We|Th|Fr|Sa|Su)\b/i.test(r));
  if (hasSpecificDays && anyRuleMatchedDay === false) {
    return {
      status: 'CLOSED',
      reason: `No operating hours listed for ${DAY_NAMES[currentDay]}`,
      rawTag: raw,
    };
  }

  // Unparseable / complex syntax: Must never assume open
  return {
    status: 'UNKNOWN',
    reason: 'Complex or unparseable opening_hours rule format',
    rawTag: raw,
  };
}
