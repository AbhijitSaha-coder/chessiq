/**
 * ChessIQ v3.3.0 — Personalized Training Puzzle & Recommendations Service (@DB)
 * Day 15 (@DB/@FE): Implements database routines for:
 *
 * 1. Querying 3NF reconstruction view v_training_puzzles with theme & rating filters
 * 2. Generating personalized puzzles tailored to user blunder weaknesses (fn_generate_personalized_puzzles)
 * 3. Extracting in-game blunders into 6NF training puzzles (fn_extract_blunder_puzzle_from_game)
 * 4. Persisting and retrieving recommendations via v_training_recommendations
 */

const { pool: defaultPool } = require("./pool");
const logger = require("../utils/logger");

/**
 * Retrieves catalog puzzles from v_training_puzzles with optional filters.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} [dbPool]
 * @param {Object} [options]
 * @param {string} [options.theme] - Filter by tactical theme (e.g. 'fork', 'pin', 'backRankMate')
 * @param {number} [options.minRating] - Minimum puzzle rating
 * @param {number} [options.maxRating] - Maximum puzzle rating
 * @param {number} [options.limit=20] - Result limit
 * @param {number} [options.offset=0] - Pagination offset
 * @returns {Promise<Array<Object>>}
 */
async function getPuzzleCatalog(dbPool = defaultPool, options = {}) {
  const {
    theme = null,
    minRating = 400,
    maxRating = 3200,
    limit = 20,
    offset = 0,
  } = options;

  try {
    const params = [minRating, maxRating, limit, offset];
    let queryText = `
      SELECT id, fen, moves, rating, created_at, themes
      FROM v_training_puzzles
      WHERE rating >= $1 AND rating <= $2
    `;

    if (theme && theme.trim() !== "") {
      params.push(theme.trim());
      queryText += ` AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(themes) t
        WHERE t->>'theme_code' = $${params.length}
      )`;
    }

    queryText += ` ORDER BY rating ASC, created_at DESC LIMIT $3 OFFSET $4;`;

    const res = await dbPool.query(queryText, params);
    return res.rows;
  } catch (err) {
    logger.error({ err: err.message }, "Error fetching puzzle catalog");
    throw err;
  }
}

/**
 * Retrieves a single puzzle by ID.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} [dbPool]
 * @param {string} puzzleId - UUID of the puzzle
 * @returns {Promise<Object | null>}
 */
async function getPuzzleById(dbPool = defaultPool, puzzleId) {
  try {
    const res = await dbPool.query(
      `SELECT id, fen, moves, rating, created_at, themes
       FROM v_training_puzzles
       WHERE id = $1 LIMIT 1;`,
      [puzzleId],
    );
    return res.rows[0] || null;
  } catch (err) {
    logger.error({ err: err.message, puzzleId }, "Error fetching puzzle by ID");
    throw err;
  }
}

/**
 * Retrieves personalized puzzles for a given user based on historical blunders and active rating.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} [dbPool]
 * @param {string} userId - UUID of user
 * @param {number} [limit=5] - Number of personalized puzzles to return
 * @returns {Promise<Array<Object>>}
 */
async function getPersonalizedPuzzles(dbPool = defaultPool, userId, limit = 5) {
  try {
    const res = await dbPool.query(
      `SELECT puzzle_id, fen, moves, rating, created_at, themes, match_reason
       FROM fn_generate_personalized_puzzles($1::uuid, $2::int);`,
      [userId, limit],
    );
    return res.rows;
  } catch (err) {
    logger.error(
      { err: err.message, userId },
      "Error generating personalized puzzles",
    );
    throw err;
  }
}

/**
 * Converts an in-game blunder into a persistent 6NF training puzzle.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} [dbPool]
 * @param {string} analysisId - UUID of game analysis
 * @param {number} plyNumber - Ply number where mistake occurred
 * @param {string} [themeCode='hangingPiece'] - Tactical theme code
 * @returns {Promise<string>} Created puzzle UUID
 */
async function createPuzzleFromBlunder(
  dbPool = defaultPool,
  analysisId,
  plyNumber,
  themeCode = "hangingPiece",
) {
  try {
    const res = await dbPool.query(
      `SELECT fn_extract_blunder_puzzle_from_game($1::uuid, $2::int, $3::varchar) AS puzzle_id;`,
      [analysisId, plyNumber, themeCode],
    );
    return res.rows[0]?.puzzle_id;
  } catch (err) {
    logger.error(
      { err: err.message, analysisId, plyNumber },
      "Error extracting puzzle from game blunder",
    );
    throw err;
  }
}

/**
 * Generates and stores personalized training recommendations for a user.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} [dbPool]
 * @param {string} userId - UUID of user
 * @param {number} [limit=3] - Number of recommendations to generate
 * @returns {Promise<Array<Object>>} Newly created recommendations
 */
async function generateUserRecommendations(
  dbPool = defaultPool,
  userId,
  limit = 3,
) {
  try {
    await dbPool.query(
      `CALL sp_generate_user_training_recommendations($1::uuid, $2::int);`,
      [userId, limit],
    );
    return await getUserRecommendations(dbPool, userId);
  } catch (err) {
    logger.error(
      { err: err.message, userId },
      "Error generating user recommendations",
    );
    throw err;
  }
}

/**
 * Retrieves persisted recommendations for a user via v_training_recommendations.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} [dbPool]
 * @param {string} userId - UUID of user
 * @returns {Promise<Array<Object>>}
 */
