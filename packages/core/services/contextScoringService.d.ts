export declare const CONTEXT_SCORE_NAME: string;
export declare const CONTEXT_SCORE_DISCLAIMER: string;

export interface WalkingConditions {
  solarState: string;
  solarElevationDeg: number;
  conditionLabel: string;
  visibilityNotice: string;
  daylightScore: number;
}

export interface ContextScoringInput {
  distanceMeters?: number;
  amenities?: Array<{ category: string; [key: string]: any }> | null;
  amenityStatus?: 'AVAILABLE' | 'UNAVAILABLE';
  solar?: { state: string; elevationDeg: number };
  imagery?: {
    available?: boolean;
    capturedAt?: string;
    coverageRatio?: number;
    sampledCheckpoints?: number;
    availableCheckpoints?: number;
    samplingMode?: 'corridor_checkpoints' | 'origin_only';
  };
}

export interface ContextScoreBreakdown {
  amenityScore: number | null;
  amenityStatus: 'AVAILABLE' | 'UNAVAILABLE';
  daylightScore: number;
  imageryScore: number;
  totalScore: number;
  informationCoverageScore: number;
  ratingLabel: 'Comprehensive' | 'Moderate' | 'Sparse' | 'Incomplete Data';
  scoreName: string;
  disclaimer: string;
  amenitiesCount: number;
  amenityDensityPer100m: number;
  daylightState: string;
  solarElevationDeg: number;
  hasStreetImagery: boolean;
  imageryCoverageRatio: number;
  imagerySamplingMode: string;
  imageryCaptureDate: string | null;
  walkingConditions: WalkingConditions;
  missingDataNotices: string[];
}

export declare function calculateContextCoverage(
  input?: ContextScoringInput | null
): ContextScoreBreakdown;
