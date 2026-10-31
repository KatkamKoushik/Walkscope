import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { defaultCache } from './cache/cacheService.js';
import { registerRoutingRoutes } from './routes/routingRoutes.js';
import { registerContextRoutes } from './routes/contextRoutes.js';
import { registerImageryRoutes } from './routes/imageryRoutes.js';
import { registerGeocodeRoutes } from './routes/geocodeRoutes.js';

export interface ServerOptions {
  logger?: boolean;
  rateLimitMax?: number;
  enableRateLimit?: boolean;
}

export async function buildServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    // Restrict proxy trust to loopback by default to prevent X-Forwarded-For IP spoofing
    trustProxy: process.env.TRUST_PROXY ? (process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY) : '127.0.0.1',
    // Hardened request body limit (1MB max payload to protect against memory exhaustion DoS)
    bodyLimit: 1048576,
  });

  // Global error handler: never leak internal stack traces or file paths to clients (OWASP API3:2023)
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        ok: false,
        error: error.message || 'Client error',
        code: error.code || 'BAD_REQUEST',
      });
    }

    // Server-side internal error masking
    if (options.logger) {
      request.log.error(error);
    }
    return reply.status(500).send({
      ok: false,
      error: 'An unexpected internal gateway error occurred. Please retry shortly.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  // Security Headers (MIME-sniffing, clickjacking, HSTS protection)
  await app.register(helmet, {
    contentSecurityPolicy: false, // API gateway serves JSON, not HTML
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // Enable Cross-Origin Resource Sharing for mobile apps and dev clients
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Fair-use rate limiting shield (default 100 req / minute per IP)
  if (options.enableRateLimit !== false) {
    await app.register(rateLimit, {
      max: options.rateLimitMax ?? 100,
      timeWindow: '1 minute',
    });
  }

  // Health & Monitoring Endpoint with memory & runtime telemetry
  app.get('/health', async () => {
    const mem = process.memoryUsage();
    return {
      status: 'ok',
      service: 'Walkscope Geospatial Gateway',
      version: '1.0.0',
      uptime: Math.round(process.uptime()),
      cacheEntries: defaultCache.size(),
      memory: {
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Register Core Subsystems
  await registerRoutingRoutes(app);
  await registerContextRoutes(app);
  await registerImageryRoutes(app);
  await registerGeocodeRoutes(app);

  return app;
}