async function getUserRecommendations(dbPool = defaultPool, userId) {
  try {
    const res = await dbPool.query(
      `SELECT r.id, r.user_id, r.puzzle_id, r.category, r.description,
              r.metric_evidence, r.is_completed, r.created_at,
              p.fen, p.moves, p.rating, p.themes
       FROM v_training_recommendations r
       LEFT JOIN v_training_puzzles p ON r.puzzle_id = p.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20;`,
      [userId],
    );
    return res.rows;
  } catch (err) {
    logger.error(
      { err: err.message, userId },
      "Error fetching user recommendations",
    );
    throw err;
  }
}

/**
 * Retrieves all tactical theme types from puzzle_theme_types.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} [dbPool]
 * @returns {Promise<Array<{ theme_code: string, description: string }>>}
 */
async function getPuzzleThemes(dbPool = defaultPool) {
  try {
    const res = await dbPool.query(
      `SELECT theme_code, description FROM puzzle_theme_types ORDER BY theme_code ASC;`,
    );
    return res.rows;
  } catch (err) {
    logger.error({ err: err.message }, "Error fetching puzzle themes");
    throw err;
  }
}

/**
 * Executes the Day 15 diagnostic verification function on PostgreSQL.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} [dbPool]
 * @returns {Promise<Object>}
 */
async function verifyDay15Puzzles(dbPool = defaultPool) {
  try {
    const res = await dbPool.query(
      `SELECT fn_verify_day15_puzzles() as diagnostic;`,
    );
    return res.rows[0]?.diagnostic;
  } catch (err) {
    logger.error({ err: err.message }, "Error verifying Day 15 puzzles");
    throw err;
  }
}

/**
 * Validates and records a training puzzle attempt, persisting completion state
 * in recommendation_completion_states and attempt telemetry in recommendation_metrics.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} [dbPool]
 * @param {Object} payload
 */
async function recordPuzzleAttempt(dbPool = defaultPool, payload = {}) {
  const {
    recommendationId = null,
    puzzleId = null,
    movesPlayed = [],
    isCorrect = false,
    isCompleted = false,
    timeSpentMs = 0,
    usedHint = false,
  } = payload;

  let resolvedPuzzleId = puzzleId;

  if (recommendationId && !resolvedPuzzleId) {
    const recRes = await dbPool.query(
      `SELECT puzzle_id FROM recommendation_puzzles WHERE recommendation_id = $1;`,
      [recommendationId],
    );
    resolvedPuzzleId = recRes.rows[0]?.puzzle_id || null;
  }

  let expectedMoves = [];
  if (resolvedPuzzleId) {
    const puzzleRes = await dbPool.query(
      `SELECT id, moves FROM v_training_puzzles WHERE id = $1;`,
      [resolvedPuzzleId],
    );
    if (puzzleRes.rows[0]?.moves) {
      expectedMoves = Array.isArray(puzzleRes.rows[0].moves)
        ? puzzleRes.rows[0].moves
        : [];
    }
  }

  // Verify submitted moves match either full sequence or player-only replies (odd indices)
  let movesMatch = true;
  if (expectedMoves.length > 0 && Array.isArray(movesPlayed) && movesPlayed.length > 0) {
    const matchesSequential = movesPlayed.every(
      (mv, idx) => expectedMoves[idx] === mv,
    );
    const matchesPlayerReplies = movesPlayed.every(
      (mv, idx) => expectedMoves[idx * 2 + 1] === mv,
    );
    movesMatch = matchesSequential || matchesPlayerReplies;
  }

  const verified = Boolean(isCorrect) && movesMatch;
  const completed = verified && Boolean(isCompleted);

  if (recommendationId) {
    await dbPool.query(
      `INSERT INTO recommendation_completion_states (recommendation_id, is_completed)
       VALUES ($1, $2)
       ON CONFLICT (recommendation_id)
       DO UPDATE SET is_completed = recommendation_completion_states.is_completed OR EXCLUDED.is_completed;`,
      [recommendationId, completed],
    );

    await dbPool.query(
      `UPDATE recommendation_metrics
       SET metric_evidence = COALESCE(metric_evidence, '{}'::jsonb) || jsonb_build_object(
         'attempts_count', COALESCE((metric_evidence->>'attempts_count')::INT, 0) + 1,
         'last_result', $2::TEXT,
         'last_time_spent_ms', $3::INT,
         'used_hint', $4::BOOLEAN,
         'last_attempt_at', CURRENT_TIMESTAMP
       )
       WHERE recommendation_id = $1;`,
      [
        recommendationId,
        verified ? "CORRECT" : "INCORRECT",
        Math.max(0, Math.round(Number(timeSpentMs) || 0)),
        Boolean(usedHint),
      ],
    );
  }

  return {
    verified,
    is_correct: verified,
    is_completed: completed,
    recommendation_id: recommendationId,
    puzzle_id: resolvedPuzzleId,
    message: completed
      ? "Excellent! Solution verified and recorded to your training progression."
      : verified
        ? "Move verified."
        : "Incorrect continuation. Try again.",
  };
}

module.exports = {
  getPuzzleCatalog,
  getPuzzleById,
  getPersonalizedPuzzles,
  createPuzzleFromBlunder,
  generateUserRecommendations,
  getUserRecommendations,
  getPuzzleThemes,
  verifyDay15Puzzles,
  recordPuzzleAttempt,
};
