import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fetchCorridorAmenities } from '@walking-companion/core';
import { defaultCache } from '../cache/cacheService.js';

interface CorridorContextRequestBody {
  coordinates: Array<[number, number]>;
  maxCorridorDistanceMeters?: number;
  bufferDegrees?: number;
  timeoutMs?: number;
}

export async function registerContextRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/v1/context/corridor',
    async (
      request: FastifyRequest<{ Body: CorridorContextRequestBody }>,
      reply: FastifyReply
    ) => {
      const {
        coordinates,
        maxCorridorDistanceMeters = 120,
        bufferDegrees = 0.0015,
        timeoutMs = 8000,
      } = request.body || {};

      if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return reply.status(400).send({
          ok: false,
          error: 'coordinates must be a non-empty array of [lon, lat] pairs',
        });
      }

      // Safeguard against unbounded coordinates DoS payload
      if (coordinates.length > 2000) {
        return reply.status(400).send({
          ok: false,
          error: 'coordinates array exceeds maximum allowed length of 2000 points',
        });
      }

      // Validate coordinate points
      for (const pt of coordinates) {
        if (!Array.isArray(pt) || pt.length < 2 || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
          return reply.status(400).send({
            ok: false,
            error: 'All coordinates must be finite numeric [longitude, latitude] pairs',
          });
        }
      }

      const safeMaxCorridorDistance = Math.min(500, Math.max(10, Number(maxCorridorDistanceMeters) || 120));
      const safeBufferDegrees = Math.min(0.01, Math.max(0.0005, Number(bufferDegrees) || 0.0015));
      const safeTimeoutMs = Math.min(20000, Math.max(1000, Number(timeoutMs) || 8000));

      // Generate compact cache key from first, middle, last points + count
      const startPt = coordinates[0];
      const midPt = coordinates[Math.floor(coordinates.length / 2)];
      const endPt = coordinates[coordinates.length - 1];
      const cacheKey = `amenities:${coordinates.length}:${startPt[0].toFixed(5)},${startPt[1].toFixed(5)}:${midPt[0].toFixed(5)},${midPt[1].toFixed(5)}:${endPt[0].toFixed(5)},${endPt[1].toFixed(5)}`;

      const cached = await defaultCache.get(cacheKey);
      if (cached) {
        reply.header('X-Cache-Status', 'HIT');
        return cached;
      }

      const res = await fetchCorridorAmenities(coordinates, {
        bufferDegrees: safeBufferDegrees,
        maxCorridorDistanceMeters: safeMaxCorridorDistance,
        timeoutMs: safeTimeoutMs,
      });

      const features = res.features || [];
      let transitCount = 0;
      let emergencyCount = 0;
      let servicesCount = 0;
      let lightingCount = 0;

      for (const feat of features) {
        if (feat.category === 'transit') transitCount++;
        else if (feat.category === 'emergency') emergencyCount++;
        else if (feat.category === 'services') servicesCount++;
        else if (feat.category === 'lighting') lightingCount++;
      }

      const responsePayload = {
        ok: !res.error,
        features,
        totalAmenitiesCount: features.length,
        evaluatedBufferDistanceM: safeMaxCorridorDistance,
        categoryBreakdown: {
          transit: transitCount,
          emergency: emergencyCount,
          services: servicesCount,
          lighting: lightingCount,
        },
        disclaimer: 'Mapped features from OpenStreetMap (ODbL); not verified operational, staffed, or open now.',
        error: res.error,
      };

      if (!res.error && features.length > 0) {
        await defaultCache.set(cacheKey, responsePayload, 3600); // 1 hour TTL
      }

      reply.header('X-Cache-Status', 'MISS');
      return responsePayload;
    }
  );
}
