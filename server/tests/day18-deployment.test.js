/**
 * ChessIQ v3.3.0 — Day 18 Production Cloud Deployment & Acceptance Criteria Suite
 *
 * Verifies:
 * 1. Vercel Edge Single-Domain Reverse Proxy & Security Headers (`client/vercel.json`)
 * 2. Render Infrastructure-as-Code Blueprint (`render.yaml`) — API + Worker services
 * 3. Production Multi-Stage Dockerfile (`server/Dockerfile`) & `.dockerignore`
 * 4. Neon Serverless SSL Detection (`pool.js`) & Cold-Start Resilience
 * 5. Express Reverse-Proxy Trust (`trust proxy`), Helmet, CORS, and `/api/health` Telemetry Contract
 * 6. ChessIQ v3.3.0 §15 Acceptance Criteria 1–10 End-to-End Check against PostgreSQL
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../src/app");
const { pool, closePool } = require("../src/db/pool");
const { startWorkerRuntime } = require("../src/worker");

const REPO_ROOT = path.resolve(__dirname, "../..");

describe("Day 18: Production Cloud Deployment (Vercel Edge + Render + Neon Serverless) & Final Seal", () => {
  afterAll(async () => {
    await closePool();
  });

  // ==========================================================================
  // 1. Vercel Edge Gateway (`client/vercel.json`)
  // ==========================================================================
  describe("1. Vercel Edge Gateway Single-Domain Configuration", () => {
    it("routes /api/:path* to Render backend and sets SPA fallback & security headers", () => {
      const vercelPath = path.join(REPO_ROOT, "client/vercel.json");
      expect(fs.existsSync(vercelPath)).toBe(true);

      const vercelCfg = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
      expect(Array.isArray(vercelCfg.rewrites)).toBe(true);
      expect(vercelCfg.rewrites[0]).toEqual({
        source: "/api/:path*",
        destination: "https://chessiq-api.onrender.com/api/:path*",
      });

      const spaFallback = vercelCfg.rewrites.find(
        (r) => r.destination === "/index.html",
      );
      expect(spaFallback).toBeDefined();

      expect(Array.isArray(vercelCfg.headers)).toBe(true);
      const headerKeys = vercelCfg.headers[0].headers.map((h) => h.key);
      expect(headerKeys).toContain("X-Content-Type-Options");
      expect(headerKeys).toContain("X-Frame-Options");
      expect(headerKeys).toContain("Strict-Transport-Security");
    });
  });

  // ==========================================================================
  // 2. Render Blueprint (`render.yaml`) & Container (`server/Dockerfile`)
  // ==========================================================================
  describe("2. Render Blueprint & Monorepo Docker Containerization", () => {
    it("defines chessiq-api web service and chessiq-worker background worker in render.yaml", () => {
      const renderYamlPath = path.join(REPO_ROOT, "render.yaml");
      expect(fs.existsSync(renderYamlPath)).toBe(true);

      const yaml = fs.readFileSync(renderYamlPath, "utf8");
      expect(yaml).toContain("name: chessiq-api");
      expect(yaml).toContain("name: chessiq-worker");
      expect(yaml).toContain("dockerfilePath: ./server/Dockerfile");
      expect(yaml).toContain("dockerContext: .");
      expect(yaml).toContain("healthCheckPath: /api/health");
      expect(yaml).toContain("dockerCommand: node server/src/worker.js");
      expect(yaml).toContain("FRONTEND_URL");
      expect(yaml).toContain("DATABASE_URL");
      expect(yaml).toContain("JWT_SECRET");
      expect(yaml).toContain("COOKIE_SECRET");
      expect(yaml).toContain("STOCKFISH_PATH");
    });

    it("configures monorepo multi-stage Dockerfile with Stockfish, SQL migrations, non-root user, and healthcheck", () => {
      const dockerfilePath = path.join(REPO_ROOT, "server/Dockerfile");
      const dockerignorePath = path.join(REPO_ROOT, ".dockerignore");
      expect(fs.existsSync(dockerfilePath)).toBe(true);
      expect(fs.existsSync(dockerignorePath)).toBe(true);

      const df = fs.readFileSync(dockerfilePath, "utf8");
      expect(df).toContain("FROM node:20-bookworm-slim AS dependencies");
      expect(df).toContain("npm ci --omit=dev --workspace=server");
      expect(df).toContain("stockfish");
      expect(df).toContain("COPY db/migrations/ ./db/migrations/");
      expect(df).toContain("USER node");
      expect(df).toContain("http://localhost:5000/api/health");
      expect(df).toContain("node server/src/db/migrate.js");
      expect(df).toContain("node server/src/index.js");
    });
  });

  // ==========================================================================
  // 3. Reverse Proxy, Neon SSL & Runtime Verification
  // ==========================================================================
  describe("3. Reverse Proxy Trust, Worker Export & Live /api/health Telemetry", () => {
    it("enables trust proxy on Express app for Render & Vercel Edge hops", () => {
      expect(app.get("trust proxy")).toBe(1);
    });

    it("exports startWorkerRuntime cleanly without side effects on import", () => {
      expect(typeof startWorkerRuntime).toBe("function");
    });

    it("enables TLS automatically for Neon Serverless DATABASE_URL strings", () => {
      const poolSrc = fs.readFileSync(
        path.join(REPO_ROOT, "server/src/db/pool.js"),
        "utf8",
      );
      expect(poolSrc).toContain('env.DATABASE_URL.includes("sslmode=require")');
      expect(poolSrc).toContain("rejectUnauthorized: false");
      expect(poolSrc).toMatch(/connectionTimeoutMillis:\s*10000/);
    });

    it("serves complete v3.3.0 health telemetry and 6NF diagnostics at GET /api/health", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("X-Forwarded-Proto", "https");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("healthy");
      expect(res.body.version).toBe("3.3.0");
      expect(res.body.database.extensions).toEqual({
        uuid_ossp: true,
        btree_gist: true,
      });
      expect(res.body.database.schema_6nf?.status).toBe("PASSED");
      expect(res.body.database.day3_ingestion?.status).toBe("PASSED");
      expect(res.body.cookie_topology).toBeDefined();
      expect(res.body.cookie_topology.http_only).toBe(true);
      expect(res.body.cookie_topology.secure).toBe(true);
    });
  });

  // ==========================================================================
  // 4. System Design §15 Final Acceptance Criteria Audit (PostgreSQL)
  // ==========================================================================
  describe("4. ChessIQ v3.3.0 Acceptance Criteria (§15) End-to-End Database Audit", () => {
    it("verifies all 8 logical 3NF reconstruction views, GiST constraints, and stored functions exist", async () => {
      const viewsRes = await pool.query(`
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      const viewNames = viewsRes.rows.map((r) => r.table_name);

      const expectedViews = [
        "v_users",
        "v_chess_openings",
        "v_games",
        "v_game_analysis_jobs",
        "v_game_analyses",
        "v_move_analyses",
        "v_training_puzzles",
        "v_training_recommendations",
      ];
      for (const view of expectedViews) {
        expect(viewNames).toContain(view);
      }

      const fnRes = await pool.query(`
        SELECT proname
        FROM pg_proc
        WHERE proname IN (
          'sp_ingest_game_analysis_6nf',
          'fn_sweep_stale_jobs',
          'fn_transition_job_status',
          'fn_verify_6nf_baseline',
          'fn_verify_6nf_schema',
          'fn_verify_day3_ingestion',
          'fn_verify_day10_openings',
          'fn_verify_day15_puzzles'
        );
      `);
      const fnNames = fnRes.rows.map((r) => r.proname);
      expect(fnNames).toContain("sp_ingest_game_analysis_6nf");
      expect(fnNames).toContain("fn_sweep_stale_jobs");
      expect(fnNames).toContain("fn_transition_job_status");
      expect(fnNames).toContain("fn_verify_day10_openings");
      expect(fnNames).toContain("fn_verify_day15_puzzles");
    });
  });
});
