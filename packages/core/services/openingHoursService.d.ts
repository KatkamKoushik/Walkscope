export declare const OPENING_HOURS_PARSER_VERSION: string;

export interface OpeningHoursEvaluation {
  status: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  ruleMatched?: string;
  reason?: string;
  rawTag: string | null;
  evaluatedTimezone?: string;
  localTimeFormatted?: string;
}

export declare function resolveTimezoneForCoordinates(lon: number, lat: number): string;

export declare function getLocalDateTimeParts(
  date: Date,
  timezone?: string
): { day: number; hours: number; minutes: number };

export declare function parseTimeToMinutes(timeStr: string): number | null;

export declare function parseDayRange(dayStr: string): number[];

export declare function evaluateOpeningHours(
  rawOpeningHours?: string | null,
  targetDate?: Date | string | number,
  timezone?: string
): OpeningHoursEvaluation;
