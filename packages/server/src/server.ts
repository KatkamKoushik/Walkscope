import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { defaultCache } from './cache/cacheService.js';
import { registerRoutingRoutes } from './routes/routingRoutes.js';
import { registerContextRoutes } from './routes/contextRoutes.js';
import { registerImageryRoutes } from './routes/imageryRoutes.js';
import { registerGeocodeRoutes } from './routes/geocodeRoutes.js';

export async function buildServer(options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    // Restrict proxy trust to loopback by default to prevent X-Forwarded-For IP spoofing
    trustProxy: process.env.TRUST_PROXY ? (process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY) : '127.0.0.1',
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

  // Fair-use rate limiting shield (100 req / minute per IP)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Health & Monitoring Endpoint
  app.get('/health', async () => ({
    status: 'ok',
    service: 'Walkscope Geospatial Gateway',
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    cacheEntries: defaultCache.size(),
    timestamp: new Date().toISOString(),
  }));

  // Register Core Subsystems
  await registerRoutingRoutes(app);
  await registerContextRoutes(app);
  await registerImageryRoutes(app);
  await registerGeocodeRoutes(app);

  return app;
}
