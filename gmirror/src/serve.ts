import { GMirrorServer } from './server.js';
import { GMirror } from './core/gmirror.js';
import { StructuredLogger } from '@gstack/shared/core';
import { SecureHealthServer } from './core/public-health-server.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;
const HEALTH_PORT = process.env.HEALTH_PORT ? parseInt(process.env.HEALTH_PORT, 10) : 8080;
const logger = new StructuredLogger('gmirror-serve');

async function main() {
  const gmirror = new GMirror();
  const server = new GMirrorServer(gmirror, PORT);

  // Create health server
  const healthServer = new SecureHealthServer(
    async () => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }),
    async () => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      dependencies: {},
    }),
    HEALTH_PORT
  );

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    await healthServer.shutdown();
    await server.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  healthServer.addShutdownHandler(async () => {
    logger.info('Cleanup complete');
  });

  try {
    await healthServer.start();
    await server.start();
    logger.info(`GMirror HTTP server listening on port ${PORT}`);
  } catch (error) {
    logger.error('Failed to start GMirror server', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

main().catch((error) => logger.error('Main function error', error instanceof Error ? error : new Error(String(error))));
