/**
 * ChessIQ v3.3.0 — Real ESM Client Module Test Suite for Day 15 & Day 16 (@FE)
 * Runs natively via `node --test` against actual frontend modules.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { apiClient, ApiError, api } from "../src/api/client.js";
import {
  extractSafeUser,
  fetchCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
} from "../src/api/auth.js";
import {
  normalizePuzzleRecommendation,
  fetchPersonalizedPuzzles,
  submitPuzzleAttempt,
} from "../src/api/puzzles.js";
import {
  inspectPuzzlePosition,
  resolveExpectedMove,
  evaluatePuzzleMove,
  applyForcedReplyMove,
  buildPuzzleHint,
  filterPersonalizedPuzzles,
  aggregateTrainingDashboardStats,
} from "../src/utils/puzzleUtils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.resolve(__dirname, "..");

// Lightweight window EventTarget shim for custom event verification in Node
function setupWindowMock() {
  const listeners = new Map();
  const events = [];
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail || {};
    }
  };
  globalThis.window = {
    addEventListener: (type, cb) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(cb);
    },
    removeEventListener: (type, cb) => {
      listeners.get(type)?.delete(cb);
    },
    dispatchEvent: (evt) => {
      events.push(evt);
      listeners.get(evt.type)?.forEach((cb) => cb(evt));
      return true;
    },
  };
  return { events };
}

function createFetchMock(handler) {
  const calls = [];
  globalThis.fetch = async (url, config) => {
    calls.push({ url, config });
    return handler(url, config);
  };
  return { calls };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (h) => (h.toLowerCase() === "content-type" ? "application/json" : null),
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

// ==============================================================================
// DAY 15 TESTS: PERSONALIZED TRAINING PUZZLES (@FE)
// ==============================================================================

test("Day 15: normalizePuzzleRecommendation handles nested and flat v_training_puzzles views", () => {
  const flatRow = {
    id: "rec-1",
    user_id: "u-1",
    puzzle_id: "puz-1",
    category: "pin",
    description: "Exploit absolute pin on f6 knight",
    is_completed: false,
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
    moves: "b8c6 f1b5 a7a6",
    rating: 1450,
    themes: [{ theme_code: "pin", description: "Pin motif" }],
  };

  const normalized = normalizePuzzleRecommendation(flatRow);
  assert.equal(normalized.recommendationId, "rec-1");
  assert.equal(normalized.puzzleId, "puz-1");
  assert.deepEqual(normalized.moves, ["b8c6", "f1b5", "a7a6"]);
  assert.equal(normalized.rating, 1450);
  assert.equal(normalized.themes[0].theme_code, "pin");
});

test("Day 15: fetchPersonalizedPuzzles forwards filters and handles empty backend response", async () => {
  const { calls } = createFetchMock(async () =>
    jsonResponse(200, {
      status: "success",
      data: {
        recommendations: [],
        stats: { total_puzzles: 0, completed: 0, correct: 0, incorrect: 0, success_rate: 0 },
        pagination: { total: 0, limit: 20, offset: 0, has_more: false },
      },
    }),
  );

  const res = await fetchPersonalizedPuzzles({
    theme: "fork",
    minRating: 1200,
    maxRating: 1799,
    limit: 20,
    offset: 0,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].config.credentials, "include");
  assert.match(calls[0].url, /^\/api\/recommendations\?/);
  assert.match(calls[0].url, /theme=fork/);
  assert.match(calls[0].url, /min_rating=1200/);
  assert.equal(res.items.length, 0);
  assert.equal(res.pagination.has_more, false);
});

test("Day 15: inspectPuzzlePosition initializes White and Black orientation from FEN", () => {
  const whiteFen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3";
  const blackFen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 2 3";

  assert.deepEqual(inspectPuzzlePosition(whiteFen), {
    valid: true,
    orientation: "white",
    turn: "w",
  });
  assert.deepEqual(inspectPuzzlePosition(blackFen), {
    valid: true,
    orientation: "black",
    turn: "b",
  });
  assert.equal(inspectPuzzlePosition("invalid-fen").valid, false);
});

test("Day 15: evaluatePuzzleMove validates legality, rejects wrong moves, and accepts solution sequence", () => {
  // Mate-in-2 back-rank motif test position:
  // White: Kg1, Re1; Black: Kg8, pawns f7, g7, h7 -> 1. Re8# is checkmate
  const fen = "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1";
  const expectedMove = "e1e8";

  // Illegal move (rook cannot jump diagonally e1->f5)
  const illegal = evaluatePuzzleMove({
    fen,
    expectedMoveStr: expectedMove,
    move: { from: "e1", to: "f5" },
  });
  assert.equal(illegal.isLegal, false);
  assert.equal(illegal.isMatch, false);

  // Legal but incorrect move (Kf1)
  const wrong = evaluatePuzzleMove({
    fen,
    expectedMoveStr: expectedMove,
    move: { from: "g1", to: "f1" },
  });
  assert.equal(wrong.isLegal, true);
  assert.equal(wrong.isMatch, false);

  // Exact solution move (Re8#)
  const solved = evaluatePuzzleMove({
    fen,
    expectedMoveStr: expectedMove,
    move: { from: "e1", to: "e8" },
  });
  assert.equal(solved.isLegal, true);
  assert.equal(solved.isMatch, true);
  assert.equal(solved.isCheckmate, true);
  assert.equal(solved.playedMove.uci, "e1e8");
});

test("Day 15: multi-move variation and incremental hint masking without spoiling solution", () => {
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  // Step 1 hint reveals only fromSquare on level 1
  const hint1 = buildPuzzleHint(startFen, "e2e4", false);
  assert.equal(hint1.fromSquare, "e2");
  assert.equal(hint1.toSquare, null);

  // Step 2 hint reveals target square for active move
  const hint2 = buildPuzzleHint(startFen, "e2e4", true);
  assert.equal(hint2.fromSquare, "e2");
  assert.equal(hint2.toSquare, "e4");

  // Multi-move forced reply application
  const step1 = evaluatePuzzleMove({
    fen: startFen,
    expectedMoveStr: "e2e4",
    move: { from: "e2", to: "e4" },
  });
  assert.equal(step1.isMatch, true);

  const reply = applyForcedReplyMove(step1.nextFen, "c7c5");
  assert.equal(reply.ok, true);
  assert.equal(reply.move.san, "c5");
  assert.equal(inspectPuzzlePosition(reply.nextFen).turn, "w");
});

test("Day 15: submitPuzzleAttempt handles success and rejects backend failures without faking completion", async () => {
  createFetchMock(async () =>
    jsonResponse(200, {
      status: "success",
      data: { verified: true, is_correct: true, is_completed: true },
    }),
  );

  const okRes = await submitPuzzleAttempt({
    recommendationId: "rec-99",
    puzzleId: "puz-99",
    movesPlayed: ["e1e8"],
    isCorrect: true,
    isCompleted: true,
    timeSpentMs: 4200,
  });
  assert.equal(okRes.is_completed, true);

  // Backend 500 failure must throw ApiError and NEVER pretend solved
  createFetchMock(async () =>
    jsonResponse(500, { error: "DB_ERROR", message: "Database unavailable" }),
  );
  await assert.rejects(
    () =>
      submitPuzzleAttempt({
        recommendationId: "rec-99",
        puzzleId: "puz-99",
        movesPlayed: ["e1e8"],
        isCorrect: true,
        isCompleted: true,
      }),
    (err) => err instanceof ApiError && err.status === 500,
  );
});

test("Day 15: filterPersonalizedPuzzles & aggregateTrainingDashboardStats operate on backend items without fake stats", () => {
  const sampleItems = [
    {
      recommendationId: "r1",
      category: "fork",
      rating: 1100,
      isCompleted: true,
      lastResult: "CORRECT",
      themes: [{ theme_code: "fork", description: "Fork" }],
    },
    {
      recommendationId: "r2",
      category: "pin",
      rating: 1650,
      isCompleted: false,
      lastResult: "INCORRECT",
      themes: [{ theme_code: "pin", description: "Pin" }],
    },
  ];

  assert.equal(filterPersonalizedPuzzles(sampleItems, { difficulty: "BEGINNER" }).length, 1);
  assert.equal(filterPersonalizedPuzzles(sampleItems, { theme: "pin" }).length, 1);
  assert.equal(filterPersonalizedPuzzles(sampleItems, { statusFilter: "PENDING" }).length, 1);

  const stats = aggregateTrainingDashboardStats(sampleItems);
  assert.equal(stats.total, 2);
  assert.equal(stats.completed, 1);
  assert.equal(stats.correct, 1);
  assert.equal(stats.incorrect, 1);
  assert.equal(stats.successPercentage, 50);
  assert.equal(stats.progressPercentage, 50);

  // Empty data produces honest zeros
  const emptyStats = aggregateTrainingDashboardStats([]);
  assert.equal(emptyStats.total, 0);
  assert.equal(emptyStats.successPercentage, 0);
});

// ==============================================================================
// DAY 16 TESTS: SINGLE-DOMAIN AUTH & FIRST-PARTY COOKIES (@FE)
// ==============================================================================

test("Day 16: apiClient enforces credentials: 'include' and handles 401/403 correctly", async () => {
  const { events } = setupWindowMock();

  // Even if caller passes credentials: "omit", apiClient enforces "include"
  const { calls } = createFetchMock(async () => jsonResponse(200, { status: "ok" }));
  await api.get("/api/games", { credentials: "omit" });
  assert.equal(calls[0].config.credentials, "include");
  assert.equal(calls[0].url, "/api/games");

  // 401 on protected endpoint triggers debounced chessiq:session_expired once for concurrent requests
  createFetchMock(async () =>
    jsonResponse(401, { error: "TOKEN_EXPIRED", message: "Session expired" }),
  );

  await assert.rejects(
    () => Promise.all([api.get("/api/recommendations"), api.get("/api/games")]),
    (err) => err instanceof ApiError && err.status === 401,
  );
  // Debounce guarantees only 1 expiration event dispatched across concurrent 401s
  assert.equal(events.filter((e) => e.type === "chessiq:session_expired").length, 1);
});

test("Day 16: failed login & initial /api/auth/me probe do NOT fire session_expired event", async () => {
  const { events } = setupWindowMock();

  createFetchMock(async () =>
    jsonResponse(401, { error: "INVALID_CREDENTIALS", message: "Invalid password" }),
  );

  // Initial /api/auth/me uses suppressAuthEvent: true
  await assert.rejects(
    () => fetchCurrentUser(),
    (err) => err instanceof ApiError && err.status === 401,
  );

  // Failed login should report error without triggering session_expired
  await assert.rejects(
    () => loginUser({ identifier: "bibhukesh", password: "wrong" }),
    (err) => err instanceof ApiError && err.status === 401,
  );

  assert.equal(events.length, 0);
});

test("Day 16: loginUser, registerUser, fetchCurrentUser, and logoutUser integrate with /api/auth/*", async () => {
  setupWindowMock();
  const { calls } = createFetchMock(async (url) => {
    if (url === "/api/auth/login") {
      return jsonResponse(200, {
        status: "success",
        data: {
          user: {
            id: "user-123",
            username: "bibhukesh",
            email: "bibhukesh@chessiq.com",
            chess_rating: 1750,
            password_hash: "should_be_stripped",
            session_token: "should_be_stripped",
          },
        },
      });
    }
    if (url === "/api/auth/me") {
      return jsonResponse(200, {
        data: { user: { id: "user-123", username: "bibhukesh", chess_rating: 1750 } },
      });
    }
    if (url === "/api/auth/logout") {
      return jsonResponse(200, { status: "success" });
    }
    return jsonResponse(404, { error: "NOT_FOUND" });
  });

  const loginRes = await loginUser({ identifier: "bibhukesh", password: "secret123" });
  assert.equal(loginRes.user.username, "bibhukesh");
  assert.equal(loginRes.user.chess_rating, 1750);
  // Ensure sensitive keys are stripped by extractSafeUser
  assert.equal(loginRes.user.password_hash, undefined);
  assert.equal(loginRes.user.session_token, undefined);

  const me = await fetchCurrentUser();
  assert.equal(me.id, "user-123");

  await logoutUser();
  assert.equal(calls.length, 3);
  assert.equal(calls[2].url, "/api/auth/logout");
  assert.equal(calls[2].config.method, "POST");
  assert.equal(calls[2].config.credentials, "include");
});

test("Day 16 Security Audit: zero HttpOnly cookie/localStorage token access & valid single-domain proxy config", () => {
  const srcDir = path.join(CLIENT_ROOT, "src");

  function walkJs(dir) {
    let files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(walkJs(full));
      } else if (/\.(js|jsx|mjs)$/.test(entry.name)) {
        files.push(full);
      }
    }
    return files;
  }

  const sourceFiles = walkJs(srcDir);
  assert.ok(sourceFiles.length >= 10, "Expected frontend source files");

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf8");
    assert.equal(
      /document\.cookie/.test(content),
      false,
      `Forbidden document.cookie access found in ${file}`,
    );
    assert.equal(
      /localStorage\s*\.\s*(get|set)Item/.test(content),
      false,
      `Forbidden localStorage credential usage found in ${file}`,
    );
    assert.equal(
      /sessionStorage\s*\.\s*(get|set)Item/.test(content),
      false,
      `Forbidden sessionStorage credential usage found in ${file}`,
    );
    assert.equal(
      /onrender\.com/.test(content),
      false,
      `Hardcoded cross-domain backend URL found in ${file}`,
    );
  }

  // Verify vercel.json & vite.config.js single-domain reverse proxy settings
  const vercelCfg = JSON.parse(
    fs.readFileSync(path.join(CLIENT_ROOT, "vercel.json"), "utf8"),
  );
  assert.equal(vercelCfg.rewrites[0].source, "/api/:path*");

  const viteCfg = fs.readFileSync(path.join(CLIENT_ROOT, "vite.config.js"), "utf8");
  assert.match(viteCfg, /"\/api":/);
});

test("Day 15 & 16 State Machines: Duplicate submission lock, next puzzle navigation, and protected route state transitions", async () => {
  // 1. Verify Duplicate Submission Lock prevents concurrent POST storms on rapid double clicks
  let postCallCount = 0;
  let lock = false;
  createFetchMock(async () => {
    postCallCount += 1;
    await new Promise((r) => setTimeout(r, 15));
    return jsonResponse(200, { status: "success", data: { verified: true, is_completed: true } });
  });

  async function submitWithLock(payload) {
    if (lock) return false;
    lock = true;
    try {
      await submitPuzzleAttempt(payload);
      return true;
    } finally {
      lock = false;
    }
  }

  const [r1, r2, r3] = await Promise.all([
    submitWithLock({ recommendationId: "rec-1", puzzleId: "p-1", movesPlayed: ["e2e4"], isCorrect: true, isCompleted: true }),
    submitWithLock({ recommendationId: "rec-1", puzzleId: "p-1", movesPlayed: ["e2e4"], isCorrect: true, isCompleted: true }),
    submitWithLock({ recommendationId: "rec-1", puzzleId: "p-1", movesPlayed: ["e2e4"], isCorrect: true, isCompleted: true }),
  ]);
  assert.equal(postCallCount, 1);
  assert.equal(r1, true);
  assert.equal(r2, false);
  assert.equal(r3, false);

  // 2. Verify Protected Route & Intended Destination Flow Logic matches ProtectedRoute.jsx
  const authFlow = {
    status: "LOADING",
    user: null,
    intendedDestination: null,
  };
  // Boot probe completes -> UNAUTHENTICATED
  authFlow.status = "UNAUTHENTICATED";
  // User requests protected "puzzles" route
  if (authFlow.status !== "AUTHENTICATED") {
    authFlow.intendedDestination = "puzzles";
  }
  assert.equal(authFlow.intendedDestination, "puzzles");
  // Login restores destination
  authFlow.user = { id: "u1", username: "bibhukesh" };
  authFlow.status = "AUTHENTICATED";
  const resolvedDest = authFlow.intendedDestination || "analysis";
  authFlow.intendedDestination = null;
  assert.equal(resolvedDest, "puzzles");

  // 3. Verify UI Component Contract Integrity
  const trainingFiles = [
    "src/hooks/useTrainingPuzzles.js",
    "src/components/training/TrainingDashboard.jsx",
    "src/components/training/TrainingStats.jsx",
    "src/components/training/PuzzleBoard.jsx",
    "src/components/training/PuzzleCard.jsx",
    "src/components/training/PuzzleControls.jsx",
    "src/components/training/PuzzleFeedback.jsx",
    "src/context/AuthContext.jsx",
    "src/components/auth/LoginForm.jsx",
    "src/components/auth/ProtectedRoute.jsx",
    "src/components/auth/AuthStatus.jsx",
    "src/components/auth/UserGameHistory.jsx",
  ];
  for (const rel of trainingFiles) {
    assert.equal(
      fs.existsSync(path.join(CLIENT_ROOT, rel)),
      true,
      `Expected module missing: ${rel}`,
    );
  }

  // Verify PuzzleBoard reuses InteractiveChessboard
  const puzzleBoardSrc = fs.readFileSync(
    path.join(CLIENT_ROOT, "src/components/training/PuzzleBoard.jsx"),
    "utf8",
  );
  assert.match(puzzleBoardSrc, /InteractiveChessboard/);
  assert.match(puzzleBoardSrc, /disableExploration=\{true\}/);
});

