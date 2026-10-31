/**
 * ChessIQ v3.3.0 — Stockfish NNUE Worker Pool & Resource Manager
 * Day 5 (@BE): Manages a bounded pool of StockfishWorker instances with:
 *
 * - Configurable concurrency (MAX_CONCURRENT_JOBS)
 * - Worker acquisition / release lifecycle
 * - Per-game memory isolation via hash table clearing (§11.1)
 * - Graceful pool-wide shutdown
 * - Health status reporting
 *
 * The pool ensures that:
 * 1. At most N workers are active simultaneously
 * 2. Each worker's transposition table is cleared between games
 * 3. Crashed workers are automatically replaced
 */

const StockfishWorker = require("./stockfishWorker");
const env = require("../config/env");
const logger = require("../utils/logger");

class StockfishPool {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxWorkers] - Max concurrent workers (from env MAX_CONCURRENT_JOBS)
   * @param {string} [options.stockfishPath] - Path to Stockfish binary (from env STOCKFISH_PATH)
   * @param {number} [options.threads] - Threads per worker (from env STOCKFISH_THREADS)
   * @param {number} [options.hashMb] - Hash MB per worker (from env STOCKFISH_HASH_MB)
   * @param {number} [options.searchTimeoutMs] - Search timeout (from env STOCKFISH_SEARCH_TIMEOUT_MS)
   * @param {number} [options.killGraceMs] - Kill grace period (from env STOCKFISH_KILL_GRACE_MS)
   */
  constructor(options = {}) {
    this.maxWorkers = options.maxWorkers || env.MAX_CONCURRENT_JOBS;
    this.stockfishPath = options.stockfishPath || env.STOCKFISH_PATH;
    this.threads = options.threads || env.STOCKFISH_THREADS;
    this.hashMb = options.hashMb || env.STOCKFISH_HASH_MB;
    this.searchTimeoutMs =
      options.searchTimeoutMs || env.STOCKFISH_SEARCH_TIMEOUT_MS;
    this.killGraceMs = options.killGraceMs || env.STOCKFISH_KILL_GRACE_MS;
    this._spawnFn = options.spawnFn || null;

    /** @type {StockfishWorker[]} Idle, initialized workers ready for use */
    this._idle = [];

    /** @type {Set<StockfishWorker>} Workers currently in use by analysis jobs */
    this._active = new Set();

    /** @type {Array<{ resolve: Function, reject: Function }>} Pending acquisition requests */
    this._waitQueue = [];

    /** @type {boolean} Whether the pool is shutting down */
    this._isShuttingDown = false;

    /** @type {number} Total workers ever created (for unique IDs) */
    this._workerIdCounter = 0;

    logger.info(
      {
        maxWorkers: this.maxWorkers,
        stockfishPath: this.stockfishPath,
        threads: this.threads,
        hashMb: this.hashMb,
      },
      "StockfishPool configured",
    );
  }

  /**
   * Acquires a StockfishWorker from the pool. If all workers are busy and the pool
   * is at capacity, this call blocks until one becomes available.
   *
   * The returned worker has already had its hash table cleared for the new game
   * (ucinewgame + Clear Hash + isready → readyok).
   *
   * @returns {Promise<StockfishWorker>}
   * @throws {Error} If pool is shutting down or worker initialization fails
   */
  async acquire() {
    if (this._isShuttingDown) {
      throw new Error("StockfishPool is shutting down. Cannot acquire worker.");
    }

    // Try to get an idle worker
    if (this._idle.length > 0) {
      const worker = this._idle.pop();

      // Verify the worker is still alive
      if (!worker.isAlive) {
        logger.warn(
          { workerId: worker.workerId },
          "Idle worker found dead. Creating replacement.",
        );
        return this._createAndAcquireWorker();
      }

      // Clear hash for new game isolation (§11.1)
      try {
        await worker.prepareForNewGame();
      } catch (err) {
        logger.warn(
          { workerId: worker.workerId, err: err.message },
          "Failed to prepare idle worker for new game. Creating replacement.",
        );
        await this._destroyWorker(worker);
        return this._createAndAcquireWorker();
      }

      this._active.add(worker);
      logger.debug(
        {
          workerId: worker.workerId,
          activeCount: this._active.size,
          idleCount: this._idle.length,
        },
        "Worker acquired from idle pool",
      );
      return worker;
    }

    // No idle workers — can we create a new one?
    const totalWorkers = this._active.size + this._idle.length;
    if (totalWorkers < this.maxWorkers) {
      return this._createAndAcquireWorker();
    }

    // Pool is at capacity — wait for a release
    logger.debug(
      {
        activeCount: this._active.size,
        waitQueueSize: this._waitQueue.length,
      },
      "Pool at capacity. Queuing acquisition request.",
    );

    return new Promise((resolve, reject) => {
      this._waitQueue.push({ resolve, reject });
    });
  }

  /**
   * Releases a worker back to the pool. If there are pending acquisition requests,
   * the worker is immediately handed off rather than returned to idle.
   *
   * @param {StockfishWorker} worker
   */
  async release(worker) {
    this._active.delete(worker);

    // If the worker crashed, don't return it to the pool
    if (!worker.isAlive) {
      logger.warn(
        { workerId: worker.workerId },
        "Released worker is dead. Discarding.",
      );
      this._tryFulfillWaiting();
      return;
    }

    // If there are pending acquisition requests, hand off directly
    if (this._waitQueue.length > 0) {
      const waiter = this._waitQueue.shift();
      try {
        await worker.prepareForNewGame();
        this._active.add(worker);
        waiter.resolve(worker);
      } catch (err) {
        logger.warn(
          { workerId: worker.workerId, err: err.message },
          "Failed to prepare released worker. Creating replacement for waiter.",
        );
        await this._destroyWorker(worker);
        try {
          const fresh = await this._createAndAcquireWorker();
          waiter.resolve(fresh);
        } catch (createErr) {
          waiter.reject(createErr);
        }
      }
      return;
    }

    // Return to idle pool
    this._idle.push(worker);
    logger.debug(
      {
        workerId: worker.workerId,
        activeCount: this._active.size,
        idleCount: this._idle.length,
      },
      "Worker released back to idle pool",
    );
  }

  /**
   * Returns the current pool status.
   * @returns {{ active: number, idle: number, waiting: number, total: number, maxWorkers: number }}
   */
  status() {
    return {
      active: this._active.size,
      idle: this._idle.length,
      waiting: this._waitQueue.length,
      total: this._active.size + this._idle.length,
      maxWorkers: this.maxWorkers,
    };
  }

  /**
   * Gracefully shuts down all workers in the pool.
   * Active workers are sent "quit" and given a grace period before SIGKILL.
   */
  async shutdown() {
    this._isShuttingDown = true;

    // Reject all pending acquisition requests
    for (const waiter of this._waitQueue) {
      waiter.reject(new Error("StockfishPool is shutting down."));
    }
    this._waitQueue = [];

    // Shut down all workers
    const allWorkers = [...this._idle, ...this._active];
    this._idle = [];
    this._active.clear();

    logger.info(
      { workerCount: allWorkers.length },
      "Shutting down all Stockfish workers...",
    );

    const shutdownPromises = allWorkers.map(async (worker) => {
      try {
        await worker.shutdown();
      } catch (err) {
        logger.warn(
          { workerId: worker.workerId, err: err.message },
          "Error during worker shutdown",
        );
        worker.kill("SIGKILL");
      }
    });

    await Promise.allSettled(shutdownPromises);
    logger.info("All Stockfish workers shut down.");
  }

  // ---- Private Methods ----

  /**
   * Creates a new StockfishWorker, initializes it, and adds it to active set.
   * @returns {Promise<StockfishWorker>}
   * @private
   */
  async _createAndAcquireWorker() {
    this._workerIdCounter++;
    const workerId = `sf-worker-${process.pid}-${this._workerIdCounter}`;

    const worker = new StockfishWorker({
      stockfishPath: this.stockfishPath,
      threads: this.threads,
      hashMb: this.hashMb,
      searchTimeoutMs: this.searchTimeoutMs,
      killGraceMs: this.killGraceMs,
      workerId,
      spawnFn: this._spawnFn,
    });

    await worker.initialize();

    // Wire up exit handler for automatic cleanup
    worker.on("exit", () => {
      this._active.delete(worker);
      this._tryFulfillWaiting();
    });

    this._active.add(worker);
    logger.info(
      {
        workerId,
        activeCount: this._active.size,
        pid: worker.process?.pid,
      },
      "New Stockfish worker spawned and acquired",
    );

    return worker;
  }

  /**
   * Destroys a worker (graceful shutdown or force kill).
   * @param {StockfishWorker} worker
   * @private
   */
  async _destroyWorker(worker) {
    this._active.delete(worker);
    try {
      await worker.shutdown();
    } catch (err) {
      worker.kill("SIGKILL");
    }
  }

  /**
   * Attempts to fulfill waiting acquisition requests by creating new workers.
   * @private
   */
  async _tryFulfillWaiting() {
    while (this._waitQueue.length > 0 && !this._isShuttingDown) {
      const totalWorkers = this._active.size + this._idle.length;
      if (totalWorkers >= this.maxWorkers) break;

      const waiter = this._waitQueue.shift();
      try {
        const worker = await this._createAndAcquireWorker();
        waiter.resolve(worker);
      } catch (err) {
        waiter.reject(err);
      }
    }
  }
}

// Export a singleton instance and the class
let _poolInstance = null;

/**
 * Returns the singleton StockfishPool instance.
 * @returns {StockfishPool}
 */
function getStockfishPool() {
  if (!_poolInstance) {
    _poolInstance = new StockfishPool();
  }
  return _poolInstance;
}

StockfishPool.StockfishPool = StockfishPool;
StockfishPool.getStockfishPool = getStockfishPool;

module.exports = StockfishPool;
