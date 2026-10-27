# ==============================================================================
# ChessIQ v3.3.0 — Multi-Stage Backend & Distributed Stockfish Engine Container
# Target Base: Node.js 20 LTS on Debian Bookworm Slim
# ==============================================================================

# Stage 1: Build & Dependencies
FROM node:20-bookworm-slim AS dependencies

WORKDIR /app

# Install system build tools if necessary
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

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
ENV STOCKFISH_PATH=/usr/games/stockfish

# Copy production node_modules from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

# Ensure non-root ownership and switch to node user
RUN chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "src/index.js"]
