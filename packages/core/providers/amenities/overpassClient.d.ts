export type AmenityCategory = 'transit' | 'emergency' | 'services' | 'lighting' | 'other';

export interface AmenityFeature {
  id: string;
  name: string;
  category: AmenityCategory;
  type: string;
  coordinates: [number, number]; // [lon, lat]
  verificationStatus: 'mapped_unverified';
  disclaimer: string;
  source: string;
  fetchedAt: string;
  distanceFromRouteM?: number;
  tags?: Record<string, string>;
}

export interface CorridorBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export declare const OVERPASS_DEFAULT_ENDPOINT: string;
export declare const OVERPASS_DISCLAIMER: string;

export declare function calculateCorridorBounds(
  coordinates: Array<[number, number]>,
  bufferDegrees?: number
): CorridorBounds;

export declare function distancePointToSegmentM(
  pLon: number,
  pLat: number,
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number
): number;

export declare function minDistancePointToPolylineM(
  point: [number, number],
  polyline: Array<[number, number]>
): number;

export declare function buildOverpassQuery(
  bounds: CorridorBounds,
  timeoutSec?: number
): string;

export declare function categorizeOsmTags(
  tags?: Record<string, string>
): AmenityCategory;

export declare function normalizeOsmElement(
  element: any
): AmenityFeature | null;

export declare function fetchCorridorAmenities(
  coordinates: Array<[number, number]>,
  options?: {
    bufferDegrees?: number;
    maxCorridorDistanceMeters?: number;
    timeoutMs?: number;
    endpoint?: string;
    fetchFn?: typeof fetch;
  }
): Promise<{ features: AmenityFeature[]; error?: string }>;
