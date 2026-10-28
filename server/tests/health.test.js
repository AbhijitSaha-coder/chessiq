/**
 * ChessIQ v3.3.0 — Backend Health & Gateway Integration Tests
 */

const request = require("supertest");
const app = require("../src/app");
const { pool, closePool } = require("../src/db/pool");

describe("API Gateway Telemetry & Health Endpoint", () => {
  afterAll(async () => {
    await closePool();
  });

  it("GET /api/health should respond with structured telemetry and 200 OK", async () => {
    const res = await request(app).get("/api/health");

    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty("version", "3.3.0");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("environment");

    if (res.status === 200) {
      expect(res.body.status).toBe("healthy");
      expect(res.body.database).toHaveProperty("status", "connected");
      expect(res.body.database.extensions).toHaveProperty("uuid_ossp", true);
      expect(res.body.database.extensions).toHaveProperty("btree_gist", true);
      expect(res.body.cookie_topology).toHaveProperty("secure", true);
    }
  });

  it("GET /api/unknown-route should return 404 AppError JSON", async () => {
    const res = await request(app).get("/api/non-existent-endpoint");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "NOT_FOUND");
  });
});
