#!/usr/bin/env bash
# ==============================================================================
# ChessIQ v3.3.0 — Day 18 Production Cloud Deployment & Final Platform Seal
# Target Topology: Vercel Edge + Render Docker (API & Worker) + Neon Serverless
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}   ChessIQ v3.3.0 — Day 18 Production Cloud Deployment & Final Seal          ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Verify All 8 SHA-256 Database Migrations & 6NF/GiST/3NF Diagnostics
echo -e "\n${YELLOW}[Step 1/5] Verifying All PostgreSQL Migrations & 6NF Diagnostics...${NC}"
npm run migrate
echo -e "${GREEN}✓ All 8 migrations (000–007) verified with SHA-256 checksums.${NC}"

# Step 2: Run Day 18 Cloud Deployment & §15 Acceptance Criteria Test Suite
echo -e "\n${YELLOW}[Step 2/5] Running Day 18 Cloud Deployment & §15 Acceptance Criteria Suite...${NC}"
npm test --workspace=server -- tests/day18-deployment.test.js
echo -e "${GREEN}✓ Vercel Edge, Render Blueprint, Dockerfile, Neon SSL & §15 checks passed.${NC}"

# Step 3: Run Full Backend CI Regression Suite (All 17 Suites + Coverage)
echo -e "\n${YELLOW}[Step 3/5] Running Full Monorepo Backend CI Suite...${NC}"
CI=true npm run test:ci --workspace=server
echo -e "${GREEN}✓ All backend unit, integration, auth, OAuth2, and chaos stress tests passed.${NC}"

# Step 4: Run Frontend Native ESM Suite, Vite Production Build & Prettier Format Check
echo -e "\n${YELLOW}[Step 4/5] Running Frontend ESM Suite, Production Bundle Build & Style Audit...${NC}"
npm test --workspace=client
npm run build --workspace=client
npm run format:check
echo -e "${GREEN}✓ Frontend tests, Vite production bundle, and Prettier code style verified clean.${NC}"

# Step 5: Final Platform v3.3.0 Production Seal
echo -e "\n${YELLOW}[Step 5/5] Issuing Final ChessIQ v3.3.0 Production Deployment Seal...${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   [DAY 18 PRODUCTION CLOUD DEPLOYMENT SEALED — CHESSIQ v3.3.0 COMPLETE]     ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
