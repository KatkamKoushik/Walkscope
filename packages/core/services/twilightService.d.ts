export type SolarState =
  | 'DAYLIGHT'
  | 'CIVIL_TWILIGHT'
  | 'NAUTICAL_TWILIGHT'
  | 'ASTRONOMICAL_TWILIGHT'
  | 'NIGHT';

export interface SolarEstimate {
  solarState: SolarState;
  solarElevationDeg: number;
  solarZenithDeg: number;
  label: string;
  disclaimer: string;
  calculatedAt: string;
}

export declare const SOLAR_DISCLAIMER: string;

export declare function calculateSolarZenith(
  lat: number,
  lon: number,
  date: Date
): { zenithDeg: number; elevationDeg: number };

export declare function estimateDaylightState(
  lat: number,
  lon: number,
  date?: Date
): SolarEstimate;

