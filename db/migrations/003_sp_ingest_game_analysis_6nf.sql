-- ============================================================================
-- ChessIQ v3.3.0 — Migration 003: High-Performance 6NF Batch Ingestion
-- Procedure & GiST Collision-Proof Status Transition Helper (@DB)
-- Target Engine: PostgreSQL 16.x / 17.x
-- Role: Abhijit Saha — Project Lead & Database Architect (@DB)
--
-- Theoretical Grounding:
-- In a physical 6NF decomposition, persisting an 80-ply game analysis requires
-- 1,440+ individual binary relation inserts. This stored procedure replaces
-- those round-trips with a single atomic PL/pgSQL RPC call.
--
-- Features:
-- 1. sp_ingest_game_analysis_6nf:
--    - Accepts 11 aggregate metrics + 18 parallel primitive arrays.
--    - Bulk-generates move UUIDs via array_agg(uuid_generate_v4()).
--    - Executes set-based UNNEST / generate_series multi-row inserts in parallel.
--    - Strictly enforces Zero-NULL storage (skips NULLs for mate/centipawn/best_uci).
--    - Benchmark target: < 50ms execution duration for 80 plies.
-- 2. fn_transition_job_status:
--    - Implements GiST collision-prevention interval update:
--      new_time = GREATEST(CURRENT_TIMESTAMP, lower(valid_during) + INTERVAL '1 millisecond')
--    - Closes previous status interval and opens new status interval with zero overlap.
-- 3. fn_verify_day3_ingestion:
--    - Comprehensive diagnostic telemetry function asserting procedure existence,
--      parameter counts, and active GiST exclusion constraints.
-- ============================================================================

-- ============================================================================
-- 1. High-Performance 6NF Batch Ingestion Stored Procedure
-- ============================================================================

