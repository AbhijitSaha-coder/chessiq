#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 2 6NF DDL & 3NF Reconstruction Views Verification Script
# Role: Abhijit Saha — Project Lead & Database Architect (@DB)
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 2 6NF DDL & 3NF Views Architecture Verification (@DB)   ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check Environment Prerequisites
echo -e "\n${YELLOW}[Step 1/6] Checking Environment & PostgreSQL Service...${NC}"

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
  docker compose up -d postgres
  until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-chessiq_admin}" -d "${POSTGRES_DB:-chessiq}" > /dev/null 2>&1; do
    sleep 1
  done
  echo -e "${GREEN}✓ PostgreSQL container is healthy and ready.${NC}"
else
  echo "Testing connection to PostgreSQL on port 5432..."
fi

# Step 2: Run Database Migration Engine
echo -e "\n${YELLOW}[Step 2/6] Executing Transactional SHA-256 Migration Engine...${NC}"
node server/src/db/migrate.js
echo -e "${GREEN}✓ All migrations applied and verified.${NC}"

# Step 3: Run Diagnostic Functions in PostgreSQL
echo -e "\n${YELLOW}[Step 3/6] Running PostgreSQL 6NF Diagnostics (fn_verify_6nf_schema)...${NC}"
node -e "
const { pool, closePool } = require('./server/src/db/pool');
async function verify() {
  try {
    const res = await pool.query('SELECT fn_verify_6nf_schema() AS diag;');
    const diag = res.rows[0].diag;
    console.log('6NF Diagnostic Telemetry:', JSON.stringify(diag, null, 2));
    if (diag.status !== 'PASSED' || !diag.all_expected_views_present || !diag.user_ratings_gist_active || !diag.job_statuses_gist_active) {
      throw new Error('6NF Schema diagnostic assertion failed!');
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
echo -e "${GREEN}✓ 6NF physical tables, GiST temporal constraints, and 3NF views verified.${NC}"

# Step 4: Run Automated Jest Test Suite
echo -e "\n${YELLOW}[Step 4/6] Running Jest Integration Suite (server/tests/day2-schema.test.js)...${NC}"
npm test --workspace=server
echo -e "${GREEN}✓ Jest test suite passed with 100% assertions.${NC}"

# Step 5: Test API Gateway Health Endpoint
echo -e "\n${YELLOW}[Step 5/6] Booting Backend Gateway & Verifying Live Health Telemetry...${NC}"
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
console.log('6NF Tables:', data.database.schema_6nf ? data.database.schema_6nf.total_6nf_tables : 'N/A');
console.log('3NF Views:', data.database.schema_6nf ? data.database.schema_6nf.total_3nf_views : 'N/A');
console.log('Cookie Topology:', data.cookie_topology);
if (data.status !== 'healthy') {
  process.exit(1);
}
"
echo -e "${GREEN}✓ /api/health returned 200 OK.${NC}"

# Step 6: Seal Day 2
echo -e "\n${YELLOW}[Step 6/6] Finalizing Day 2 Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 2 6NF DDL & 3NF RECONSTRUCTION VIEWS SEALED — READY FOR DAY 3]        ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
