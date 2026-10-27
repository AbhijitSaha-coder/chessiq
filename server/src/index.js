/**
 * ChessIQ v3.3.0 — Server Entrypoint & Graceful Lifecycle Manager
 * Initializes HTTP listener, registers SIGTERM/SIGINT signal handlers,
 * drains the connection pool on exit, and guarantees clean process teardown.
 */

const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { closePool } = require('./db/pool');

const server = http.createServer(app);

let isShuttingDown = false;

server.listen(env.PORT, env.HOST, () => {
  logger.info(
    {
      host: env.HOST,
      port: env.PORT,
      node_env: env.NODE_ENV,
      pid: process.pid,
      node_version: process.version,
      stockfish_path: env.STOCKFISH_PATH,
    },
    `ChessIQ v3.3.0 Backend Gateway running on http://${env.HOST}:${env.PORT}`
  );
});

/**
 * Executes ordered teardown of network sockets, background workers, and database pools
 * @param {string} signal
 */
async function handleShutdown(signal) {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Shutdown already in progress. Ignoring duplicate signal.');
    return;
  }
  isShuttingDown = true;
  logger.info({ signal }, `Received ${signal}. Initiating graceful shutdown...`);

  // Force termination if graceful shutdown stalls beyond 10 seconds
  const forceTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out (10000ms). Forcing process exit.');
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  // 1. Stop accepting new incoming HTTP connections
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error closing HTTP server socket');
    } else {
      logger.info('HTTP server stopped accepting new requests.');
    }

    try {
      // 2. Drain and disconnect database connection pool
      await closePool();
      logger.info('Graceful shutdown complete. Exiting cleanly.');
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (cleanupErr) {
      logger.error({ err: cleanupErr }, 'Error during shutdown resource cleanup');
      clearTimeout(forceTimer);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'FATAL: Uncaught Exception');
  handleShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'FATAL: Unhandled Promise Rejection');
  handleShutdown('unhandledRejection');
});

module.exports = server;
