export declare const CONTEXT_SCORE_NAME: string;
export declare const CONTEXT_SCORE_DISCLAIMER: string;

export interface ContextScoringInput {
  distanceMeters?: number;
  amenities?: Array<{ category: string; [key: string]: any }>;
  solar?: { state: string; elevationDeg: number };
  imagery?: { available: boolean; capturedAt?: string };
}

export interface ContextScoreBreakdown {
  amenityScore: number;
  daylightScore: number;
  imageryScore: number;
  totalScore: number;
  ratingLabel: 'Comprehensive' | 'Moderate' | 'Sparse';
  scoreName: string;
  disclaimer: string;
  amenitiesCount: number;
  amenityDensityPer100m: number;
  daylightState: string;
  solarElevationDeg: number;
  hasStreetImagery: boolean;
  imageryCaptureDate: string | null;
  missingDataNotices: string[];
}

export declare function calculateContextCoverage(
  input?: ContextScoringInput
): ContextScoreBreakdown;

