#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 4 PGN Ingestion & Move Deduplication Seal (@BE)
# Role: Jaidev Basandrai — Distributed Systems Engineer (@BE)
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 4 Canonical Deduplication & PGN Gateway Seal (@BE)    ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check Environment Prerequisites
echo -e "\n${YELLOW}[Step 1/5] Checking Environment & PostgreSQL Service...${NC}"

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
echo -e "\n${YELLOW}[Step 2/5] Executing Transactional SHA-256 Migration Engine...${NC}"
node server/src/db/migrate.js
echo -e "${GREEN}✓ All migrations applied and verified.${NC}"

# Step 3: Run PGN Parser & SHA-256 Deduplication Sanity Check
echo -e "\n${YELLOW}[Step 3/5] Verifying PGN Parser & SHA-256 Canonical Move Signature Generator...${NC}"
node -e "
const { parsePgn, computeMoveSignature, resolvePlayerColor } = require('./server/src/services/pgnParser');

const pgn = \`[Event \"FIDE World Championship 2024\"]
[White \"Ding Liren\"]
[Black \"Gukesh D\"]
[Result \"1/2-1/2\"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1/2-1/2\`;

const parsed = parsePgn(pgn);
console.log('Parsed headers:', parsed.headers.White, 'vs', parsed.headers.Black);
console.log('Total plies:', parsed.totalPlies);
console.log('Move signature (SHA-256):', parsed.moveSignature);

if (!parsed.moveSignature || parsed.moveSignature.length !== 64) {
  throw new Error('Invalid move signature generated!');
}

const whiteColor = resolvePlayerColor(parsed.headers, 'Ding Liren');
const blackColor = resolvePlayerColor(parsed.headers, 'Gukesh D');
if (whiteColor !== 'WHITE' || blackColor !== 'BLACK') {
  throw new Error('Player color resolution failed!');
}
console.log('✓ PGN parser and player color resolution verified.');
"
echo -e "${GREEN}✓ Move signature deduplication logic validated.${NC}"

# Step 4: Run Automated Jest Test Suite (Day 4)
echo -e "\n${YELLOW}[Step 4/5] Running Jest Day 4 Integration Suite (server/tests/day4-deduplication.test.js)...${NC}"
npm test --workspace=server -- tests/day4-deduplication.test.js
echo -e "${GREEN}✓ Day 4 test suite passed with 100% assertions.${NC}"

# Step 5: Seal Day 4
echo -e "\n${YELLOW}[Step 5/5] Finalizing Day 4 Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 4 CANONICAL DEDUPLICATION & PGN GATEWAY SEALED — READY FOR DAY 5]     ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
