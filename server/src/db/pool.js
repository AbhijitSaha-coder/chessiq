/**
 * ChessIQ v3.3.0 — Enterprise Database Connection Pool & Transaction Manager
 * Supports PostgreSQL 16 local Docker and Neon Serverless PostgreSQL.
 * Exports slow-query logging, transactional helper, and dedicated LISTEN client factory.
 */

const { Pool, Client } = require('pg');
const env = require('../config/env');
const logger = require('../utils/logger');

// Detect SSL requirement from DATABASE_URL or NODE_ENV
const requiresSsl =
  env.DATABASE_URL.includes('sslmode=require') ||
  env.DATABASE_URL.includes('ssl=true') ||
  (env.NODE_ENV === 'production' && !env.DATABASE_URL.includes('localhost'));

const poolConfig = {
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(poolConfig);

// Pool lifecycle diagnostics
pool.on('connect', (client) => {
  logger.debug({ totalCount: pool.totalCount, idleCount: pool.idleCount }, 'Database pool client connected');
});

pool.on('error', (err, client) => {
  logger.error({ err }, 'Unexpected database client error on idle pool connection');
});

/**
 * Execute parameterized query with automatic slow-query detection (>200ms)
 * @param {string} text - SQL query string
 * @param {Array<any>} [params] - Query parameter bindings
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 200) {
      logger.warn(
        {
          duration_ms: duration,
          rowCount: result.rowCount,
          query: text.replace(/\s+/g, ' ').trim().slice(0, 200),
        },
        'Slow query detected (>200ms)'
      );
    } else {
      logger.trace(
        { duration_ms: duration, rowCount: result.rowCount },
        'Executed database query'
      );
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(
      {
        duration_ms: duration,
        error: error.message,
        query: text.replace(/\s+/g, ' ').trim().slice(0, 200),
      },
      'Database query execution failed'
    );
    throw error;
  }
}

/**
 * Execute callback inside an ACID transaction with guaranteed client.release()
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn - Transaction callback
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  const start = Date.now();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error({ err: rollbackErr }, 'Failed to rollback transaction');
    }
    throw error;
  } finally {
    client.release();
    const duration = Date.now() - start;
    logger.trace({ duration_ms: duration }, 'Transaction completed and client released');
  }
}

/**
 * Provisions a dedicated, unpooled pg.Client for LISTEN/NOTIFY with exponential reconnect & jitter.
 * @param {string} channel - The PostgreSQL channel name (default: 'new_analysis_job')
 * @param {(payload: string) => void} onNotification - Callback invoked when a notification arrives
 * @returns {Promise<{ client: import('pg').Client, close: () => Promise<void> }>}
 */
async function createListenClient(channel = 'new_analysis_job', onNotification = () => {}) {
  let isClosed = false;
  let attempt = 0;
  let client = null;

  async function connectWithBackoff() {
    while (!isClosed) {
      try {
        client = new Client({
          connectionString: env.DATABASE_URL,
          ssl: requiresSsl ? { rejectUnauthorized: false } : false,
          statement_timeout: 0, // Infinite timeout for long-lived listener
        });

        client.on('notification', (msg) => {
          if (msg.channel === channel) {
            onNotification(msg.payload);
          }
        });

        client.on('error', (err) => {
          logger.error({ err }, `Listen client error on channel "${channel}"`);
          if (!isClosed) {
            scheduleReconnect();
          }
        });

        client.on('end', () => {
          logger.warn(`Listen client connection ended for channel "${channel}"`);
          if (!isClosed) {
            scheduleReconnect();
          }
        });

        await client.connect();
        await client.query(`LISTEN ${channel}`);
        logger.info(`Dedicated LISTEN client connected to channel "${channel}"`);
        attempt = 0;
        return;
      } catch (err) {
        attempt++;
        const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
        const jitter = Math.floor(Math.random() * 1000);
        const delay = baseDelay + jitter;

        logger.warn(
          { attempt, delay_ms: delay, error: err.message },
          `Failed to connect LISTEN client. Reconnecting in ${delay}ms...`
        );

        if (client) {
          try {
            await client.end();
          } catch (_) {}
        }

        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  function scheduleReconnect() {
    connectWithBackoff().catch((err) => {
      logger.error({ err }, 'Error during LISTEN client reconnect loop');
    });
  }

  await connectWithBackoff();

  return {
    get client() {
      return client;
    },
    async close() {
      isClosed = true;
      if (client) {
        try {
          await client.query(`UNLISTEN ${channel}`);
          await client.end();
          logger.info(`Dedicated LISTEN client disconnected from channel "${channel}"`);
        } catch (err) {
          logger.warn({ err }, 'Error closing LISTEN client');
        }
      }
    },
  };
}

/**
 * Drain and terminate connection pool gracefully
 */
async function closePool() {
  logger.info('Draining database connection pool...');
  await pool.end();
  logger.info('Database connection pool drained successfully.');
}

module.exports = {
  pool,
  query,
  withTransaction,
  createListenClient,
  closePool,
};
