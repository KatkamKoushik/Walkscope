export declare const OSRM_PUBLIC_FOOT_ENDPOINT: string;

export interface RoutingCoord {
  latitude: number;
  longitude: number;
}

export interface ClientRouteResult {
  ok: boolean;
  routes: Array<{
    id: string;
    profile?: string;
    distanceMeters: number;
    durationSeconds: number;
    distanceFormatted: string;
    durationFormatted: string;
    geometry: {
      type: 'LineString';
      coordinates: [number, number][]; // [lon, lat]
    };
    turnsCount: number;
    steps: Array<{
      name?: string;
      ref?: string;
      instruction: string;
      roadName: string;
      distanceMeters: number;
      durationSeconds: number;
      location: [number, number];
      type?: string;
      modifier?: string;
      maneuver?: {
        type: string;
        modifier: string;
        instruction: string;
        location: [number, number];
        roadName: string;
      };
    }>;
    provider?: string;
    retrievedAt: string;
  }>;
  status: 'SUCCESS' | 'NO_ROUTE_FOUND' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'INVALID_INPUT';
  message?: string;
}

export declare function generateRouteSignature(
  index: number,
  coordinates?: [number, number][],
  distanceMeters?: number,
  durationSeconds?: number,
  profile?: string
): string;

export declare function calculatePedestrianRoutes(
  origin: RoutingCoord,
  destination: RoutingCoord,
  options?: {
    endpoint?: string;
    timeoutMs?: number;
    fetchFn?: typeof fetch;
  }
): Promise<ClientRouteResult>;
