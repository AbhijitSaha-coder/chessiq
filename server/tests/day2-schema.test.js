/**
 * ChessIQ v3.3.0 — Day 2 Integration Test Suite (@DB)
 * Validates 6NF Master Relational Schema, GiST Temporal Exclusion Constraints,
 * Lossless 3NF View Reconstructions, and Reactive LISTEN/NOTIFY Trigger.
 */

const { pool, closePool } = require("../src/db/pool");

describe("Day 2: 6NF Master Relational DDL & 3NF Reconstruction Views (@DB)", () => {
  afterAll(async () => {
    await closePool();
  });

  describe("6NF Physical Schema Integrity", () => {
    it("executes fn_verify_6nf_schema diagnostic and asserts PASSED status", async () => {
      const { rows } = await pool.query(
        "SELECT fn_verify_6nf_schema() AS diagnostic;",
      );
      const diag = rows[0]?.diagnostic;

      expect(diag).toBeDefined();
      expect(diag.status).toBe("PASSED");
      expect(diag.all_expected_views_present).toBe(true);
      expect(diag.user_ratings_gist_active).toBe(true);
      expect(diag.job_statuses_gist_active).toBe(true);
      expect(diag.total_3nf_views).toBe(8);
      expect(diag.total_6nf_tables).toBeGreaterThanOrEqual(46);
    });

    it("verifies all 8 3NF reconstruction views exist in information_schema.views", async () => {
      const expectedViews = [
        "v_users",
        "v_chess_openings",
        "v_games",
        "v_game_analysis_jobs",
        "v_game_analyses",
        "v_move_analyses",
        "v_training_puzzles",
        "v_training_recommendations",
      ];

      const { rows } = await pool.query(`
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public';
      `);

      const actualViews = rows.map((r) => r.table_name);
      for (const view of expectedViews) {
        expect(actualViews).toContain(view);
      }
    });
  });

  describe("GiST Temporal Interval Exclusion Constraints", () => {
    let testUserId;

    beforeEach(async () => {
      const userRes = await pool.query(
        "INSERT INTO users DEFAULT VALUES RETURNING id;",
      );
      testUserId = userRes.rows[0].id;
    });

    afterEach(async () => {
      if (testUserId) {
        await pool.query("DELETE FROM users WHERE id = $1;", [testUserId]);
      }
    });

    it("enforces exclusion_violation (code 23P01) on overlapping temporal user ratings", async () => {
      // First rating interval: Jan 1 2026 to June 1 2026
      await pool.query(
        `INSERT INTO user_ratings (user_id, chess_rating, valid_during)
         VALUES ($1, 1500, tstzrange('2026-01-01 00:00:00+00', '2026-06-01 00:00:00+00', '[)'));`,
        [testUserId],
      );

      // Attempt overlapping rating interval: March 1 2026 to Sept 1 2026
      let errorThrown = null;
      try {
        await pool.query(
          `INSERT INTO user_ratings (user_id, chess_rating, valid_during)
           VALUES ($1, 1600, tstzrange('2026-03-01 00:00:00+00', '2026-09-01 00:00:00+00', '[)'));`,
          [testUserId],
        );
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).not.toBeNull();
      // PostgreSQL error code 23P01 is exclusion_violation
      expect(errorThrown.code).toBe("23P01");

      // Non-overlapping rating interval: June 1 2026 onwards must succeed
      await expect(
        pool.query(
          `INSERT INTO user_ratings (user_id, chess_rating, valid_during)
           VALUES ($1, 1600, tstzrange('2026-06-01 00:00:00+00', NULL, '[)'));`,
          [testUserId],
        ),
      ).resolves.toBeDefined();
    });

    it("enforces exclusion_violation on overlapping job_statuses temporal intervals", async () => {
      // Create test game
      const gameRes = await pool.query(
        "INSERT INTO games DEFAULT VALUES RETURNING id;",
      );
      const gameId = gameRes.rows[0].id;

      // Create test job
      const jobRes = await pool.query(
        "INSERT INTO game_analysis_jobs DEFAULT VALUES RETURNING id;",
      );
      const jobId = jobRes.rows[0].id;
      await pool.query(
        "INSERT INTO job_games (job_id, game_id) VALUES ($1, $2);",
        [jobId, gameId],
      );

      try {
        // Initial pending state: 00:00 to 00:10
        await pool.query(
          `INSERT INTO job_statuses (job_id, status, valid_during)
           VALUES ($1, 'pending', tstzrange('2026-01-01 00:00:00+00', '2026-01-01 00:10:00+00', '[)'));`,
          [jobId],
        );

        // Attempt overlapping status interval: 00:05 to 00:20
        let errorThrown = null;
        try {
          await pool.query(
            `INSERT INTO job_statuses (job_id, status, valid_during)
             VALUES ($1, 'processing', tstzrange('2026-01-01 00:05:00+00', '2026-01-01 00:20:00+00', '[)'));`,
            [jobId],
          );
        } catch (err) {
          errorThrown = err;
        }

        expect(errorThrown).not.toBeNull();
        expect(errorThrown.code).toBe("23P01");

        // Non-overlapping interval: 00:10 onwards must succeed
        await expect(
          pool.query(
            `INSERT INTO job_statuses (job_id, status, valid_during)
             VALUES ($1, 'processing', tstzrange('2026-01-01 00:10:00+00', NULL, '[)'));`,
            [jobId],
          ),
        ).resolves.toBeDefined();
      } finally {
        await pool.query("DELETE FROM games WHERE id = $1;", [gameId]);
        await pool.query("DELETE FROM game_analysis_jobs WHERE id = $1;", [
          jobId,
        ]);
      }
    });
  });

  describe("3NF View Reconstruction Fidelity", () => {
    let userId;
    let gameId;
    let analysisId;
    let move1Id;
    let move2Id;

    beforeAll(async () => {
      // 1. Insert User across 6NF relations
      const uRes = await pool.query(
        "INSERT INTO users DEFAULT VALUES RETURNING id;",
      );
      userId = uRes.rows[0].id;

      await pool.query(
        "INSERT INTO user_emails (user_id, email) VALUES ($1, $2);",
        [userId, "magnus@chessiq.com"],
      );
      await pool.query(
        "INSERT INTO user_usernames (user_id, username) VALUES ($1, $2);",
        [userId, "magnuscarlsen"],
      );
      await pool.query(
        "INSERT INTO user_password_hashes (user_id, password_hash) VALUES ($1, $2);",
        [userId, "$2b$12$eX4mpL3h4shV4lu3f0rT3st1ngP4ssw0rd"],
      );
      await pool.query(
        `INSERT INTO user_ratings (user_id, chess_rating, valid_during)
         VALUES ($1, 2882, tstzrange(CURRENT_TIMESTAMP, NULL, '[)'));`,
        [userId],
      );
      await pool.query(
        "INSERT INTO user_created_at (user_id, created_at) VALUES ($1, CURRENT_TIMESTAMP);",
        [userId],
      );
      await pool.query(
        "INSERT INTO user_updated_at (user_id, updated_at) VALUES ($1, CURRENT_TIMESTAMP);",
        [userId],
      );

      // 2. Insert Game across 6NF relations
      const gRes = await pool.query(
        "INSERT INTO games DEFAULT VALUES RETURNING id;",
      );
      gameId = gRes.rows[0].id;

      await pool.query(
        "INSERT INTO game_users (game_id, user_id) VALUES ($1, $2);",
        [gameId, userId],
      );
      await pool.query(
        "INSERT INTO game_white_players (game_id, white_player) VALUES ($1, $2);",
        [gameId, "Magnus Carlsen"],
      );
      await pool.query(
        "INSERT INTO game_black_players (game_id, black_player) VALUES ($1, $2);",
        [gameId, "Hikaru Nakamura"],
      );
      await pool.query(
        "INSERT INTO game_white_elos (game_id, white_elo) VALUES ($1, 2882);",
        [gameId],
      );
      await pool.query(
        "INSERT INTO game_black_elos (game_id, black_elo) VALUES ($1, 2875);",
        [gameId],
      );
      await pool.query(
        "INSERT INTO game_results (game_id, result) VALUES ($1, $2);",
        [gameId, "1-0"],
      );
      await pool.query(
        "INSERT INTO game_user_colors (game_id, user_color) VALUES ($1, $2);",
        [gameId, "WHITE"],
      );
      await pool.query(
        "INSERT INTO game_played_at (game_id, played_at) VALUES ($1, CURRENT_TIMESTAMP);",
        [gameId],
      );
      await pool.query(
        "INSERT INTO game_pgn_raws (game_id, pgn_raw) VALUES ($1, $2);",
        [gameId, "1. e4 e5 2. Nf3 Nc6 1-0"],
      );
      await pool.query(
        "INSERT INTO game_move_signatures (game_id, move_signature) VALUES ($1, $2);",
        [
          gameId,
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        ],
      );
      await pool.query(
        "INSERT INTO game_created_at (game_id, created_at) VALUES ($1, CURRENT_TIMESTAMP);",
        [gameId],
      );

      // 3. Insert Analysis across 6NF relations
      const aRes = await pool.query(
        "INSERT INTO game_analyses DEFAULT VALUES RETURNING id;",
      );
      analysisId = aRes.rows[0].id;

      await pool.query(
        "INSERT INTO game_analysis_games (analysis_id, game_id) VALUES ($1, $2);",
        [analysisId, gameId],
      );
      await pool.query(
        "INSERT INTO analysis_white_acpls (analysis_id, white_acpl) VALUES ($1, 12);",
        [analysisId],
      );
      await pool.query(
        "INSERT INTO analysis_black_acpls (analysis_id, black_acpl) VALUES ($1, 45);",
        [analysisId],
      );
      await pool.query(
        "INSERT INTO analysis_engine_depths (analysis_id, engine_depth) VALUES ($1, 14);",
        [analysisId],
      );
      await pool.query(
        "INSERT INTO analysis_completion_flags (analysis_id, is_completed) VALUES ($1, true);",
        [analysisId],
      );
      await pool.query(
        "INSERT INTO analysis_completed_at (analysis_id, completed_at) VALUES ($1, CURRENT_TIMESTAMP);",
        [analysisId],
      );

      // 4. Insert Ply 1 (White) move analysis
      const m1Res = await pool.query(
        "INSERT INTO move_analyses DEFAULT VALUES RETURNING id;",
      );
      move1Id = m1Res.rows[0].id;

      await pool.query(
        "INSERT INTO move_analysis_parents (move_id, analysis_id) VALUES ($1, $2);",
        [move1Id, analysisId],
      );
      await pool.query(
        "INSERT INTO move_plies (move_id, ply_number) VALUES ($1, 1);",
        [move1Id],
      );
      await pool.query(
        "INSERT INTO move_analysis_plies (analysis_id, ply_number, move_id) VALUES ($1, 1, $2);",
        [analysisId, move1Id],
      );
      await pool.query(
        "INSERT INTO move_numbers (move_id, move_number) VALUES ($1, 1);",
        [move1Id],
      );
      await pool.query(
        "INSERT INTO move_sans (move_id, move_san) VALUES ($1, $2);",
        [move1Id, "e4"],
      );
      await pool.query(
        "INSERT INTO move_ucis (move_id, move_uci) VALUES ($1, $2);",
        [move1Id, "e2e4"],
      );
      await pool.query(
        "INSERT INTO move_fen_befores (move_id, fen_before) VALUES ($1, $2);",
        [move1Id, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
      );
      await pool.query(
        "INSERT INTO move_fen_afters (move_id, fen_after) VALUES ($1, $2);",
        [
          move1Id,
          "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        ],
      );
      await pool.query(
        "INSERT INTO move_raw_eval_types (move_id, raw_eval_type) VALUES ($1, $2);",
        [move1Id, "cp"],
      );
      await pool.query(
        "INSERT INTO move_raw_eval_values (move_id, raw_eval_value) VALUES ($1, 25);",
        [move1Id],
      );
      await pool.query(
        "INSERT INTO move_eval_centipawns (move_id, eval_centipawns) VALUES ($1, 25);",
        [move1Id],
      );
      await pool.query(
        "INSERT INTO move_cpl_raws (move_id, cpl_raw) VALUES ($1, 0);",
        [move1Id],
      );
      await pool.query(
        "INSERT INTO move_cpl_capped (move_id, cpl_capped) VALUES ($1, 0);",
        [move1Id],
      );
      await pool.query(
        "INSERT INTO move_win_probabilities (move_id, win_probability) VALUES ($1, 0.5350);",
        [move1Id],
      );
      await pool.query(
        "INSERT INTO move_win_prob_deltas (move_id, win_prob_delta) VALUES ($1, 0.0000);",
        [move1Id],
      );
      await pool.query(
        "INSERT INTO move_best_ucis (move_id, best_move_uci) VALUES ($1, $2);",
        [move1Id, "e2e4"],
      );
      await pool.query(
        "INSERT INTO move_mistake_types (move_id, mistake_type) VALUES ($1, $2);",
        [move1Id, "BEST"],
      );
      await pool.query(
        "INSERT INTO move_phases (move_id, game_phase) VALUES ($1, $2);",
        [move1Id, "OPENING"],
      );
      await pool.query(
        "INSERT INTO move_is_book_moves (move_id, is_book_move) VALUES ($1, true);",
        [move1Id],
      );
      await pool.query(
        "INSERT INTO move_pv_lines (move_id, pv_line) VALUES ($1, $2::jsonb);",
        [move1Id, JSON.stringify(["e2e4", "e7e5", "g1f3"])],
      );

      // 5. Insert Ply 2 (Black) move analysis
      const m2Res = await pool.query(
        "INSERT INTO move_analyses DEFAULT VALUES RETURNING id;",
      );
      move2Id = m2Res.rows[0].id;

      await pool.query(
        "INSERT INTO move_analysis_parents (move_id, analysis_id) VALUES ($1, $2);",
        [move2Id, analysisId],
      );
      await pool.query(
        "INSERT INTO move_plies (move_id, ply_number) VALUES ($1, 2);",
        [move2Id],
      );
      await pool.query(
        "INSERT INTO move_analysis_plies (analysis_id, ply_number, move_id) VALUES ($1, 2, $2);",
        [analysisId, move2Id],
      );
      await pool.query(
        "INSERT INTO move_numbers (move_id, move_number) VALUES ($1, 1);",
        [move2Id],
      );
      await pool.query(
        "INSERT INTO move_sans (move_id, move_san) VALUES ($1, $2);",
        [move2Id, "e5"],
      );
      await pool.query(
        "INSERT INTO move_ucis (move_id, move_uci) VALUES ($1, $2);",
        [move2Id, "e7e5"],
      );
      await pool.query(
        "INSERT INTO move_fen_befores (move_id, fen_before) VALUES ($1, $2);",
        [
          move2Id,
          "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        ],
      );
      await pool.query(
        "INSERT INTO move_fen_afters (move_id, fen_after) VALUES ($1, $2);",
        [
          move2Id,
          "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
        ],
      );
      await pool.query(
        "INSERT INTO move_raw_eval_types (move_id, raw_eval_type) VALUES ($1, $2);",
        [move2Id, "cp"],
      );
      await pool.query(
        "INSERT INTO move_raw_eval_values (move_id, raw_eval_value) VALUES ($1, -20);",
        [move2Id],
      );
      await pool.query(
        "INSERT INTO move_eval_centipawns (move_id, eval_centipawns) VALUES ($1, -20);",
        [move2Id],
      );
      await pool.query(
        "INSERT INTO move_cpl_raws (move_id, cpl_raw) VALUES ($1, 5);",
        [move2Id],
      );
      await pool.query(
        "INSERT INTO move_cpl_capped (move_id, cpl_capped) VALUES ($1, 5);",
        [move2Id],
      );
      await pool.query(
        "INSERT INTO move_win_probabilities (move_id, win_probability) VALUES ($1, 0.4700);",
        [move2Id],
      );
      await pool.query(
        "INSERT INTO move_win_prob_deltas (move_id, win_prob_delta) VALUES ($1, -0.0100);",
        [move2Id],
      );
      await pool.query(
        "INSERT INTO move_best_ucis (move_id, best_move_uci) VALUES ($1, $2);",
        [move2Id, "e7e5"],
      );
      await pool.query(
        "INSERT INTO move_mistake_types (move_id, mistake_type) VALUES ($1, $2);",
        [move2Id, "GOOD"],
      );
      await pool.query(
        "INSERT INTO move_phases (move_id, game_phase) VALUES ($1, $2);",
        [move2Id, "OPENING"],
      );
      await pool.query(
        "INSERT INTO move_pv_lines (move_id, pv_line) VALUES ($1, $2::jsonb);",
        [move2Id, JSON.stringify(["e7e5", "g1f3", "b8c6"])],
      );
    });

    afterAll(async () => {
      if (userId) {
        await pool.query("DELETE FROM users WHERE id = $1;", [userId]);
      }
      if (gameId) {
        await pool.query("DELETE FROM games WHERE id = $1;", [gameId]);
      }
      if (analysisId) {
        await pool.query("DELETE FROM game_analyses WHERE id = $1;", [
          analysisId,
        ]);
      }
    });

    it("correctly reconstructs v_users record with lateral active rating resolution", async () => {
      const { rows } = await pool.query(
        "SELECT * FROM v_users WHERE id = $1;",
        [userId],
      );
      expect(rows).toHaveLength(1);
      const user = rows[0];
      expect(user.email).toBe("magnus@chessiq.com");
      expect(user.username).toBe("magnuscarlsen");
      expect(user.chess_rating).toBe(2882);
      expect(user.created_at).toBeDefined();
      expect(user.updated_at).toBeDefined();
    });

    it("correctly reconstructs v_games record with players, elos, and PGN", async () => {
      const { rows } = await pool.query(
        "SELECT * FROM v_games WHERE id = $1;",
        [gameId],
      );
      expect(rows).toHaveLength(1);
      const game = rows[0];
      expect(game.user_id).toBe(userId);
      expect(game.white_player).toBe("Magnus Carlsen");
      expect(game.black_player).toBe("Hikaru Nakamura");
      expect(game.white_elo).toBe(2882);
      expect(game.black_elo).toBe(2875);
      expect(game.result).toBe("1-0");
      expect(game.user_color).toBe("WHITE");
      expect(game.pgn_raw).toBe("1. e4 e5 2. Nf3 Nc6 1-0");
    });

    it("correctly reconstructs v_game_analyses aggregate telemetry", async () => {
      const { rows } = await pool.query(
        "SELECT * FROM v_game_analyses WHERE id = $1;",
        [analysisId],
      );
      expect(rows).toHaveLength(1);
      const analysis = rows[0];
      expect(analysis.game_id).toBe(gameId);
      expect(analysis.white_acpl).toBe(12);
      expect(analysis.black_acpl).toBe(45);
      expect(analysis.engine_depth).toBe(14);
      expect(analysis.is_completed).toBe(true);
    });

    it("dynamically derives color in v_move_analyses (WHITE for odd, BLACK for even)", async () => {
      const { rows } = await pool.query(
        "SELECT ply_number, color, move_san, is_book_move FROM v_move_analyses WHERE analysis_id = $1 ORDER BY ply_number ASC;",
        [analysisId],
      );
      expect(rows).toHaveLength(2);

      // Ply 1: White move, book move true
      expect(rows[0].ply_number).toBe(1);
      expect(rows[0].color).toBe("WHITE");
      expect(rows[0].move_san).toBe("e4");
      expect(rows[0].is_book_move).toBe(true);

      // Ply 2: Black move, book move defaults to false
      expect(rows[1].ply_number).toBe(2);
      expect(rows[1].color).toBe("BLACK");
      expect(rows[1].move_san).toBe("e5");
      expect(rows[1].is_book_move).toBe(false);
    });
  });

  describe("Reactive LISTEN/NOTIFY Trigger", () => {
    it("notifies on channel new_analysis_job when a pending job is inserted", async () => {
      const gameRes = await pool.query(
        "INSERT INTO games DEFAULT VALUES RETURNING id;",
      );
      const gameId = gameRes.rows[0].id;
      const jobRes = await pool.query(
        "INSERT INTO game_analysis_jobs DEFAULT VALUES RETURNING id;",
      );
      const jobId = jobRes.rows[0].id;
      await pool.query(
        "INSERT INTO job_games (job_id, game_id) VALUES ($1, $2);",
        [jobId, gameId],
      );

      // Connect a dedicated client to LISTEN
      const client = await pool.connect();
      let notificationReceived = null;

      try {
        await client.query("LISTEN new_analysis_job;");

        const notificationPromise = new Promise((resolve) => {
          client.on("notification", (msg) => {
            notificationReceived = msg;
            resolve(msg);
          });
        });

        // Insert pending status to trigger notification
        await pool.query(
          `INSERT INTO job_statuses (job_id, status, valid_during)
           VALUES ($1, 'pending', tstzrange(CURRENT_TIMESTAMP, NULL, '[)'));`,
          [jobId],
        );

        // Wait for notification with 2s timeout
        const received = await Promise.race([
          notificationPromise,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Timeout waiting for notification")),
              2000,
            ),
          ),
        ]);

        expect(received).toBeDefined();
        expect(received.channel).toBe("new_analysis_job");
        expect(received.payload).toBe(jobId);
      } finally {
        await client.query("UNLISTEN new_analysis_job;").catch(() => {});
        client.release();
        await pool.query("DELETE FROM games WHERE id = $1;", [gameId]);
        await pool.query("DELETE FROM game_analysis_jobs WHERE id = $1;", [
          jobId,
        ]);
      }
    });
  });
});
