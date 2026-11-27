/**
 * ChessIQ v3.3.0 — Production Distributed Engine Worker Entrypoint
 * Executes:
 *   1. Bounded Stockfish NNUE worker pool
 *   2. Reactive PostgreSQL LISTEN/NOTIFY + full-jitter FIFO claim loop
 *   3. Periodic stale job recovery sweep (StaleRecoveryScheduler, 2-minute interval)
 *   4. Graceful SIGTERM / SIGINT shutdown with pool & engine cleanup
 */

const os = require("os");
const env = require("./config/env");
const logger = require("./utils/logger");
const { pool, closePool } = require("./db/pool");
const StockfishPool = require("./engine/stockfishPool");
const { runWorkerLoop, StaleRecoveryScheduler } = require("./queue");

/**
 * Starts the background analysis worker and stale recovery scheduler.
 * Exported for testability without side-effects on require().
 */
async function startWorkerRuntime() {
  const workerId = `chessiq-worker-${os.hostname()}-${process.pid}`;
  const stockfishPool = new StockfishPool();

  const scheduler = new StaleRecoveryScheduler({
    pool,
    intervalMs: 120000,
    timeoutInterval: "2 minutes",
  });
  scheduler.start();

  const workerHandle = await runWorkerLoop(pool, workerId, stockfishPool, {
    depth: env.STOCKFISH_DEPTH,
  });

  logger.info(
    {
      workerId,
      maxConcurrentJobs: env.MAX_CONCURRENT_JOBS,
      stockfishDepth: env.STOCKFISH_DEPTH,
      stockfishPath: env.STOCKFISH_PATH,
    },
    "ChessIQ v3.3.0 Stockfish Queue Worker started",
  );

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(
      { signal, workerId },
      "Shutting down Stockfish Queue Worker...",
    );

    const forceTimer = setTimeout(() => {
      logger.error(
        "Worker shutdown timed out after 10000ms. Exiting forcefully.",
      );
      process.exit(1);
    }, 10000);
    forceTimer.unref();

    try {
      scheduler.stop();
      if (workerHandle && typeof workerHandle.stop === "function") {
        await workerHandle.stop();
      }
      if (typeof stockfishPool.shutdown === "function") {
        await stockfishPool.shutdown();
      }
      await closePool();
      clearTimeout(forceTimer);
      logger.info("Worker runtime exited cleanly.");
      process.exit(0);
    } catch (err) {
      logger.error({ err: err.message }, "Error during worker shutdown");
      clearTimeout(forceTimer);
      process.exit(1);
    }
  }

  return { workerId, stockfishPool, scheduler, workerHandle, shutdown };
}

if (require.main === module) {
  startWorkerRuntime()
    .then(({ shutdown }) => {
      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));
      process.on("uncaughtException", (err) => {
        logger.fatal(
          { err: err.message, stack: err.stack },
          "Worker uncaughtException",
        );
        shutdown("uncaughtException");
      });
      process.on("unhandledRejection", (reason) => {
        logger.fatal({ reason }, "Worker unhandledRejection");
        shutdown("unhandledRejection");
      });
    })
    .catch((err) => {
      logger.fatal(
        { err: err.message },
        "Failed to start ChessIQ worker runtime",
      );
      process.exit(1);
    });
}

module.exports = { startWorkerRuntime };
