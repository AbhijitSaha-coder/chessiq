/**
 * ChessIQ v3.3.0 — PGN Ingestion Gateway & Game Upload API Route
 * Day 4 (@BE): POST /api/games/upload
 *
 * Handles parameterized PGN upload, canonical SHA-256 move deduplication via
 * user_game_move_signatures, game record insertion across 6NF tables, and
 * analysis job enqueuing with FIFO queue semantics.
 */

const express = require("express");
const crypto = require("crypto");
const { parsePgn, resolvePlayerColor } = require("../services/pgnParser");
const { pool, query, withTransaction } = require("../db/pool");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");

const router = express.Router();

/**
 * POST /api/games/upload
 *
 * Request Body:
 * {
 *   "pgn": "<PGN text>",
 *   "user_color": "WHITE" | "BLACK" (optional),
 *   "account_handle": "<chess.com/lichess handle>" (optional)
 * }
 *
 * Response: 201 Created with game_id, job_id, and move_signature
 * Errors: 400 (invalid PGN), 409 (duplicate game), 422 (ambiguous player)
 */
router.post("/upload", async (req, res, next) => {
  try {
    const { pgn, user_color, account_handle } = req.body;

    // --- Validation ---
    if (!pgn || typeof pgn !== "string" || pgn.trim().length === 0) {
      throw AppError.validationError(
        "PGN is required. Please provide a valid PGN game string.",
        { field: "pgn" },
      );
    }

    // --- PGN Parsing & Move Extraction ---
    let parsed;
    try {
      parsed = parsePgn(pgn);
    } catch (parseErr) {
      throw AppError.validationError(
        `Invalid PGN: ${parseErr.message}`,
        { field: "pgn" },
      );
    }

    const { headers, moves, totalPlies, moveSignature, rawPgn } = parsed;

    // --- Player Color Resolution ---
    // NOTE: Auth is not implemented yet (Day 16). For now, we use a temporary
    // user resolution: if the request has req.user (from auth middleware),
    // use it. Otherwise, require user_color or account_handle explicitly,
    // or fall back to a dev user for testing.
    const userId = req.user?.id || null;
    const username = req.user?.username || "";

    let resolvedColor;
    try {
      if (user_color) {
        // Explicit override — no username matching needed
        const normalized = user_color.toUpperCase().trim();
        if (normalized !== "WHITE" && normalized !== "BLACK") {
          throw new Error(
            `Invalid user_color: "${user_color}". Must be 'WHITE' or 'BLACK'.`,
          );
        }
        resolvedColor = normalized;
      } else if (account_handle) {
        // Match account_handle against PGN headers
        resolvedColor = resolvePlayerColor(
          headers,
          username || account_handle,
          null,
          account_handle,
        );
      } else if (username) {
        // Match authenticated username against PGN headers
        resolvedColor = resolvePlayerColor(headers, username);
      } else {
        // No auth, no color, no handle — default to WHITE for dev/testing
        resolvedColor = "WHITE";
        logger.warn(
          "No authenticated user or user_color provided. Defaulting to WHITE. " +
            "This will be enforced once authentication (Day 16) is implemented.",
        );
      }
    } catch (colorErr) {
      throw AppError.ambiguousPlayerIdentity(colorErr.message);
    }

    // --- Transaction: Deduplicate, Insert Game, Enqueue Job ---
    const result = await withTransaction(async (client) => {
      // Step 1: Canonical Move Deduplication (FR-02)
      // Check user_game_move_signatures for duplicate
      if (userId) {
        const dedupResult = await client.query(
          `INSERT INTO user_game_move_signatures (user_id, move_signature)
           VALUES ($1, $2)
           ON CONFLICT (user_id, move_signature) DO NOTHING
           RETURNING user_id;`,
          [userId, moveSignature],
        );

        if (dedupResult.rowCount === 0) {
          // Duplicate detected — find existing game_id for the error response
          const existingGame = await client.query(
            `SELECT gms.game_id
             FROM game_move_signatures gms
             INNER JOIN game_users gu ON gu.game_id = gms.game_id
             WHERE gu.user_id = $1 AND gms.move_signature = $2
             LIMIT 1;`,
            [userId, moveSignature],
          );

          const existingGameId = existingGame.rows[0]?.game_id || null;
          throw AppError.duplicateGame(existingGameId);
        }
      }

      // Step 2: Create Game Anchor
      const gameResult = await client.query(
        "INSERT INTO games (id) VALUES (uuid_generate_v4()) RETURNING id;",
      );
      const gameId = gameResult.rows[0].id;

      // Step 3: Insert into 6NF game attribute tables
      const gameInserts = [
        // game_users (links game to authenticated user)
        userId
          ? client.query(
              "INSERT INTO game_users (game_id, user_id) VALUES ($1, $2);",
              [gameId, userId],
            )
          : Promise.resolve(),
        // game_white_players
        client.query(
          "INSERT INTO game_white_players (game_id, white_player) VALUES ($1, $2);",
          [gameId, headers.White || "Unknown"],
        ),
        // game_black_players
        client.query(
          "INSERT INTO game_black_players (game_id, black_player) VALUES ($1, $2);",
          [gameId, headers.Black || "Unknown"],
        ),
        // game_results
        client.query(
          "INSERT INTO game_results (game_id, result) VALUES ($1, $2);",
          [gameId, headers.Result || "*"],
        ),
        // game_user_colors
        client.query(
          "INSERT INTO game_user_colors (game_id, user_color) VALUES ($1, $2);",
          [gameId, resolvedColor],
        ),
        // game_pgn_raws
        client.query(
          "INSERT INTO game_pgn_raws (game_id, pgn_raw) VALUES ($1, $2);",
          [gameId, rawPgn],
        ),
        // game_move_signatures
        client.query(
          "INSERT INTO game_move_signatures (game_id, move_signature) VALUES ($1, $2);",
          [gameId, moveSignature],
        ),
        // game_played_at
        client.query(
          "INSERT INTO game_played_at (game_id, played_at) VALUES ($1, $2);",
          [
            gameId,
            headers.Date
              ? new Date(headers.Date.replace(/\./g, "-"))
              : new Date(),
          ],
        ),
        // game_created_at
        client.query(
          "INSERT INTO game_created_at (game_id, created_at) VALUES ($1, CURRENT_TIMESTAMP);",
          [gameId],
        ),
      ];

      // Optional: White Elo
      if (headers.WhiteElo && parseInt(headers.WhiteElo, 10) > 0) {
        gameInserts.push(
          client.query(
            "INSERT INTO game_white_elos (game_id, white_elo) VALUES ($1, $2);",
            [gameId, parseInt(headers.WhiteElo, 10)],
          ),
        );
      }

      // Optional: Black Elo
      if (headers.BlackElo && parseInt(headers.BlackElo, 10) > 0) {
        gameInserts.push(
          client.query(
            "INSERT INTO game_black_elos (game_id, black_elo) VALUES ($1, $2);",
            [gameId, parseInt(headers.BlackElo, 10)],
          ),
        );
      }

      // Optional: ECO code
      if (headers.ECO) {
        // Only insert if the ECO code exists in the opening catalog
        const ecoCheck = await client.query(
          "SELECT eco_code FROM chess_openings WHERE eco_code = $1;",
          [headers.ECO],
        );
        if (ecoCheck.rows.length > 0) {
          gameInserts.push(
            client.query(
              "INSERT INTO game_ecos (game_id, eco_code) VALUES ($1, $2);",
              [gameId, headers.ECO],
            ),
          );
        }
      }

      await Promise.all(gameInserts);

      // Step 4: Enqueue Analysis Job (FIFO Queue)
      const jobResult = await client.query(
        "INSERT INTO game_analysis_jobs (id) VALUES (uuid_generate_v4()) RETURNING id;",
      );
      const jobId = jobResult.rows[0].id;

      await Promise.all([
        // Link job to game
        client.query(
          "INSERT INTO job_games (job_id, game_id) VALUES ($1, $2);",
          [jobId, gameId],
        ),
        // Set initial status to 'pending' with open temporal interval
        client.query(
          `INSERT INTO job_statuses (job_id, status, valid_during)
           VALUES ($1, 'pending', tstzrange(CURRENT_TIMESTAMP, NULL, '[)'));`,
          [jobId],
        ),
        // Set total plies for progress tracking
        client.query(
          "INSERT INTO job_total_plies (job_id, total_plies) VALUES ($1, $2);",
          [jobId, totalPlies],
        ),
        // Set max retries (default 3)
        client.query(
          "INSERT INTO job_max_retries (job_id, max_retries) VALUES ($1, 3);",
          [jobId],
        ),
        // Set creation timestamp (FIFO ordering key)
        client.query(
          "INSERT INTO job_created_at (job_id, created_at) VALUES ($1, CURRENT_TIMESTAMP);",
          [jobId],
        ),
        // Set update timestamp
        client.query(
          "INSERT INTO job_updated_at (job_id, updated_at) VALUES ($1, CURRENT_TIMESTAMP);",
          [jobId],
        ),
      ]);

      logger.info(
        {
          gameId,
          jobId,
          totalPlies,
          moveSignature: moveSignature.slice(0, 12) + "...",
          userColor: resolvedColor,
        },
        "Game ingested and analysis job enqueued successfully",
      );

      return {
        game_id: gameId,
        job_id: jobId,
        total_plies: totalPlies,
        move_signature: moveSignature,
        user_color: resolvedColor,
        white_player: headers.White || "Unknown",
        black_player: headers.Black || "Unknown",
        result: headers.Result || "*",
      };
    });

    return res.status(201).json({
      status: "created",
      message: "Game uploaded and analysis job enqueued.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
