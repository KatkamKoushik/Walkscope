export declare const NAVIGATION_ENGINE_VERSION: string;

export interface NavDefaults {
  maxAccuracyMeters: number;
  maxSpeedMps: number;
  waypointAdvanceRadiusMeters: number;
  offRouteThresholdMeters: number;
  offRouteHysteresisCount: number;
  gpsTimeoutMs: number;
  defaultWalkingSpeedMps: number;
}

export declare const NAV_DEFAULTS: NavDefaults;

export interface NavigationState {
  currentStepIndex: number;
  lastValidFix: { latitude: number; longitude: number; timestamp: number } | null;
  consecutiveOffRouteCount: number;
  isOffRoute: boolean;
  offRouteMeters: number | null;
  gpsStatus: 'searching' | 'active' | 'lost' | 'unavailable';
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  distanceToNextManeuverMeters: number;
}

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export declare function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number;

export declare function minDistanceToCorridor(lat: number, lon: number, polyline: Array<[number, number]>): number;

export declare function createNavigationState(route?: any): NavigationState;

export declare function processGpsFix(
  state: NavigationState,
  fix: GpsFix,
  route: any,
  options?: Partial<NavDefaults>
): {
  state: NavigationState;
  action: 'ACCEPTED' | 'DROPPED_INACCURATE' | 'DROPPED_TELEPORT';
};

export declare function checkGpsTimeout(
  state: NavigationState,
  now: number,
  timeoutMs?: number
): NavigationState;
