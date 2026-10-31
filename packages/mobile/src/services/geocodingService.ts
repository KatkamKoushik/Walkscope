/**
 * @module geocodingService
 * @description Geocoding and device GPS location handler.
 * 
 * Satisfies fair-use compliance:
 * - Uses Photon (by Komoot, open OSM geocoder designed for typeahead autocomplete)
 * - Injects instant offline verified benchmarks (London, Bengaluru)
 * - Transparently queries Gateway backend with client-direct fallback
 * - Never bombards Nominatim with keystroke autocomplete
 */

import * as Location from 'expo-location';
import { GATEWAY_BASE_URL } from './routingAdapter';

export interface LocationPoint {
  title: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
}

// Built-in verified benchmark points for quick offline/instant testing
export const BENCHMARK_POINTS: LocationPoint[] = [
  // London Benchmarks
  {
    title: 'Trafalgar Square',
    subtitle: 'London, UK',
    latitude: 51.5080,
    longitude: -0.1281,
  },
  {
    title: 'Covent Garden',
    subtitle: 'London, UK',
    latitude: 51.5117,
    longitude: -0.1240,
  },
  {
    title: 'British Museum',
    subtitle: 'Great Russell St, London, UK',
    latitude: 51.5194,
    longitude: -0.1270,
  },
  {
    title: 'St Paul’s Cathedral',
    subtitle: 'London, UK',
    latitude: 51.5138,
    longitude: -0.0984,
  },
  // Indian Pilot City Benchmarks (Bengaluru)
  {
    title: 'MG Road Metro Station',
    subtitle: 'Bengaluru, Karnataka, India',
    latitude: 12.9756,
    longitude: 77.6066,
  },
  {
    title: 'Brigade Road Junction',
    subtitle: 'Bengaluru, Karnataka, India',
    latitude: 12.9738,
    longitude: 77.6080,
  },
  {
    title: 'Cubbon Park Entrance',
    subtitle: 'Kasturba Rd, Bengaluru, India',
    latitude: 12.9760,
    longitude: 77.5929,
  },
  {
    title: 'Commercial Street',
    subtitle: 'Tasker Town, Bengaluru, India',
    latitude: 12.9822,
    longitude: 77.6083,
  },
];

export async function requestDeviceLocation(): Promise<{
  ok: boolean;
  point?: LocationPoint;
  error?: 'PERMISSION_DENIED' | 'TIMEOUT' | 'UNAVAILABLE';
  message?: string;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        ok: false,
        error: 'PERMISSION_DENIED',
        message: 'Location permission was denied. You can manually enter or select an origin.',
      };
    }

    const loc = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Location timeout')), 8000)
      ),
    ]);

    if (!loc) {
      return {
        ok: false,
        error: 'UNAVAILABLE',
        message: 'Current location is unavailable.',
      };
    }

    return {
      ok: true,
      point: {
        title: 'Current Location',
        subtitle: `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      },
    };
  } catch {
    return {
      ok: false,
      error: 'TIMEOUT',
      message: 'Could not obtain location in time. Using manual origin.',
    };
  }
}

export async function searchDestinations(query: string): Promise<LocationPoint[]> {
  if (!query || query.trim().length < 2) {
    return BENCHMARK_POINTS;
  }

  const q = query.trim().toLowerCase();
  const localMatches = BENCHMARK_POINTS.filter(
    (p) => p.title.toLowerCase().includes(q) || (p.subtitle && p.subtitle.toLowerCase().includes(q))
  );

  // 1. Try Geospatial Gateway (which caches & proxies Photon)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const gatewayRes = await fetch(`${GATEWAY_BASE_URL}/api/v1/geocode/search?q=${encodeURIComponent(query)}&limit=5`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (gatewayRes.ok) {
      const results: LocationPoint[] = await gatewayRes.json();
      if (Array.isArray(results) && results.length > 0) {
        return results;
      }
    }
  } catch {
    // Gateway offline/timeout: fallback to direct Photon
  }

  // 2. Direct Photon Autocomplete (OpenStreetMap search by Komoot)
  const photonController = new AbortController();
  const photonTimer = setTimeout(() => photonController.abort(), 4000);

  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
    const res = await fetch(photonUrl, {
      headers: {
        'Accept': 'application/json',
      },
      signal: photonController.signal,
    });
    clearTimeout(photonTimer);

    if (res.ok) {
      const data: any = await res.json();
      if (Array.isArray(data.features) && data.features.length > 0) {
        const results: LocationPoint[] = data.features
          .map((feat: any) => {
            const coords = feat?.geometry?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) return null;
            const lon = coords[0];
            const lat = coords[1];
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

            const p = feat.properties || {};
            const subtitleParts = [p.street, p.locality || p.district, p.city, p.state, p.country].filter(Boolean);
            return {
              title: p.name || subtitleParts[0] || 'Unknown Place',
              subtitle: subtitleParts.join(', '),
              latitude: lat,
              longitude: lon,
            };
          })
          .filter((pt: LocationPoint | null): pt is LocationPoint => pt !== null);

        if (results.length > 0) {
          return results;
        }
      }
    }
  } catch {
    clearTimeout(photonTimer);
    // Fall back to local offline matches
  }

  // Offline fallback: try matching local stored recent searches in addition to benchmark points
  try {
    const { getRecentSearches } = await import('./storageService');
    const recent = await getRecentSearches(10);
    const recentMatches: LocationPoint[] = (recent || [])
      .filter((r) => r.display_name?.toLowerCase().includes(q) || r.query?.toLowerCase().includes(q))
      .map((r) => ({
        title: r.display_name,
        subtitle: `Saved search (${r.query})`,
        latitude: r.lat,
        longitude: r.lon,
      }));
    if (recentMatches.length > 0) {
      return [...localMatches, ...recentMatches];
    }
  } catch {
    // Local SQLite storage not initialized or unavailable in current runtime
  }

  return localMatches;
}
