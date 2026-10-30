import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { calculatePedestrianRoutes } from '@walking-companion/core';
import { defaultCache } from '../cache/cacheService.js';

interface PedestrianRouteRequestBody {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  timeoutMs?: number;
}

// In-flight request deduplication map
const inFlightRequests = new Map<string, Promise<any>>();

export async function registerRoutingRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/v1/routes/pedestrian',
    async (
      request: FastifyRequest<{ Body: PedestrianRouteRequestBody }>,
      reply: FastifyReply
    ) => {
      const { origin, destination, timeoutMs } = request.body || {};

      if (
        !origin ||
        !destination ||
        !Number.isFinite(origin.latitude) ||
        !Number.isFinite(origin.longitude) ||
        !Number.isFinite(destination.latitude) ||
        !Number.isFinite(destination.longitude)
      ) {
        return reply.status(400).send({
          ok: false,
          status: 'INVALID_INPUT',
          message: 'origin and destination must each contain valid finite numeric latitude and longitude.',
        });
      }

      if (
        origin.latitude < -90 ||
        origin.latitude > 90 ||
        destination.latitude < -90 ||
        destination.latitude > 90 ||
        origin.longitude < -180 ||
        origin.longitude > 180 ||
        destination.longitude < -180 ||
        destination.longitude > 180
      ) {
        return reply.status(400).send({
          ok: false,
          status: 'INVALID_INPUT',
          message: 'Coordinates out of valid WGS-84 geographic range.',
        });
      }

      const safeTimeoutMs = Math.min(30000, Math.max(1000, Number(timeoutMs) || 12000));
      const cacheKey = `route:${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}->${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)}`;

      // 1. Check Cache
      const cached = await defaultCache.get(cacheKey);
      if (cached) {
        reply.header('X-Cache-Status', 'HIT');
        return cached;
      }

      // 2. Request deduplication
      let inFlight: Promise<any> | undefined = inFlightRequests.get(cacheKey);
      if (!inFlight) {
        inFlight = calculatePedestrianRoutes(origin, destination, { timeoutMs: safeTimeoutMs })
          .then(async (result: any) => {
            if (result && result.ok && result.routes && result.routes.length > 0) {
              await defaultCache.set(cacheKey, result, 600); // 10 minutes TTL
            }
            return result;
          })
          .catch((err) => ({
            ok: false,
            status: 'NETWORK_ERROR',
            message: err.message || 'Routing gateway failure',
            routes: [],
          }))
          .finally(() => {
            inFlightRequests.delete(cacheKey);
          });

        inFlightRequests.set(cacheKey, inFlight);
      }

      reply.header('X-Cache-Status', 'MISS');
      const result = await inFlight;
      return result;
    }
  );
}
