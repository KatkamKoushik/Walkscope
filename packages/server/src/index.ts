import { buildServer } from './server.js';
import { defaultCache } from './cache/cacheService.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const server = await buildServer({ logger: true });

  const gracefulShutdown = async (signal: string) => {
    console.log(`[Walkscope Gateway] Received ${signal}, closing server gracefully...`);
    try {
      if (defaultCache.stop) defaultCache.stop();
      await server.close();
      console.log('[Walkscope Gateway] Server closed cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('[Walkscope Gateway] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  try {
    const address = await server.listen({ port: PORT, host: HOST });
    console.log(`[Walkscope Gateway] Server listening at ${address}`);
  } catch (err) {
    console.error('[Walkscope Gateway] Failed to start server:', err);
    process.exit(1);
  }
}

main();
