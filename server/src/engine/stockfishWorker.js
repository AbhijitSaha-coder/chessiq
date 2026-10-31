/**
 * ChessIQ v3.3.0 — Stockfish NNUE Child Process Worker
 * Day 5 (@BE): Manages a single Stockfish NNUE child process with:
 *
 * - Spawning and UCI handshake (uci → uciok, setoption, isready → readyok)
 * - Game isolation via `ucinewgame` + `setoption name Clear Hash` (§11.1)
 * - Per-ply evaluation: position fen → go depth → parse info/bestmove
 * - Graceful and forced shutdown (quit → SIGTERM → SIGKILL escalation)
 * - Memory isolation: hash table cleared between games to prevent
 *   cross-game transposition table contamination
 */

const cp = require("child_process");
const { EventEmitter } = require("events");
const logger = require("../utils/logger");
const {
  parseInfoLine,
  parseBestMove,
  buildPositionCommand,
  buildGoCommand,
  isReadyOk,
  isUciOk,
  isBestMove,
} = require("./uciProtocol");

class StockfishWorker extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} options.stockfishPath - Absolute path to the stockfish binary
   * @param {number} [options.threads=1] - Number of search threads
   * @param {number} [options.hashMb=64] - Hash table size in MB
   * @param {number} [options.searchTimeoutMs=8000] - Max time per search in ms
   * @param {number} [options.killGraceMs=1500] - Grace period before SIGKILL on shutdown
   * @param {string} [options.workerId] - Unique identifier for this worker instance
   * @param {Function} [options.spawnFn] - Optional spawn function injection (for testing/mocking)
   */
  constructor(options) {
    super();

    this.stockfishPath = options.stockfishPath;
    this.threads = options.threads || 1;
    this.hashMb = options.hashMb || 64;
    this.searchTimeoutMs = options.searchTimeoutMs || 8000;
    this.killGraceMs = options.killGraceMs || 1500;
    this.workerId = options.workerId || `worker-${process.pid}`;
    this._spawnFn = options.spawnFn || null;

    /** @type {import('child_process').ChildProcess | null} */
    this.process = null;

    /** @type {boolean} */
    this.isReady = false;

    /** @type {boolean} */
    this.isAlive = false;

    /** @type {string} */
    this._stdoutBuffer = "";

    /** @type {Array<(line: string) => void>} */
    this._lineListeners = [];
  }

  /**
   * Spawns the Stockfish child process, performs UCI handshake, and configures options.
   * @returns {Promise<void>}
   * @throws {Error} If spawn or handshake fails
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Stockfish initialization timed out after ${this.searchTimeoutMs}ms`,
          ),
        );
        this.kill("SIGKILL");
      }, this.searchTimeoutMs);

      try {
        const spawnProc = this._spawnFn || cp.spawn;
        this.process = spawnProc(this.stockfishPath, [], {
          stdio: ["pipe", "pipe", "pipe"],
          // Detach from parent process group for clean isolation
          detached: false,
        });

        this.isAlive = true;

        // Wire up stdout line parsing
        this.process.stdout.on("data", (data) => {
          this._stdoutBuffer += data.toString();
          const lines = this._stdoutBuffer.split("\n");
          // Keep the last incomplete line in the buffer
          this._stdoutBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0) continue;
            this._dispatchLine(trimmed);
          }
        });

        this.process.stderr.on("data", (data) => {
          logger.warn(
            { workerId: this.workerId, stderr: data.toString().trim() },
            "Stockfish stderr output",
          );
        });

        this.process.on("error", (err) => {
          this.isAlive = false;
          this.isReady = false;
          clearTimeout(timeoutId);
          logger.error(
            { workerId: this.workerId, err: err.message },
            "Stockfish process error",
          );
          this.emit("error", err);
          reject(err);
        });

        this.process.on("exit", (code, signal) => {
          this.isAlive = false;
          this.isReady = false;
          if (!this.isReady) {
            clearTimeout(timeoutId);
            reject(
              new Error(
                `Stockfish exited prematurely with code ${code}, signal ${signal}`,
              ),
            );
          }
          logger.info(
            { workerId: this.workerId, exitCode: code, signal },
            "Stockfish process exited",
          );
          this.emit("exit", code, signal);
        });

        // Step 1: Send "uci" command and wait for "uciok"
        this._waitForLine(isUciOk, this.searchTimeoutMs)
          .then(async () => {
            // Step 2: Configure options
            this._sendCommand(
              `setoption name Threads value ${this.threads}`,
            );
            this._sendCommand(`setoption name Hash value ${this.hashMb}`);
            // MultiPV = 1 for single best line
            this._sendCommand("setoption name MultiPV value 1");

            // Step 3: Send "isready" and wait for "readyok"
            await this._sendAndWaitFor("isready", isReadyOk);
            this.isReady = true;

            clearTimeout(timeoutId);
            logger.info(
              {
                workerId: this.workerId,
                threads: this.threads,
                hashMb: this.hashMb,
                pid: this.process?.pid,
              },
              "Stockfish worker initialized and ready",
            );
            resolve();
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            reject(err);
          });

        this._sendCommand("uci");
      } catch (err) {
        clearTimeout(timeoutId);
        reject(err);
      }
    });
  }

  /**
   * Clears transposition tables and prepares for a new game.
   * Per §11.1: ucinewgame → setoption name Clear Hash → isready → readyok
   * This prevents cross-game transposition table contamination.
   *
   * @returns {Promise<void>}
   */
  async prepareForNewGame() {
    if (!this.isAlive || !this.process) {
      throw new Error("Stockfish process is not running.");
    }

    this._sendCommand("ucinewgame");
    this._sendCommand("setoption name Clear Hash");
    await this._sendAndWaitFor("isready", isReadyOk);

    logger.debug(
      { workerId: this.workerId },
      "Stockfish hash cleared and ready for new game",
    );
  }

  /**
   * Evaluates a single FEN position at the configured search depth.
   * Returns the best move, evaluation, and principal variation.
   *
   * @param {string} fen - FEN string of the position to evaluate
   * @param {number} [depth] - Search depth override (defaults to env STOCKFISH_DEPTH)
   * @returns {Promise<{
   *   bestMove: string,
   *   score: { type: 'cp' | 'mate', value: number },
   *   depth: number,
   *   pv: string[],
   *   nodes: number|null,
   *   time: number|null
   * }>}
   */
  async evaluatePosition(fen, depth) {
    if (!this.isAlive || !this.process) {
      throw new Error("Stockfish process is not running.");
    }

    const searchDepth = depth || 14;

    return new Promise((resolve, reject) => {
      let lastInfo = null;
      let searchTimeout = null;

      const cleanup = () => {
        if (searchTimeout) clearTimeout(searchTimeout);
        const idx = this._lineListeners.indexOf(lineHandler);
        if (idx !== -1) this._lineListeners.splice(idx, 1);
      };

      const lineHandler = (line) => {
        // Collect the deepest info line
        const info = parseInfoLine(line);
        if (info && info.score) {
          // Only track the deepest evaluation at multipv 1
          if (!info.multipv || info.multipv === 1) {
            if (!lastInfo || info.depth >= lastInfo.depth) {
              lastInfo = info;
            }
          }
        }

        // Check for bestmove
        if (isBestMove(line)) {
          cleanup();
          const bestMoveData = parseBestMove(line);

          if (!lastInfo || !lastInfo.score) {
            // Edge case: got bestmove but no info line (e.g., checkmate in 0)
            resolve({
              bestMove: bestMoveData?.bestmove || null,
              score: { type: "cp", value: 0 },
              depth: searchDepth,
              pv: [],
              nodes: null,
              time: null,
            });
            return;
          }

          resolve({
            bestMove: bestMoveData?.bestmove || lastInfo.pv[0] || null,
            score: lastInfo.score,
            depth: lastInfo.depth || searchDepth,
            pv: lastInfo.pv || [],
            nodes: lastInfo.nodes || null,
            time: lastInfo.time || null,
          });
        }
      };

      this._lineListeners.push(lineHandler);

      // Search timeout safeguard
      searchTimeout = setTimeout(() => {
        cleanup();
        this._sendCommand("stop");

        // Give Stockfish a moment to respond with bestmove after stop
        setTimeout(() => {
          if (lastInfo && lastInfo.score) {
            resolve({
              bestMove: lastInfo.pv[0] || null,
              score: lastInfo.score,
              depth: lastInfo.depth || 0,
              pv: lastInfo.pv || [],
              nodes: lastInfo.nodes || null,
              time: lastInfo.time || null,
            });
          } else {
            reject(
              new Error(
                `Stockfish search timed out after ${this.searchTimeoutMs}ms for FEN: ${fen}`,
              ),
            );
          }
        }, 200);
      }, this.searchTimeoutMs);

      // Send position and go commands
      this._sendCommand(buildPositionCommand(fen));
      this._sendCommand(buildGoCommand(searchDepth));
    });
  }

  /**
   * Gracefully shuts down the Stockfish process.
   * Sends "quit", waits for exit, then escalates to SIGTERM → SIGKILL.
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.isAlive || !this.process) {
      this.isAlive = false;
      this.isReady = false;
      return;
    }

    return new Promise((resolve) => {
      const pid = this.process?.pid;

      const killTimer = setTimeout(() => {
        logger.warn(
          { workerId: this.workerId, pid },
          "Stockfish did not exit after quit. Sending SIGTERM.",
        );
        this.kill("SIGTERM");

        const forceKillTimer = setTimeout(() => {
          logger.error(
            { workerId: this.workerId, pid },
            "Stockfish did not respond to SIGTERM. Sending SIGKILL.",
          );
          this.kill("SIGKILL");
          resolve();
        }, this.killGraceMs);
        forceKillTimer.unref();
      }, this.killGraceMs);
      killTimer.unref();

      this.process.once("exit", () => {
        clearTimeout(killTimer);
        this.isAlive = false;
        this.isReady = false;
        resolve();
      });

      this._sendCommand("quit");
    });
  }

  /**
   * Immediately kills the Stockfish process with the specified signal.
   * Used by the circuit breaker (§10.3) for uncatchable SIGKILL on lease expiry.
   *
   * @param {string} signal - OS signal ('SIGKILL' | 'SIGTERM')
   */
  kill(signal = "SIGKILL") {
    if (this.process && this.isAlive) {
      try {
        this.process.kill(signal);
      } catch (err) {
        logger.warn(
          { workerId: this.workerId, signal, err: err.message },
          "Error killing Stockfish process",
        );
      }
    }
    this.isAlive = false;
    this.isReady = false;
  }

  // ---- Private Methods ----

  /**
   * Sends a raw UCI command to the Stockfish stdin.
   * @param {string} command
   * @private
   */
  _sendCommand(command) {
    if (!this.process || !this.process.stdin.writable) {
      throw new Error("Stockfish stdin is not writable.");
    }
    this.process.stdin.write(command + "\n");
  }

  /**
   * Dispatches a parsed line to all registered line listeners.
   * @param {string} line
   * @private
   */
  _dispatchLine(line) {
    // Copy the array since handlers may remove themselves
    const listeners = [...this._lineListeners];
    for (const handler of listeners) {
      handler(line);
    }
  }

  /**
   * Sends a command and waits for a specific response line.
   * @param {string} command - UCI command to send
   * @param {(line: string) => boolean} predicate - Test function for the expected response
   * @param {number} [timeoutMs] - Timeout in ms
   * @returns {Promise<string>} The matching line
   * @private
   */
  _sendAndWaitFor(command, predicate, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = timeoutMs || this.searchTimeoutMs;
      const timer = setTimeout(() => {
        const idx = this._lineListeners.indexOf(handler);
        if (idx !== -1) this._lineListeners.splice(idx, 1);
        reject(
          new Error(
            `Timeout waiting for response to "${command}" after ${timeout}ms`,
          ),
        );
      }, timeout);

      const handler = (line) => {
        if (predicate(line)) {
          clearTimeout(timer);
          const idx = this._lineListeners.indexOf(handler);
          if (idx !== -1) this._lineListeners.splice(idx, 1);
          resolve(line);
        }
      };

      this._lineListeners.push(handler);
      this._sendCommand(command);
    });
  }

  /**
   * Waits for a specific response line without sending a command.
   * @param {(line: string) => boolean} predicate
   * @param {number} [timeoutMs]
   * @returns {Promise<string>}
   * @private
   */
  _waitForLine(predicate, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = timeoutMs || this.searchTimeoutMs;
      const timer = setTimeout(() => {
        const idx = this._lineListeners.indexOf(handler);
        if (idx !== -1) this._lineListeners.splice(idx, 1);
        reject(new Error(`Timeout waiting for expected line after ${timeout}ms`));
      }, timeout);

      const handler = (line) => {
        if (predicate(line)) {
          clearTimeout(timer);
          const idx = this._lineListeners.indexOf(handler);
          if (idx !== -1) this._lineListeners.splice(idx, 1);
          resolve(line);
        }
      };

      this._lineListeners.push(handler);
    });
  }
}

module.exports = StockfishWorker;
