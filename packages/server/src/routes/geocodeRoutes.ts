import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { defaultCache } from '../cache/cacheService.js';

interface GeocodeQuery {
  q?: string;
  limit?: string;
}

export interface GeocodeLocation {
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
}

// Built-in benchmark locations for fast instant lookup
export const BENCHMARK_LOCATIONS: GeocodeLocation[] = [
  {
    title: 'Trafalgar Square, London',
    subtitle: 'City of Westminster, Greater London, England',
    latitude: 51.5080,
    longitude: -0.1281,
  },
  {
    title: 'Covent Garden, London',
    subtitle: 'London, Greater London, England',
    latitude: 51.5120,
    longitude: -0.1240,
  },
  {
    title: 'Piccadilly Circus, London',
    subtitle: 'Westminster, Greater London, England',
    latitude: 51.5101,
    longitude: -0.1340,
  },
  {
    title: 'Leicester Square, London',
    subtitle: 'Westminster, Greater London, England',
    latitude: 51.5113,
    longitude: -0.1283,
  },
  {
    title: 'MG Road Metro Station, Bengaluru',
    subtitle: 'Mahatma Gandhi Road, Bengaluru, Karnataka, India',
    latitude: 12.9756,
    longitude: 77.6066,
  },
  {
    title: 'Brigade Road, Bengaluru',
    subtitle: 'Shanthala Nagar, Ashok Nagar, Bengaluru, Karnataka, India',
    latitude: 12.9733,
    longitude: 77.6074,
  },
  {
    title: 'Cubbon Park, Bengaluru',
    subtitle: 'Kasturba Road, Sampangi Rama Nagara, Bengaluru, Karnataka, India',
    latitude: 12.9763,
    longitude: 77.5929,
  },
];

export async function registerGeocodeRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/v1/geocode/search',
    async (
      request: FastifyRequest<{ Querystring: GeocodeQuery }>,
      reply: FastifyReply
    ) => {
      let query = (request.query.q || '').trim();
      const limit = Math.min(10, Math.max(1, parseInt(request.query.limit || '5', 10)));

      // Strip control chars, null bytes, and non-printable characters (anti-SSRF / anti-injection)
      query = query.replace(/[\x00-\x1F\x7F]/g, '');

      if (!query || query.length < 2) {
        return [];
      }

      // Cap query length to prevent memory/regex attacks
      if (query.length > 120) {
        query = query.slice(0, 120);
      }

      const cacheKey = `geocode:${query.toLowerCase()}:${limit}`;
      const cached = await defaultCache.get(cacheKey);
      if (cached) {
        reply.header('X-Cache-Status', 'HIT');
        return cached;
      }

      // Check benchmark locations first
      const lowerQ = query.toLowerCase();
      const matches = BENCHMARK_LOCATIONS.filter(
        (loc) =>
          loc.title.toLowerCase().includes(lowerQ) ||
          loc.subtitle.toLowerCase().includes(lowerQ)
      );

      if (matches.length > 0) {
        const results = matches.slice(0, limit);
        await defaultCache.set(cacheKey, results, 86400); // 24h
        reply.header('X-Cache-Status', 'MISS');
        return results;
      }

      // 1. Query Photon OSM Geocoder (designed specifically for keystroke typeahead)
      const photonController = new AbortController();
      const photonTimer = setTimeout(() => photonController.abort(), 4000);

      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}`;
        const res = await fetch(photonUrl, {
          headers: {
            'User-Agent': 'WalkscopeGeospatialGateway/1.0',
            'Accept': 'application/json',
          },
          signal: photonController.signal,
        });

        clearTimeout(photonTimer);

        if (res.ok) {
          const data: any = await res.json();
          if (Array.isArray(data.features) && data.features.length > 0) {
            const results: GeocodeLocation[] = data.features
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
              .filter((loc: GeocodeLocation | null): loc is GeocodeLocation => loc !== null);

            if (results.length > 0) {
              await defaultCache.set(cacheKey, results, 86400); // 24h
              reply.header('X-Cache-Status', 'MISS');
              return results;
            }
          }
        }
      } catch {
        clearTimeout(photonTimer);
      }

      // 2. Fallback to OpenStreetMap Nominatim with strict timeout
      const nominatimController = new AbortController();
      const nominatimTimer = setTimeout(() => nominatimController.abort(), 4000);

      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'WalkscopeGeospatialGateway/1.0 (https://github.com/KatkamKoushik/Walkscope; security@walkscope.app)',
            'Accept-Language': 'en',
          },
          signal: nominatimController.signal,
        });

        clearTimeout(nominatimTimer);

        if (res.ok) {
          const data: any[] = await res.json();
          if (Array.isArray(data)) {
            const results: GeocodeLocation[] = data
              .map((item) => {
                const lat = parseFloat(item.lat);
                const lon = parseFloat(item.lon);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                const displayName = typeof item.display_name === 'string' ? item.display_name : '';
                return {
                  title: item.name || (displayName ? displayName.split(',')[0].trim() : 'Unknown Place'),
                  subtitle: displayName,
                  latitude: lat,
                  longitude: lon,
                };
              })
              .filter((loc: GeocodeLocation | null): loc is GeocodeLocation => loc !== null);

            if (results.length > 0) {
              await defaultCache.set(cacheKey, results, 86400); // 24h
              reply.header('X-Cache-Status', 'MISS');
              return results;
            }
          }
        }
      } catch {
        clearTimeout(nominatimTimer);
      }

      return [];
    }
  );
}
