import { LatLon } from './route';

export type VerificationStatus = 'verified' | 'mapped' | 'user_reported' | 'unknown';

export type AmenityCategory =
  | 'emergency'
  | 'transit'
  | 'lighting'
  | 'convenience'
  | 'restroom'
  | 'shelter'
  | 'pedestrian_crossing'
  | 'point_of_interest'
  | 'unknown';

export interface ContextFeature {
  id: string;
  category: AmenityCategory;
  type: string;
  location: LatLon;
  title: string;
  source: string; // e.g., 'osm-overpass', 'google-places', 'gtfs'
  observedAt?: string;
  fetchedAt: string;
  verificationStatus: VerificationStatus;
  sourceUrl?: string;
  distanceFromRouteM?: number;
}

export interface RouteContextSummary {
  routeId: string;
  totalAmenitiesCount: number;
  categoryBreakdown: Record<AmenityCategory, number>;
  freshnessRatio: number; // 0 to 1 proportion with known recent timestamps
  unverifiedRatio: number; // 0 to 1 proportion with unverified/unknown status
  evaluatedBufferDistanceM: number;
}

