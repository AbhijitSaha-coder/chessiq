#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 1 Monorepo Baseline Verification & Seal Script
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 1 Industry-Grade Monorepo Baseline Verification       ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check Environment Prerequisites
echo -e "\n${YELLOW}[Step 1/5] Checking Environment & PostgreSQL Service...${NC}"

if [ -f "server/.env" ]; then
  # Source server environment safely
  set -a
  # shellcheck source=/dev/null
  source server/.env
  set +a
else
  export DATABASE_URL="postgres://chessiq_admin:chessiq_dev_password@localhost:5432/chessiq"
  export PORT=5000
fi

# Determine if Docker Postgres container should be started or if local PostgreSQL is active
if command -v docker &> /dev/null && docker info &> /dev/null; then
  echo "Docker daemon detected. Ensuring PostgreSQL 16 container is running..."
  docker compose up -d postgres
  echo "Waiting for PostgreSQL container health check..."
  until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-chessiq_admin}" -d "${POSTGRES_DB:-chessiq}" > /dev/null 2>&1; do
    sleep 1
  done
  echo -e "${GREEN}✓ PostgreSQL container is healthy and ready.${NC}"
else
  echo "Docker daemon not running or not found. Testing connection to PostgreSQL on port 5432..."
fi

# Step 2: Run Database Migration Engine
echo -e "\n${YELLOW}[Step 2/5] Running Transactional SHA-256 Migration Engine (@DB)...${NC}"
node server/src/db/migrate.js
echo -e "${GREEN}✓ Migration engine executed successfully.${NC}"

# Step 3: Assert 6NF Extensions in pg_extension & Verify Diagnostic
echo -e "\n${YELLOW}[Step 3/5] Verifying PostgreSQL 6NF Extensions (uuid-ossp & btree_gist)...${NC}"
node -e "
const { pool, closePool } = require('./server/src/db/pool');
async function test() {
  try {
    const res = await pool.query(\"SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'btree_gist') ORDER BY extname;\");
    const exts = res.rows.map(r => r.extname);
    console.log('Installed extensions:', exts);
    if (!exts.includes('uuid-ossp') || !exts.includes('btree_gist')) {
      throw new Error('Mandatory 6NF extensions missing!');
    }
    const diag = await pool.query(\"SELECT fn_verify_6nf_baseline() AS res;\");
    console.log('Diagnostic result:', JSON.stringify(diag.rows[0].res, null, 2));
    await closePool();
    process.exit(0);
  } catch (err) {
    console.error('Extension verification failed:', err);
    await closePool();
    process.exit(1);
  }
}
test();
"
echo -e "${GREEN}✓ uuid-ossp and btree_gist confirmed active in PostgreSQL.${NC}"

# Step 4: Boot API Gateway & Verify Health Telemetry
echo -e "\n${YELLOW}[Step 4/5] Booting Backend Gateway & Querying GET /api/health (@BE)...${NC}"
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    echo "Stopping test backend server (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Start server in background
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
console.log('6NF Extensions:', data.database.extensions);
console.log('Cookie Topology:', data.cookie_topology);
if (data.status !== 'healthy' || !data.database.extensions.uuid_ossp || !data.database.extensions.btree_gist) {
  process.exit(1);
}
"
echo -e "${GREEN}✓ /api/health returned 200 OK with verified 6NF telemetry.${NC}"

# Step 5: Seal Day 1 Baseline
echo -e "\n${YELLOW}[Step 5/5] Finalizing Day 1 Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 1 BASELINE SEALED — READY FOR DAY 2: 6NF DDL & RECONSTRUCTION VIEWS]   ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
