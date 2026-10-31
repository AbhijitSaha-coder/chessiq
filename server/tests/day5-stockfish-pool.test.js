/**
 * ChessIQ v3.3.0 — Day 5 Stockfish Engine & Worker Pool Unit Tests (@BE)
 *
 * Verifies:
 * 1. UCI Protocol Parser & Line Generators (uciProtocol.js)
 * 2. StockfishWorker Process Lifecycle & Handshake (§11.1)
 * 3. Memory Isolation & Transposition Table Clearing (ucinewgame + Clear Hash) (§11.1)
 * 4. Circuit Breaker Immediate SIGKILL Execution (§10.3, §11.1)
 * 5. StockfishPool Bounded Concurrency, Acquire/Release & Crash Replacement
 */

const EventEmitter = require("events");
const { Readable, Writable } = require("stream");
const {
  parseInfoLine,
  parseBestMove,
  buildPositionCommand,
  buildGoCommand,
  isReadyOk,
  isUciOk,
  isBestMove,
} = require("../src/engine/uciProtocol");
const StockfishWorker = require("../src/engine/stockfishWorker");
const StockfishPool = require("../src/engine/stockfishPool");

// ============================================================================
// Helper: Create a Mock Child Process for Stockfish
// ============================================================================
function createMockStockfishProcess() {
  const proc = new EventEmitter();
  proc.pid = 99999;
  proc.killed = false;

  const stdout = new EventEmitter();
  const stderr = new EventEmitter();

  const commandsReceived = [];

  const stdin = new Writable({
    write(chunk, encoding, callback) {
      const text = chunk.toString().trim();
      const lines = text.split("\n").map((l) => l.trim());

      for (const line of lines) {
        commandsReceived.push(line);

        if (line === "uci") {
          setImmediate(() => {
            stdout.emit("data", Buffer.from("id name Stockfish 16.1 NNUE\nid author the Stockfish developers\nuciok\n"));
          });
        } else if (line === "isready") {
          setImmediate(() => {
            stdout.emit("data", Buffer.from("readyok\n"));
          });
        } else if (line.startsWith("go depth")) {
          setImmediate(() => {
            stdout.emit(
              "data",
              Buffer.from(
                "info depth 14 seldepth 18 score cp 32 nodes 48123 time 120 pv e2e4 e7e5 g1f3\nbestmove e2e4 ponder e7e5\n",
              ),
            );
          });
        } else if (line === "quit") {
          setImmediate(() => {
            proc.emit("exit", 0, null);
          });
        }
      }
      callback();
    },
  });

  proc.stdin = stdin;
  proc.stdout = stdout;
  proc.stderr = stderr;

  proc.kill = jest.fn((signal) => {
    proc.killed = true;
    proc.emit("exit", null, signal || "SIGTERM");
  });

  proc.commandsReceived = commandsReceived;
  return proc;
}

