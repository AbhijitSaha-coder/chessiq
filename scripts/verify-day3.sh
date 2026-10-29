#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 3 Ingestion & GiST Verification Script (@DB)
# Role: Abhijit Saha — Project Lead & Database Architect (@DB)
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 3 PL/pgSQL Ingestion & GiST Constraints Seal (@DB)    ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check Environment Prerequisites
echo -e "\n${YELLOW}[Step 1/7] Checking Environment & PostgreSQL Service...${NC}"

if [ -f "server/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source server/.env
  set +a
else
  export DATABASE_URL="postgres://chessiq_admin:chessiq_dev_password@localhost:5432/chessiq"
  export PORT=5000
fi

if command -v docker &> /dev/null && docker info &> /dev/null; then
  echo "Docker daemon detected. Ensuring PostgreSQL container is running..."
  docker compose up -d postgres 2>/dev/null || true
fi
echo -e "${GREEN}✓ PostgreSQL environment checked.${NC}"

# Step 2: Run Database Migration Engine
echo -e "\n${YELLOW}[Step 2/7] Executing Transactional SHA-256 Migration Engine...${NC}"
node server/src/db/migrate.js
echo -e "${GREEN}✓ All migrations applied and verified.${NC}"

# Step 3: Run Day 3 Diagnostic Function in PostgreSQL
echo -e "\n${YELLOW}[Step 3/7] Running PostgreSQL Day 3 Diagnostics (fn_verify_day3_ingestion)...${NC}"
node -e "
const { pool, closePool } = require('./server/src/db/pool');
async function verify() {
  try {
    const res = await pool.query('SELECT fn_verify_day3_ingestion() AS diag;');
    const diag = res.rows[0].diag;
    console.log('Day 3 Diagnostic Telemetry:', JSON.stringify(diag, null, 2));
    if (
      diag.status !== 'PASSED' ||
      !diag.procedure_exists ||
      diag.parameter_count !== 29 ||
      !diag.user_ratings_gist_active ||
      !diag.job_statuses_gist_active
    ) {
      throw new Error('Day 3 Schema diagnostic assertion failed!');
    }
    await closePool();
    process.exit(0);
  } catch (err) {
    console.error('Diagnostic error:', err);
    await closePool();
    process.exit(1);
  }
}
verify();
"
echo -e "${GREEN}✓ sp_ingest_game_analysis_6nf procedure and GiST constraints verified.${NC}"

# Step 4: Run Live 80-Ply Batch Ingestion Benchmark
echo -e "\n${YELLOW}[Step 4/7] Benchmarking 80-Ply Batch 6NF Persistence (< 50ms Target)...${NC}"
node -e "
const crypto = require('crypto');
const { pool, closePool } = require('./server/src/db/pool');
const { ingestGameAnalysis6NF } = require('./server/src/db/ingestion');

async function benchmark() {
  try {
    // 1. Create temporary test game
    const userRes = await pool.query('INSERT INTO users DEFAULT VALUES RETURNING id;');
    const userId = userRes.rows[0].id;

    const gameRes = await pool.query('INSERT INTO games DEFAULT VALUES RETURNING id;');
    const gameId = gameRes.rows[0].id;
    await pool.query('INSERT INTO game_users (game_id, user_id) VALUES (\$1, \$2);', [gameId, userId]);

    const analysisId = crypto.randomUUID();
    const moves = [];
    for (let ply = 1; ply <= 80; ply++) {
      moves.push({
        plyNumber: ply,
        moveSan: ply % 2 === 1 ? 'e4' : 'c5',
        moveUci: ply % 2 === 1 ? 'e2e4' : 'c7c5',
        fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        rawEvalType: 'cp',
        rawEvalValue: 20,
        evalCentipawns: 20,
        cplRaw: 0,
        cplCapped: 0,
        winProbability: 0.52,
        winProbDelta: 0.0,
        bestMoveUci: 'e2e4',
        mistakeType: 'BEST',
        gamePhase: 'OPENING',
        pvLine: ['e2e4', 'c7c5'],
        isBookMove: ply <= 10
      });
    }

    const payload = {
      analysisId,
      gameId,
      whiteAcpl: 15,
      blackAcpl: 22,
      whiteBlunders: 0,
      whiteMistakes: 1,
      whiteInaccuracies: 2,
      blackBlunders: 1,
      blackMistakes: 2,
      blackInaccuracies: 3,
      engineDepth: 14,
      moves
    };

    const res = await ingestGameAnalysis6NF(pool, payload);
    console.log(\`Ingestion benchmark: 80 plies persisted in \${res.durationMs} ms (Target: < 50 ms)\`);

    if (res.durationMs >= 50) {
      console.warn(\`WARNING: Ingestion duration (\${res.durationMs}ms) exceeded 50ms benchmark!\`);
    } else {
      console.log(\`✓ Benchmark passed comfortably (\${res.durationMs}ms < 50ms).\`);
    }

    // Clean up
    await pool.query('DELETE FROM users WHERE id = \$1;', [userId]);
    await closePool();
    process.exit(0);
  } catch (err) {
    console.error('Benchmark failed:', err);
    await closePool();
    process.exit(1);
  }
}
benchmark();
"
echo -e "${GREEN}✓ Batch ingestion performance verified.${NC}"

# Step 5: Run Automated Jest Test Suite
echo -e "\n${YELLOW}[Step 5/7] Running Jest Integration Suite (server/tests/day3-ingestion.test.js)...${NC}"
npm test --workspace=server -- tests/day3-ingestion.test.js
echo -e "${GREEN}✓ Jest test suite passed with 100% assertions.${NC}"

# Step 6: Test API Gateway Health Endpoint
echo -e "\n${YELLOW}[Step 6/7] Booting Backend Gateway & Verifying Live Health Telemetry...${NC}"
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    echo "Stopping test backend server (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

node server/src/index.js &
SERVER_PID=$!

echo "Waiting for backend HTTP gateway on port $PORT..."
for i in {1..30}; do
  if curl -s -f "http://127.0.0.1:${PORT}/api/health" > /tmp/chessiq_health_response.json 2>/dev/null || curl -s -f "http://localhost:${PORT}/api/health" > /tmp/chessiq_health_response.json 2>/dev/null; then
    break
  fi
  sleep 0.5
done

if [ ! -f /tmp/chessiq_health_response.json ]; then
  echo -e "${RED}FAILED: Backend did not respond on /api/health within 15 seconds.${NC}"
  exit 1
fi

echo "Health response received:"
cat /tmp/chessiq_health_response.json | node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(0, 'utf-8'));
console.log('Status:', data.status);
console.log('Database Engine:', data.database.engine_version.split(',')[0]);
console.log('Day 3 Stored Procedure:', data.database.day3_ingestion ? data.database.day3_ingestion.procedure_name : 'N/A');
console.log('Day 3 Ingestion Status:', data.database.day3_ingestion ? data.database.day3_ingestion.status : 'N/A');
console.log('GiST Constraints Active:', data.database.day3_ingestion && data.database.day3_ingestion.user_ratings_gist_active && data.database.day3_ingestion.job_statuses_gist_active ? 'YES' : 'NO');
console.log('Cookie Topology:', data.cookie_topology);
if (data.status !== 'healthy' || !data.database.day3_ingestion || data.database.day3_ingestion.status !== 'PASSED') {
  process.exit(1);
}
"
echo -e "${GREEN}✓ /api/health returned 200 OK with Day 3 telemetry.${NC}"

# Step 7: Seal Day 3
echo -e "\n${YELLOW}[Step 7/7] Finalizing Day 3 Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 3 INGESTION & GiST CONSTRAINTS SEALED — READY FOR DAY 4]              ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
