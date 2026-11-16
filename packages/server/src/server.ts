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
    logger: options.logger
      ? {
          serializers: {
            req(req: any) {
              return {
                method: req.method,
                // Redact query strings from logs to prevent recording exact GPS coordinates (Finding P2)
                url: req.url ? req.url.split('?')[0] : '',
                remoteAddress: req.ip,
              };
            },
          },
        }
      : false,
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
    const cacheStatus = defaultCache.getStatus
      ? defaultCache.getStatus()
      : { tier: 'in-memory-l1', redisConnected: false, l1Entries: defaultCache.size() };

    return {
      status: 'ok',
      service: 'Walkscope Geospatial Gateway',
      version: '1.0.0',
      uptime: Math.round(process.uptime()),
      cacheEntries: defaultCache.size(),
      cacheTier: cacheStatus.tier,
      cacheStatus,
      memory: {
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Liveness probe for container orchestrators (WS-040)
  app.get('/health/live', async () => ({
    status: 'live',
    timestamp: new Date().toISOString(),
  }));

  // Interactive Web Browser Preview (Playwright E2E & Web Companion)
  app.get('/', async (_request, reply) => {
    return reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Walkscope Web Companion Preview</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    :root {
      --bg-dark: #090D16;
      --card-dark: #0F172A;
      --border-slate: #1E293B;
      --text-white: #F8FAFC;
      --text-muted: #94A3B8;
      --brand-green: #10B981;
      --accent-blue: #0284C7;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-dark);
      color: var(--text-white);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    header {
      background: var(--card-dark);
      border-bottom: 1px solid var(--border-slate);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 1000;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 18px;
      letter-spacing: -0.5px;
    }
    .badge-live {
      background: rgba(16, 185, 129, 0.2);
      color: var(--brand-green);
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    #main-container {
      display: flex;
      flex: 1;
      position: relative;
    }
    #map-view {
      flex: 1;
      height: 100%;
      background: #090D16;
    }
    .leaflet-tile {
      filter: brightness(0.65) invert(1) contrast(3) hue-rotate(200deg) saturate(0.35);
    }
    #sidebar {
      width: 380px;
      background: var(--card-dark);
      border-left: 1px solid var(--border-slate);
      display: flex;
      flex-direction: column;
      padding: 20px;
      gap: 16px;
      overflow-y: auto;
      z-index: 1000;
    }
    .hud-card {
      background: #1E293B;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .hud-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .score-value {
      font-size: 32px;
      font-weight: 800;
      color: var(--brand-green);
      line-height: 1.1;
    }
    .score-desc {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .route-btn {
      width: 100%;
      min-height: 48px;
      padding: 12px;
      border-radius: 10px;
      background: var(--accent-blue);
      color: #FFFFFF;
      font-weight: 700;
      font-size: 15px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.15s ease;
    }
    .route-btn:hover {
      background: #0369A1;
    }
    .emergency-btn {
      width: 100%;
      min-height: 48px;
      padding: 12px;
      border-radius: 10px;
      background: #DC2626;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 15px;
      border: none;
      cursor: pointer;
      margin-top: auto;
    }
    @media (max-width: 768px) {
      #main-container { flex-direction: column; }
      #sidebar { width: 100%; height: 260px; border-left: none; border-top: 1px solid var(--border-slate); }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🚶</span>
      <span>Walkscope</span>
    </div>
    <div class="badge-live" data-testid="status-badge">GATEWAY CONNECTED</div>
  </header>
  <div id="main-container">
    <div id="map-view" data-testid="leaflet-map"></div>
    <div id="sidebar">
      <div class="hud-card" data-testid="context-score-card">
        <div class="hud-title">Information Coverage</div>
        <div class="score-value" data-testid="score-value">84%</div>
        <div class="score-desc" data-testid="score-desc">High Mapped Data Density (Corridor Evaluated)</div>
      </div>
      <div class="hud-card" data-testid="route-summary-card">
        <div class="hud-title">Active Corridor</div>
        <div style="font-weight: 700; font-size: 15px;">Bengaluru MG Road → Brigade Road</div>
        <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">950m • ~13 min walking</div>
      </div>
      <button class="route-btn" data-testid="calculate-route-btn" aria-label="Calculate walking route">
        <span>🧭</span> Calculate Route
      </button>
      <button class="emergency-btn" data-testid="emergency-btn" aria-label="Emergency Speed Dial 112">
        <span>📞</span> Emergency Dial 112
      </button>
    </div>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map-view', { zoomControl: true }).setView([12.9756, 77.6066], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    var polyline = L.polyline([[12.9756, 77.6066], [12.9719, 77.6070]], { color: '#0284C7', weight: 6 }).addTo(map);
  </script>
</body>
</html>`);
  });

  // Readiness probe checking memory budgets & cache dependencies (WS-040)
  app.get('/health/ready', async (_request, reply) => {
    const mem = process.memoryUsage();
    // Safety check: fail readiness if heap RSS exceeds 1.5GB
    if (mem.rss > 1610612736) {
      return reply.status(503).send({
        status: 'not_ready',
        reason: 'Memory saturation',
      });
    }

    const cacheStatus = defaultCache.getStatus
      ? defaultCache.getStatus()
      : { tier: 'in-memory-l1', redisConnected: false, l1Entries: defaultCache.size() };

    return {
      status: 'ready',
      service: 'Walkscope Geospatial Gateway',
      cacheStatus,
      uptime: Math.round(process.uptime()),
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