CREATE OR REPLACE PROCEDURE sp_ingest_game_analysis_6nf(
    p_analysis_id UUID,
    p_game_id UUID,
    p_white_acpl INT,
    p_black_acpl INT,
    p_white_blunders INT,
    p_white_mistakes INT,
    p_white_inaccuracies INT,
    p_black_blunders INT,
    p_black_mistakes INT,
    p_black_inaccuracies INT,
    p_engine_depth INT,
    -- Parallel move-level arrays (18 arrays)
    p_ply_numbers INT[],
    p_move_sans VARCHAR[],
    p_move_ucis VARCHAR[],
    p_fen_befores VARCHAR[],
    p_fen_afters VARCHAR[],
    p_raw_eval_types VARCHAR[],
    p_raw_eval_values INT[],
    p_eval_centipawns INT[],       -- Zero-NULL: element can be NULL if mate
    p_eval_mates INT[],            -- Zero-NULL: element can be NULL if cp
    p_cpl_raws INT[],
    p_cpl_cappeds INT[],
    p_win_probabilities NUMERIC[],
    p_win_prob_deltas NUMERIC[],
    p_best_ucis VARCHAR[],         -- Zero-NULL: element can be NULL if timeout/none
    p_mistake_types VARCHAR[],
    p_phases VARCHAR[],
    p_pv_lines JSONB[],
    p_is_book_moves BOOLEAN[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INT;
    v_move_ids UUID[];
BEGIN
    v_count := array_length(p_ply_numbers, 1);
    IF v_count IS NULL OR v_count = 0 THEN
        RAISE EXCEPTION 'sp_ingest_game_analysis_6nf: ply arrays cannot be empty.';
    END IF;

    -- Validate required parallel array boundaries
    IF array_length(p_move_sans, 1) IS DISTINCT FROM v_count OR
       array_length(p_move_ucis, 1) IS DISTINCT FROM v_count OR
       array_length(p_fen_befores, 1) IS DISTINCT FROM v_count OR
       array_length(p_fen_afters, 1) IS DISTINCT FROM v_count OR
       array_length(p_raw_eval_types, 1) IS DISTINCT FROM v_count OR
       array_length(p_raw_eval_values, 1) IS DISTINCT FROM v_count OR
       array_length(p_cpl_raws, 1) IS DISTINCT FROM v_count OR
       array_length(p_cpl_cappeds, 1) IS DISTINCT FROM v_count OR
       array_length(p_win_probabilities, 1) IS DISTINCT FROM v_count OR
       array_length(p_win_prob_deltas, 1) IS DISTINCT FROM v_count OR
       array_length(p_mistake_types, 1) IS DISTINCT FROM v_count OR
       array_length(p_phases, 1) IS DISTINCT FROM v_count OR
       array_length(p_pv_lines, 1) IS DISTINCT FROM v_count THEN
        RAISE EXCEPTION 'sp_ingest_game_analysis_6nf: parallel move array length mismatch.';
    END IF;

    -- 1. Insert Game Analysis 6NF relations
    INSERT INTO game_analyses (id) VALUES (p_analysis_id);
    INSERT INTO game_analysis_games (analysis_id, game_id) VALUES (p_analysis_id, p_game_id);
    INSERT INTO analysis_white_acpls (analysis_id, white_acpl) VALUES (p_analysis_id, p_white_acpl);
    INSERT INTO analysis_black_acpls (analysis_id, black_acpl) VALUES (p_analysis_id, p_black_acpl);
    INSERT INTO analysis_white_blunders (analysis_id, white_blunders) VALUES (p_analysis_id, p_white_blunders);
    INSERT INTO analysis_white_mistakes (analysis_id, white_mistakes) VALUES (p_analysis_id, p_white_mistakes);
    INSERT INTO analysis_white_inaccuracies (analysis_id, white_inaccuracies) VALUES (p_analysis_id, p_white_inaccuracies);
    INSERT INTO analysis_black_blunders (analysis_id, black_blunders) VALUES (p_analysis_id, p_black_blunders);
    INSERT INTO analysis_black_mistakes (analysis_id, black_mistakes) VALUES (p_analysis_id, p_black_mistakes);
    INSERT INTO analysis_black_inaccuracies (analysis_id, black_inaccuracies) VALUES (p_analysis_id, p_black_inaccuracies);
    INSERT INTO analysis_engine_depths (analysis_id, engine_depth) VALUES (p_analysis_id, p_engine_depth);
    INSERT INTO analysis_completion_flags (analysis_id, is_completed) VALUES (p_analysis_id, TRUE);
    INSERT INTO analysis_completed_at (analysis_id, completed_at) VALUES (p_analysis_id, CURRENT_TIMESTAMP);

    -- 2. Pre-generate UUIDs for each move to maintain strict referential integrity
    SELECT array_agg(uuid_generate_v4()) INTO v_move_ids
    FROM generate_series(1, v_count);

    -- 3. Batch insert Move Existence Anchors
    INSERT INTO move_analyses (id)
    SELECT unnest(v_move_ids);

    -- 4. Batch insert Parent Analysis foreign keys
    INSERT INTO move_analysis_parents (move_id, analysis_id)
    SELECT unnest(v_move_ids), p_analysis_id;

    -- 5. Batch insert Plies and Move Numbers
    INSERT INTO move_plies (move_id, ply_number)
    SELECT v_move_ids[i], p_ply_numbers[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_analysis_plies (analysis_id, ply_number, move_id)
    SELECT p_analysis_id, p_ply_numbers[i], v_move_ids[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_numbers (move_id, move_number)
    SELECT v_move_ids[i], ((p_ply_numbers[i] + 1) / 2)::INT
    FROM generate_series(1, v_count) AS i;

    -- 6. Batch insert Move Representations (SAN, UCI, FENs)
    INSERT INTO move_sans (move_id, move_san)
    SELECT v_move_ids[i], p_move_sans[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_ucis (move_id, move_uci)
    SELECT v_move_ids[i], p_move_ucis[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_fen_befores (move_id, fen_before)
    SELECT v_move_ids[i], p_fen_befores[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_fen_afters (move_id, fen_after)
    SELECT v_move_ids[i], p_fen_afters[i]
    FROM generate_series(1, v_count) AS i;

    -- 7. Batch insert Evaluations and CPL
    INSERT INTO move_raw_eval_types (move_id, raw_eval_type)
    SELECT v_move_ids[i], p_raw_eval_types[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_raw_eval_values (move_id, raw_eval_value)
    SELECT v_move_ids[i], p_raw_eval_values[i]
    FROM generate_series(1, v_count) AS i;

    -- Zero-NULL: Insert only when non-null
    IF p_eval_centipawns IS NOT NULL THEN
        INSERT INTO move_eval_centipawns (move_id, eval_centipawns)
        SELECT v_move_ids[i], p_eval_centipawns[i]
        FROM generate_series(1, v_count) AS i
        WHERE p_eval_centipawns[i] IS NOT NULL;
    END IF;

    IF p_eval_mates IS NOT NULL THEN
        INSERT INTO move_eval_mates (move_id, eval_mate)
        SELECT v_move_ids[i], p_eval_mates[i]
        FROM generate_series(1, v_count) AS i
        WHERE p_eval_mates[i] IS NOT NULL;
    END IF;

    INSERT INTO move_cpl_raws (move_id, cpl_raw)
    SELECT v_move_ids[i], p_cpl_raws[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_cpl_capped (move_id, cpl_capped)
    SELECT v_move_ids[i], p_cpl_cappeds[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_win_probabilities (move_id, win_probability)
    SELECT v_move_ids[i], p_win_probabilities[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_win_prob_deltas (move_id, win_prob_delta)
    SELECT v_move_ids[i], p_win_prob_deltas[i]
    FROM generate_series(1, v_count) AS i;

    IF p_best_ucis IS NOT NULL THEN
        INSERT INTO move_best_ucis (move_id, best_move_uci)
        SELECT v_move_ids[i], p_best_ucis[i]
        FROM generate_series(1, v_count) AS i
        WHERE p_best_ucis[i] IS NOT NULL;
    END IF;

    INSERT INTO move_mistake_types (move_id, mistake_type)
    SELECT v_move_ids[i], p_mistake_types[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_phases (move_id, game_phase)
    SELECT v_move_ids[i], p_phases[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_pv_lines (move_id, pv_line)
    SELECT v_move_ids[i], p_pv_lines[i]
    FROM generate_series(1, v_count) AS i;

    INSERT INTO move_is_book_moves (move_id, is_book_move)
    SELECT v_move_ids[i], COALESCE(p_is_book_moves[i], FALSE)
    FROM generate_series(1, v_count) AS i;

END;
$$;

-- ============================================================================
-- 2. GiST Collision-Proof Status Transition Helper Function
-- Enforces: new_time = GREATEST(CURRENT_TIMESTAMP, lower(valid_during) + INTERVAL '1 millisecond')
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_transition_job_status(
    p_job_id UUID,
    p_new_status VARCHAR
)
RETURNS TSTZRANGE AS $$
DECLARE
    v_closed_range TSTZRANGE;
    v_new_lower TIMESTAMPTZ;
    v_new_range TSTZRANGE;
BEGIN
    -- 1. Close currently active status interval using GREATEST to avoid microsecond GiST collisions
    UPDATE job_statuses
    SET valid_during = tstzrange(
        lower(valid_during),
        GREATEST(CURRENT_TIMESTAMP, lower(valid_during) + INTERVAL '1 millisecond'),
        '[)'
    )
    WHERE job_id = p_job_id AND upper(valid_during) IS NULL
    RETURNING valid_during INTO v_closed_range;

    IF v_closed_range IS NULL THEN
        -- No previous active interval existed; use CURRENT_TIMESTAMP
        v_new_lower := CURRENT_TIMESTAMP;
    ELSE
        v_new_lower := upper(v_closed_range);
    END IF;

    -- 2. Open new status interval starting at the closed interval's exact upper bound
    v_new_range := tstzrange(v_new_lower, NULL, '[)');
    
    INSERT INTO job_statuses (job_id, status, valid_during)
    VALUES (p_job_id, p_new_status, v_new_range);

    RETURN v_new_range;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Day 3 Verification Diagnostic Function
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_verify_day3_ingestion()
RETURNS JSONB AS $$
DECLARE
    v_proc_exists BOOLEAN := FALSE;
    v_param_count INT := 0;
    v_user_ratings_gist BOOLEAN := FALSE;
    v_job_statuses_gist BOOLEAN := FALSE;
    v_transition_func_exists BOOLEAN := FALSE;
    v_result JSONB;
BEGIN
    -- Check procedure sp_ingest_game_analysis_6nf
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'sp_ingest_game_analysis_6nf'
    ), COALESCE((
        SELECT pronargs
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'sp_ingest_game_analysis_6nf'
        LIMIT 1
    ), 0)
    INTO v_proc_exists, v_param_count;

    -- Check transition function fn_transition_job_status
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'fn_transition_job_status'
    ) INTO v_transition_func_exists;

    -- Verify GiST exclusion constraint on user_ratings
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'user_ratings'
          AND c.contype = 'x'
    ) INTO v_user_ratings_gist;

    -- Verify GiST exclusion constraint on job_statuses
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'job_statuses'
          AND c.contype = 'x'
    ) INTO v_job_statuses_gist;

    IF NOT v_proc_exists THEN
        RAISE EXCEPTION 'Diagnostic failed: Stored procedure sp_ingest_game_analysis_6nf does not exist!';
    END IF;

    IF v_param_count != 29 THEN
        RAISE EXCEPTION 'Diagnostic failed: sp_ingest_game_analysis_6nf parameter count mismatch! Expected 29, found %', v_param_count;
    END IF;

    IF NOT v_user_ratings_gist THEN
        RAISE EXCEPTION 'Diagnostic failed: GiST exclusion constraint on user_ratings is missing!';
    END IF;

    IF NOT v_job_statuses_gist THEN
        RAISE EXCEPTION 'Diagnostic failed: GiST exclusion constraint on job_statuses is missing!';
    END IF;

    v_result := jsonb_build_object(
        'status', 'PASSED',
        'procedure_name', 'sp_ingest_game_analysis_6nf',
        'procedure_exists', v_proc_exists,
        'parameter_count', v_param_count,
        'transition_helper_active', v_transition_func_exists,
        'user_ratings_gist_active', v_user_ratings_gist,
        'job_statuses_gist_active', v_job_statuses_gist,
        'timestamp', CURRENT_TIMESTAMP
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

