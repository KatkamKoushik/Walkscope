export declare const SCORER_VERSION: string;
export declare const GRAPH_VERSION: string;

export declare const SPEED_PRESETS: {
  relaxed: number;
  standard: number;
  brisk: number;
};

export interface EvaluatedVenue {
  id: string;
  name: string;
  category: string;
  coordinates: [number, number];
  alongRouteDistanceMeters: number;
  estimatedPassingTime: string;
  openingStatus: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  openingReason: string;
  rawOpeningHours: string | null;
}

export interface VenueIntelligenceResult {
  totalVenuesCount: number;
  openCount: number;
  closedCount: number;
  unknownCount: number;
  longestGapMeters: number;
  averageGapMeters: number;
  walkingSpeedMs: number;
  departureTime: string;
  venues: EvaluatedVenue[];
}

export interface RoadShareResult {
  majorRoadPercent: number;
  localRoadPercent: number;
  footwayPercent: number;
  otherPercent: number;
  majorDistanceMeters: number;
  localDistanceMeters: number;
  footwayDistanceMeters: number;
  disclaimer: string;
}

export interface VerifiedSupportPoint {
  id: string;
  name: string;
  type: string;
  coordinates: [number, number];
  publicAccessConfirmed: boolean;
  operatingHours: string;
  verificationSource: string;
  evidenceUrl: string;
  verifiedAt: string;
  expiresAt: string;
  distanceFromRouteMeters?: number;
  isExpired?: boolean;
  verificationStatus?: string;
}

export interface SupportIntelligenceResult {
  verifiedPointsCount: number;
  expiredPointsCount: number;
  supportPoints: VerifiedSupportPoint[];
  disclaimer: string;
}

export interface RouteIntelligenceReport {
  reproducibility: {
    scorer_version: string;
    opening_hours_parser_version: string;
    graph_version: string;
    walking_speed_ms: number;
    departure_timestamp: string;
    computed_at: string;
  };
  venueIntelligence: VenueIntelligenceResult;
  roadShare: RoadShareResult;
  supportIntelligence: SupportIntelligenceResult;
}

export declare function computeAlongRouteDistanceMeters(
  point: [number, number],
  polyline: Array<[number, number]>
): number;

export declare function evaluateRouteVenues(
  amenities: Array<any>,
  polyline: Array<[number, number]>,
  totalDistanceMeters: number,
  options?: {
    walkingSpeedMs?: number;
    departureTime?: Date | string;
  }
): VenueIntelligenceResult;

export declare function calculateMajorRoadShare(
  steps: Array<any>,
  totalDistanceMeters: number
): RoadShareResult;

export declare function evaluateVerifiedSupportPoints(
  polyline: Array<[number, number]>,
  customRegistry?: Array<any>,
  bufferMeters?: number
): SupportIntelligenceResult;

export declare function computeRouteIntelligence(params: {
  polyline: Array<[number, number]>;
  distanceMeters: number;
  durationSeconds: number;
  steps?: Array<any>;
  amenities?: Array<any>;
  options?: {
    walkingSpeedMs?: number;
    departureTime?: string;
  };
}): RouteIntelligenceReport;
