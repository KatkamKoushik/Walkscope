/**
 * @module clientRoutingService
 * @description Pure client-side pedestrian routing service for React Native and Web.
 * 
 * Complies with Architectural Rules:
 * 1. Zero Node.js HTTP/Express middleware imported into the mobile client.
 * 2. Requests walking alternatives ('alternatives=true').
 * 3. Parses every returned route into a distinct RouteOption.
 * 4. Distinctly handles 0 routes, 1 route, or multiple routes. Never fabricates a route.
 * 5. Uses standard fetch with AbortController timeouts and explicit error reporting.
 */

import { normalizeOsrmSteps, roadLabel, instructionFor, formatRouteDistance, formatRouteDuration } from './routeSteps.js';
import type { RouteOption, RouteStep, RouteProfile } from '../../domain/route';

export const OSRM_PUBLIC_FOOT_ENDPOINT = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const DEFAULT_TIMEOUT_MS = 12000;

export interface RoutingCoord {
  latitude: number;
  longitude: number;
}

export interface ClientRouteResult {
  ok: boolean;
  routes: RouteOption[];
  status: 'SUCCESS' | 'NO_ROUTE_FOUND' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'INVALID_INPUT';
  message?: string;
}

/**
 * Generates a stable, deterministic identifier for a route alternative.
 * Derived from route profile, endpoint coordinates, geometry shape, distance, and duration.
 * Eliminates non-deterministic timestamps (Date.now()) ensuring stable React keys and caching.
 */
export function generateRouteSignature(
  index: number,
  coordinates: [number, number][],
  distanceMeters: number,
  durationSeconds: number,
  profile: RouteProfile = 'foot'
): string {
  const start = coordinates.length > 0 ? `${coordinates[0][0].toFixed(5)},${coordinates[0][1].toFixed(5)}` : '0,0';
  const end = coordinates.length > 0 ? `${coordinates[coordinates.length - 1][0].toFixed(5)},${coordinates[coordinates.length - 1][1].toFixed(5)}` : '0,0';
  const mid = coordinates.length > 2 ? `${coordinates[Math.floor(coordinates.length / 2)][0].toFixed(5)},${coordinates[Math.floor(coordinates.length / 2)][1].toFixed(5)}` : '';

  // 32-bit FNV-1a hash
  let hash = 2166136261;
  const signature = `${profile}:${start}->${mid}->${end}|dist:${distanceMeters}|dur:${durationSeconds}|pts:${coordinates.length}`;
  for (let i = 0; i < signature.length; i++) {
    hash ^= signature.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `route-${profile}-${index + 1}-${hex}`;
}

/**
 * Fetch real walking route alternatives between origin and destination.
 */
export async function calculatePedestrianRoutes(
  origin: RoutingCoord,
  destination: RoutingCoord,
  options: {
    endpoint?: string;
    timeoutMs?: number;
    fetchFn?: typeof fetch;
  } = {}
): Promise<ClientRouteResult> {
  const {
    endpoint = OSRM_PUBLIC_FOOT_ENDPOINT,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchFn = globalThis.fetch,
  } = options;

  // Validate coordinates
  if (!isValidCoord(origin) || !isValidCoord(destination)) {
    return {
      ok: false,
      routes: [],
      status: 'INVALID_INPUT',
      message: 'Invalid origin or destination coordinates.',
    };
  }

  // Construct standard OSRM pedestrian URL with alternatives=true, geometries=geojson, steps=true
  const url = `${endpoint}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=true&alternatives=true`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (response.status === 429) {
      return {
        ok: false,
        routes: [],
        status: 'RATE_LIMITED',
        message: 'Routing service is rate-limited. Please wait a moment before retrying.',
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        routes: [],
        status: 'NETWORK_ERROR',
        message: `Routing service returned status HTTP ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.code === 'NoRoute' || !Array.isArray(data.routes) || data.routes.length === 0) {
      return {
        ok: true,
        routes: [],
        status: 'NO_ROUTE_FOUND',
        message: 'No walking route found between these locations.',
      };
    }

    // Parse every returned route alternative
    const parsedRoutes: RouteOption[] = data.routes.map((rawRoute: any, index: number) => {
      const { steps: normalizedSteps } = normalizeOsrmSteps(rawRoute);
      const coords = (rawRoute.geometry?.coordinates || []) as [number, number][];
      const distanceMeters = Math.round(rawRoute.distance || 0);
      const durationSeconds = Math.round(rawRoute.duration || 0);

      const steps: RouteStep[] = (normalizedSteps || []).map((step: any) => {
        const instruction = step.instruction || instructionFor(step);
        const roadName = roadLabel(step);
        return {
          name: step.name || roadName || '',
          ref: step.ref || '',
          instruction,
          roadName,
          distanceMeters: Math.round(step.distanceM || 0),
          durationSeconds: Math.round(step.durationS || 0),
          location: [step.lon, step.lat] as [number, number],
          maneuver: {
            type: step.type || '',
            modifier: step.modifier || '',
            instruction,
            location: [step.lon, step.lat] as [number, number],
            roadName,
          },
        };
      });

      return {
        id: generateRouteSignature(index, coords, distanceMeters, durationSeconds, 'foot'),
        profile: 'foot',
        distanceMeters,
        durationSeconds,
        distanceFormatted: formatRouteDistance(rawRoute.distance),
        durationFormatted: formatRouteDuration(rawRoute.duration),
        geometry: rawRoute.geometry,
        turnsCount: steps.length,
        steps,
        provider: 'osrm-foot',
        retrievedAt: new Date().toISOString(),
      };
    });

    return {
      ok: true,
      routes: parsedRoutes,
      status: 'SUCCESS',
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return {
        ok: false,
        routes: [],
        status: 'NETWORK_ERROR',
        message: 'Routing request timed out. Please check your connection.',
      };
    }
    return {
      ok: false,
      routes: [],
      status: 'NETWORK_ERROR',
      message: err.message || 'Network request failed',
    };
  }
}

function isValidCoord(coord?: RoutingCoord): boolean {
  if (!coord) return false;
  const { latitude, longitude } = coord;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
