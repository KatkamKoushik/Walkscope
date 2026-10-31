export interface LatLon {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type RouteProfile = 'foot' | 'bike' | 'car';

export interface RouteManeuver {
  type: string;
  modifier?: string;
  instruction: string;
  location: [number, number]; // [lon, lat]
  roadName?: string;
}

export interface RouteStep {
  name?: string;
  ref?: string;
  highway?: string | null;
  mode?: string | null;
  distanceMeters: number;
  durationSeconds: number;
  instruction: string;
  roadName?: string;
  location?: [number, number]; // [lon, lat]
  maneuver: RouteManeuver;
}

export interface RouteOption {
  id: string;
  profile: RouteProfile;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lon, lat]
  };
  distanceMeters: number;
  durationSeconds: number;
  distanceFormatted?: string;
  durationFormatted?: string;
  turnsCount: number;
  steps: RouteStep[];
  provider: string;
  retrievedAt: string;
  cached?: boolean;
}

