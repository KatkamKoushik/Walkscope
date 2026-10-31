import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  findStreetImageryNear,
  stripTileLayers,
  fetchTile,
  mapillaryToken,
  TileUpstreamError,
} from '@walking-companion/core';
import { defaultCache } from '../cache/cacheService.js';

interface NearbyImageryQuery {
  lat?: string;
  lon?: string;
  radiusM?: string;
  limit?: string;
}

interface TileParams {
  z: string;
  x: string;
  y: string;
}

export async function registerImageryRoutes(fastify: FastifyInstance) {
  // 1. Nearby Street-Level Imagery Metadata
  fastify.get(
    '/api/v1/imagery/nearby',
    async (
      request: FastifyRequest<{ Querystring: NearbyImageryQuery }>,
      reply: FastifyReply
    ) => {
      const lat = parseFloat(request.query.lat || '');
      const lon = parseFloat(request.query.lon || '');
      const radiusM = parseInt(request.query.radiusM || '100', 10);
      const limit = parseInt(request.query.limit || '3', 10);

      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return reply.status(400).send({
          ok: false,
          error: 'lat and lon query parameters must be valid WGS-84 coordinates (-90..90, -180..180)',
        });
      }

      const safeRadiusM = Math.min(500, Math.max(10, Number.isFinite(radiusM) ? radiusM : 100));
      const safeLimit = Math.min(10, Math.max(1, Number.isFinite(limit) ? limit : 3));

      const cacheKey = `imagery:nearby:${lat.toFixed(5)},${lon.toFixed(5)}:r${safeRadiusM}:l${safeLimit}`;
      const cached = await defaultCache.get(cacheKey);
      if (cached) {
        reply.header('X-Cache-Status', 'HIT');
        return cached;
      }

      const res = await findStreetImageryNear(lat, lon, { radiusM: safeRadiusM, limit: safeLimit });
      if (res.hasImagery) {
        await defaultCache.set(cacheKey, res, 1800); // 30 minutes TTL
      }

      reply.header('X-Cache-Status', 'MISS');
      return res;
    }
  );

  // 2. Vector Tile Trimmer Endpoint
  fastify.get(
    '/api/v1/imagery/tiles/:z/:x/:y',
    async (
      request: FastifyRequest<{ Params: TileParams }>,
      reply: FastifyReply
    ) => {
      const { z, x, y } = request.params;
      const zoom = parseInt(z, 10);
      const tileX = parseInt(x, 10);
      const tileY = parseInt(y, 10);

      if (
        !Number.isInteger(zoom) ||
        !Number.isInteger(tileX) ||
        !Number.isInteger(tileY) ||
        zoom < 0 ||
        zoom > 22
      ) {
        return reply.status(400).send({ error: 'z, x, y must be valid tile coordinates (0 <= z <= 22)' });
      }

      const maxTileCoord = Math.pow(2, zoom);
      if (tileX < 0 || tileX >= maxTileCoord || tileY < 0 || tileY >= maxTileCoord) {
        return reply.status(400).send({ error: 'tile x and y must be within [0, 2^z - 1]' });
      }

      const cacheKey = `tile:trim:${zoom}/${tileX}/${tileY}`;
      const cachedTile = await defaultCache.get<Buffer>(cacheKey);
      if (cachedTile) {
        reply.header('X-Cache-Status', 'HIT');
        reply.header('Content-Type', 'application/x-protobuf');
        return cachedTile;
      }

      // If Mapillary client token is configured, fetch and trim live upstream tile
      if (mapillaryToken()) {
        try {
          const { bytes, source } = await fetchTile(
            { z: zoom, x: tileX, y: tileY, key: `${zoom}/${tileX}/${tileY}` }
          );
          await defaultCache.set(cacheKey, bytes, 86400); // 24h TTL
          reply.header('X-Cache-Status', source === 'memory' ? 'HIT' : 'MISS');
          reply.header('Content-Type', 'application/x-protobuf');
          return bytes;
        } catch (err: any) {
          if (err instanceof TileUpstreamError) {
            if (err.retryAfter) reply.header('Retry-After', err.retryAfter);
            return reply.status(err.status || 502).send({
              error: 'Upstream Mapillary tile retrieval error',
              status: err.status,
            });
          }
          fastify.log.error(err, 'Vector tile proxy unexpected upstream failure');
        }
      }

      // When token is unconfigured or in offline development, return trimmed fallback tile
      // with honest diagnostic headers disclosing unauthenticated mode
      const emptyTile = Buffer.from([0x1a, 0x00]); // Valid empty MVT protobuf
      const trimmed = stripTileLayers(emptyTile, ['unwanted_layer']);

      await defaultCache.set(cacheKey, trimmed, 86400); // 24 hours TTL
      reply.header('X-Tile-Status', 'unauthenticated-fallback');
      reply.header('X-Tile-Notice', 'Set MAPILLARY_CLIENT_TOKEN to proxy live upstream Mapillary vector tiles.');
      reply.header('X-Cache-Status', 'MISS');
      reply.header('Content-Type', 'application/x-protobuf');
      return trimmed;
    }
  );
}
