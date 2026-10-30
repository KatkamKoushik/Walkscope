/**
 * @module twilightService
 * @description Deterministic solar daylight/twilight estimator using standard solar zenith formulas.
 * 
 * Satisfies Requirements:
 * 1. "Rename solar results to daylight/twilight estimates. Do not infer actual street-light status,
 *     and do not present mapped-context coverage as a safety score."
 * 2. "Explicitly state that it does not measure streetlights, weather, or actual ground illumination."
 * 3. Pure deterministic mathematical functions, testable offline without network access.
 */

export const SOLAR_DISCLAIMER =
  'Daylight/twilight estimate based on astronomical solar position. Does not measure streetlights, weather, foliage canopy, or actual ground-level illumination.';

/**
 * Calculate solar zenith and elevation angle in degrees for a given geographic location and UTC time.
 * Algorithm based on standard NOAA Solar Position approximations.
 * 
 * @param {number} lat - Latitude in degrees (-90 to 90)
 * @param {number} lon - Longitude in degrees (-180 to 180)
 * @param {Date} date - UTC Date instance
 * @returns {{ zenithDeg: number, elevationDeg: number }}
 */
export function calculateSolarZenith(lat, lon, date) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {
    return { zenithDeg: 90.0, elevationDeg: 0.0 };
  }

  // Convert date to Julian centuries from J2000.0
  const timeMs = date.getTime();
  const julianDay = timeMs / 86400000.0 + 2440587.5;
  const T = (julianDay - 2451545.0) / 36525.0;

  // Geometric mean longitude of the Sun (deg)
  let L0 = 280.46646 + T * (36000.76983 + T * 0.0003032);
  L0 = ((L0 % 360) + 360) % 360;

  // Geometric mean anomaly of the Sun (deg)
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const Mrad = (M * Math.PI) / 180.0;

  // Sun equation of center (deg)
  const C =
    Math.sin(Mrad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mrad) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mrad) * 0.000289;

  // Sun true longitude (deg)
  const sunTrueLon = L0 + C;

  // Mean obliquity of the ecliptic (deg)
  const eps0 = 23.439291 - T * (0.0130042 + 0.00000016 * T);
  const epsRad = (eps0 * Math.PI) / 180.0;
  const sunLonRad = (sunTrueLon * Math.PI) / 180.0;

  // Sun declination (rad)
  const sinDecl = Math.sin(epsRad) * Math.sin(sunLonRad);
  const declRad = Math.asin(sinDecl);

  // Equation of time (minutes)
  const y = Math.tan(eps0 / 2.0 * Math.PI / 180.0) ** 2;
  const L0rad = (L0 * Math.PI) / 180.0;
  const eqTimeMin =
    4 *
    ((y * Math.sin(2 * L0rad) -
      2 * 0.016708634 * Math.sin(Mrad) +
      4 * 0.016708634 * y * Math.sin(Mrad) * Math.cos(2 * L0rad) -
      0.5 * (y ** 2) * Math.sin(4 * L0rad) -
      1.25 * (0.016708634 ** 2) * Math.sin(2 * Mrad)) *
      180.0) /
    Math.PI;

  // True solar time in minutes
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60.0 + date.getUTCSeconds() / 3600.0;
  const trueSolarTimeMin = ((utcHours * 60.0 + eqTimeMin + 4.0 * lon) % 1440 + 1440) % 1440;

  // Hour angle (deg)
  let hourAngleDeg = trueSolarTimeMin / 4.0 - 180.0;
  if (hourAngleDeg < -180.0) hourAngleDeg += 360.0;
  const hourAngleRad = (hourAngleDeg * Math.PI) / 180.0;

  // Solar zenith angle (rad)
  const latRad = (lat * Math.PI) / 180.0;
  const cosZenith = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);
  const clampedCosZenith = Math.max(-1.0, Math.min(1.0, cosZenith));
  const zenithRad = Math.acos(clampedCosZenith);

  const zenithDeg = (zenithRad * 180.0) / Math.PI;
  const elevationDeg = 90.0 - zenithDeg;

  return {
    zenithDeg: Number(zenithDeg.toFixed(2)),
    elevationDeg: Number(elevationDeg.toFixed(2)),
  };
}

/**
 * Classify astronomical solar state into user-friendly daylight & twilight categories.
 * 
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {Date} [date=new Date()] - UTC Date instance
 * @returns {{
 *   solarState: 'DAYLIGHT' | 'CIVIL_TWILIGHT' | 'NAUTICAL_TWILIGHT' | 'ASTRONOMICAL_TWILIGHT' | 'NIGHT',
 *   solarElevationDeg: number,
 *   solarZenithDeg: number,
 *   label: string,
 *   disclaimer: string,
 *   calculatedAt: string
 * }}
 */
export function estimateDaylightState(lat, lon, date = new Date()) {
  const { zenithDeg, elevationDeg } = calculateSolarZenith(lat, lon, date);

  let solarState;
  let label;

  if (elevationDeg >= 0) {
    solarState = 'DAYLIGHT';
    label = 'Daylight (Sun above horizon)';
  } else if (elevationDeg >= -6) {
    solarState = 'CIVIL_TWILIGHT';
    label = 'Civil Twilight (Adequate natural light)';
  } else if (elevationDeg >= -12) {
    solarState = 'NAUTICAL_TWILIGHT';
    label = 'Nautical Twilight (Dim natural light)';
  } else if (elevationDeg >= -18) {
    solarState = 'ASTRONOMICAL_TWILIGHT';
    label = 'Astronomical Twilight (Very dim, sky fading)';
  } else {
    solarState = 'NIGHT';
    label = 'Night (Astronomical darkness)';
  }

  return {
    solarState,
    solarElevationDeg: elevationDeg,
    solarZenithDeg: zenithDeg,
    label,
    disclaimer: SOLAR_DISCLAIMER,
    calculatedAt: date.toISOString(),
  };
}