describe("Day 5: Stockfish NNUE Child Process Worker Pool & Memory Isolation (@BE)", () => {
  // ==========================================================================
  // UCI Protocol Parsing
  // ==========================================================================
  describe("UCI Protocol Parser (uciProtocol.js)", () => {
    it("parses centipawn evaluation info line accurately", () => {
      const line = "info depth 14 seldepth 18 multipv 1 score cp 32 nodes 48123 time 120 pv e2e4 e7e5 g1f3";
      const parsed = parseInfoLine(line);

      expect(parsed).not.toBeNull();
      expect(parsed.depth).toBe(14);
      expect(parsed.seldepth).toBe(18);
      expect(parsed.multipv).toBe(1);
      expect(parsed.score).toEqual({ type: "cp", value: 32 });
      expect(parsed.nodes).toBe(48123);
      expect(parsed.time).toBe(120);
      expect(parsed.pv).toEqual(["e2e4", "e7e5", "g1f3"]);
    });

    it("parses forced mate evaluation info line accurately", () => {
      const line = "info depth 12 score mate 3 nodes 25000 time 80 pv e7e8q b1a1 e8e1";
      const parsed = parseInfoLine(line);

      expect(parsed).not.toBeNull();
      expect(parsed.depth).toBe(12);
      expect(parsed.score).toEqual({ type: "mate", value: 3 });
      expect(parsed.pv).toEqual(["e7e8q", "b1a1", "e8e1"]);
    });

    it("parses negative mate evaluation accurately", () => {
      const line = "info depth 8 score mate -2 pv d8d1";
      const parsed = parseInfoLine(line);

      expect(parsed).not.toBeNull();
      expect(parsed.score).toEqual({ type: "mate", value: -2 });
    });

    it("ignores non-evaluation info strings", () => {
      expect(parseInfoLine("info string NNUE evaluation using nn-0000000000a0.nnue")).toBeNull();
      expect(parseInfoLine("id name Stockfish")).toBeNull();
      expect(parseInfoLine("")).toBeNull();
      expect(parseInfoLine(null)).toBeNull();
    });

    it("parses bestmove line with and without ponder", () => {
      const withPonder = parseBestMove("bestmove e2e4 ponder e7e5");
      expect(withPonder).toEqual({ bestmove: "e2e4", ponder: "e7e5" });

      const withoutPonder = parseBestMove("bestmove g1f3");
      expect(withoutPonder).toEqual({ bestmove: "g1f3", ponder: null });

      expect(parseBestMove("info depth 1")).toBeNull();
    });

    it("builds correct UCI position and go commands", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
      expect(buildPositionCommand(fen)).toBe(`position fen ${fen}`);
      expect(buildGoCommand(14)).toBe("go depth 14");
    });

    it("predicate matchers identify UCI tokens", () => {
      expect(isReadyOk("readyok")).toBe(true);
      expect(isReadyOk("readyok\n")).toBe(true);
      expect(isReadyOk("notready")).toBe(false);

      expect(isUciOk("uciok")).toBe(true);
      expect(isUciOk("info")).toBe(false);

      expect(isBestMove("bestmove e2e4")).toBe(true);
      expect(isBestMove("info depth 14")).toBe(false);
    });
  });

  // ==========================================================================
  // StockfishWorker Lifecycle with Mock Process
  // ==========================================================================
  describe("StockfishWorker Process Lifecycle & Memory Isolation", () => {
    let mockChildProcess;

    beforeEach(() => {
      mockChildProcess = createMockStockfishProcess();
      // Spy on child_process.spawn to return our mock
      const cp = require("child_process");
      jest.spyOn(cp, "spawn").mockImplementation(() => mockChildProcess);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("performs complete UCI handshake during initialize()", async () => {
      const worker = new StockfishWorker({
        stockfishPath: "/usr/games/stockfish",
        threads: 2,
        hashMb: 128,
        workerId: "test-worker-1",
      });

      await worker.initialize();

      expect(worker.isReady).toBe(true);
      expect(worker.isAlive).toBe(true);

      // Verify command sequence: uci -> setoption Threads -> setoption Hash -> MultiPV -> isready
      expect(mockChildProcess.commandsReceived).toContain("uci");
      expect(mockChildProcess.commandsReceived).toContain("setoption name Threads value 2");
      expect(mockChildProcess.commandsReceived).toContain("setoption name Hash value 128");
      expect(mockChildProcess.commandsReceived).toContain("setoption name MultiPV value 1");
      expect(mockChildProcess.commandsReceived).toContain("isready");
    });

    it("enforces Memory Isolation via prepareForNewGame() (§11.1)", async () => {
      const worker = new StockfishWorker({
        stockfishPath: "/usr/games/stockfish",
        workerId: "test-worker-isolation",
      });

      await worker.initialize();
      mockChildProcess.commandsReceived.length = 0; // Clear history

      // Prepare for a new game
      await worker.prepareForNewGame();

      // Per §11.1, must execute: ucinewgame -> setoption name Clear Hash -> isready -> readyok
      expect(mockChildProcess.commandsReceived).toEqual([
        "ucinewgame",
        "setoption name Clear Hash",
        "isready",
      ]);
    });

    it("evaluates a position and extracts depth, score, and best move", async () => {
      const worker = new StockfishWorker({
        stockfishPath: "/usr/games/stockfish",
        workerId: "test-worker-eval",
      });

      await worker.initialize();

      const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      const evalResult = await worker.evaluatePosition(fen, 14);

      expect(evalResult).toEqual({
        bestMove: "e2e4",
        score: { type: "cp", value: 32 },
        depth: 14,
        pv: ["e2e4", "e7e5", "g1f3"],
        nodes: 48123,
        time: 120,
      });

      expect(mockChildProcess.commandsReceived).toContain(`position fen ${fen}`);
      expect(mockChildProcess.commandsReceived).toContain("go depth 14");
    });

    it("gracefully shuts down by sending 'quit' command", async () => {
      const worker = new StockfishWorker({
        stockfishPath: "/usr/games/stockfish",
        workerId: "test-worker-shutdown",
      });

      await worker.initialize();
      await worker.shutdown();

      expect(mockChildProcess.commandsReceived).toContain("quit");
      expect(worker.isAlive).toBe(false);
      expect(worker.isReady).toBe(false);
    });

    it("executes immediate SIGKILL for circuit breaker (§10.3)", async () => {
      const worker = new StockfishWorker({
        stockfishPath: "/usr/games/stockfish",
        workerId: "test-worker-breaker",
      });

      await worker.initialize();

      // Trip circuit breaker
      worker.kill("SIGKILL");

      expect(mockChildProcess.kill).toHaveBeenCalledWith("SIGKILL");
      expect(worker.isAlive).toBe(false);
    });
  });

  // ==========================================================================
  // StockfishPool Concurrency & Resource Management
  // ==========================================================================
  describe("StockfishPool Concurrency & Worker Management", () => {
    let mockChildProcesses = [];

    beforeEach(() => {
      mockChildProcesses = [];
      const cp = require("child_process");
      jest.spyOn(cp, "spawn").mockImplementation(() => {
        const proc = createMockStockfishProcess();
        mockChildProcesses.push(proc);
        return proc;
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("acquires and releases workers while maintaining capacity bounds", async () => {
      const pool = new StockfishPool({
        maxWorkers: 2,
        stockfishPath: "/usr/games/stockfish",
      });

      const worker1 = await pool.acquire();
      expect(pool.status()).toEqual({
        active: 1,
        idle: 0,
        waiting: 0,
        total: 1,
        maxWorkers: 2,
      });

      const worker2 = await pool.acquire();
      expect(pool.status().active).toBe(2);
      expect(pool.status().total).toBe(2);

      // Release worker1
      await pool.release(worker1);
      expect(pool.status()).toEqual({
        active: 1,
        idle: 1,
        waiting: 0,
        total: 2,
        maxWorkers: 2,
      });

      // Acquiring again should reuse idle worker1 after clearing hash (§11.1)
      const reused = await pool.acquire();
      expect(reused).toBe(worker1);
      expect(pool.status().active).toBe(2);
      expect(pool.status().idle).toBe(0);

      await pool.shutdown();
    });

    it("queues acquisition requests when pool is at maximum capacity", async () => {
      const pool = new StockfishPool({
        maxWorkers: 1,
        stockfishPath: "/usr/games/stockfish",
      });

      const worker = await pool.acquire();
      expect(pool.status().active).toBe(1);

      // Second acquire should be queued
      let acquiredSecond = false;
      const acquirePromise = pool.acquire().then((w) => {
        acquiredSecond = true;
        return w;
      });

      expect(pool.status().waiting).toBe(1);
      expect(acquiredSecond).toBe(false);

      // Release first worker -> fulfills queued request
      await pool.release(worker);
      const secondWorker = await acquirePromise;

      expect(acquiredSecond).toBe(true);
      expect(secondWorker).toBe(worker);

      await pool.shutdown();
    });

    it("automatically replaces crashed workers on acquire", async () => {
      const pool = new StockfishPool({
        maxWorkers: 1,
        stockfishPath: "/usr/games/stockfish",
      });

      const worker = await pool.acquire();
      await pool.release(worker);

      // Simulate worker crash while in idle pool
      worker.isAlive = false;

      // Next acquire detects dead worker and creates a replacement
      const replacement = await pool.acquire();
      expect(replacement).not.toBe(worker);
      expect(replacement.isAlive).toBe(true);

      await pool.shutdown();
    });

    it("rejects pending acquisition requests upon pool shutdown", async () => {
      const pool = new StockfishPool({
        maxWorkers: 1,
        stockfishPath: "/usr/games/stockfish",
      });

      await pool.acquire(); // Fill pool

      const queuedPromise = pool.acquire(); // Queued
      const expectation = expect(queuedPromise).rejects.toThrow(
        "StockfishPool is shutting down.",
      );
      await pool.shutdown();
      await expectation;
    });
  });
});
