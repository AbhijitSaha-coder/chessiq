# ==============================================================================
# ChessIQ v3.3.0 — Multi-Stage Backend & Distributed Stockfish Engine Container
# Build Context: Monorepo Root (`.`) — e.g. `docker build -f server/Dockerfile .`
# Target Base: Node.js 20 LTS on Debian Bookworm Slim
# ==============================================================================

# Stage 1: Build & Production Workspace Dependencies
FROM node:20-bookworm-slim AS dependencies

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy root workspace manifests + lockfile for deterministic workspace install
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --omit=dev --workspace=server

# ==============================================================================
# Stage 2: Production Runtime
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Install official Stockfish chess engine package and curl for container healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    stockfish \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Verify Stockfish binary exists at /usr/games/stockfish and is executable
RUN ls -la /usr/games/stockfish && \
    chmod 755 /usr/games/stockfish && \
    /usr/games/stockfish compiler

# Set default production environment
ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0
ENV STOCKFISH_PATH=/usr/games/stockfish

# Copy workspace node_modules, backend source, and SHA-256 SQL migrations
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY server/package.json ./server/
COPY server/src/ ./server/src/
COPY db/migrations/ ./db/migrations/

# Ensure non-root ownership and switch to node user
RUN chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Execute SHA-256 verified schema migrations against Neon Serverless, then boot API gateway
CMD ["sh", "-c", "node server/src/db/migrate.js && node server/src/index.js"]
