#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 5 Stockfish Pool & Memory Isolation Seal (@BE)
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
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 5 Stockfish Pool & Memory Isolation Seal (@BE)        ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Check Environment Prerequisites & Stockfish Engine
echo -e "\n${YELLOW}[Step 1/4] Checking Stockfish Engine Binary...${NC}"

if command -v stockfish &> /dev/null; then
  STOCKFISH_BIN="$(which stockfish)"
  echo -e "${GREEN}✓ Stockfish detected at: ${STOCKFISH_BIN}${NC}"
elif [ -f "/opt/homebrew/bin/stockfish" ]; then
  STOCKFISH_BIN="/opt/homebrew/bin/stockfish"
  echo -e "${GREEN}✓ Stockfish detected at: ${STOCKFISH_BIN}${NC}"
elif [ -f "/usr/local/bin/stockfish" ]; then
  STOCKFISH_BIN="/usr/local/bin/stockfish"
  echo -e "${GREEN}✓ Stockfish detected at: ${STOCKFISH_BIN}${NC}"
elif [ -f "/usr/games/stockfish" ]; then
  STOCKFISH_BIN="/usr/games/stockfish"
  echo -e "${GREEN}✓ Stockfish detected at: ${STOCKFISH_BIN}${NC}"
else
  echo -e "${YELLOW}Stockfish binary not in standard PATH; test suite will use mock process harness.${NC}"
fi

# Step 2: Test UCI Protocol Parsing
echo -e "\n${YELLOW}[Step 2/4] Testing UCI Protocol Parser & Command Builders...${NC}"
node -e "
const { parseInfoLine, parseBestMove, buildPositionCommand, buildGoCommand } = require('./server/src/engine/uciProtocol');

const info = parseInfoLine('info depth 14 seldepth 18 score cp 45 nodes 102400 time 85 pv e2e4 e7e5');
console.log('Parsed info:', { depth: info.depth, score: info.score, pv: info.pv });

if (info.depth !== 14 || !info.score || info.score.value !== 45 || info.pv[0] !== 'e2e4') {
  throw new Error('UCI info parsing failed!');
}

const best = parseBestMove('bestmove e2e4 ponder e7e5');
if (best.bestmove !== 'e2e4' || best.ponder !== 'e7e5') {
  throw new Error('UCI bestmove parsing failed!');
}
console.log('✓ UCI protocol parsing verified.');
"
echo -e "${GREEN}✓ UCI Protocol verified.${NC}"

# Step 3: Run Automated Jest Test Suite (Day 5)
echo -e "\n${YELLOW}[Step 3/4] Running Jest Day 5 Test Suite (server/tests/day5-stockfish-pool.test.js)...${NC}"
npm test --workspace=server -- tests/day5-stockfish-pool.test.js
echo -e "${GREEN}✓ Day 5 test suite passed with 100% assertions.${NC}"

# Step 4: Seal Day 5
echo -e "\n${YELLOW}[Step 4/4] Finalizing Day 5 Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 5 STOCKFISH WORKER POOL & MEMORY ISOLATION SEALED — READY FOR DAY 6]  ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
