-- ============================================================================
-- ChessIQ v3.3.0 — Migration 002: Lossless 3NF Reconstruction Views Layer
-- Target Engine: PostgreSQL 16.x / 17.x
-- Role: Abhijit Saha — Project Lead & Database Architect (@DB)
--
-- Theoretical Grounding:
-- Provides a 100% backward-compatible, seamless 3NF tabular abstraction layer
-- over the physical 6NF binary relations. Preserves strict relational invariants
-- (e.g., dynamic color derivation from ply_number, foreign-key resolution of
-- user_id through game_users, 1NF aggregation of puzzle themes via jsonb_agg).
-- ============================================================================

-- ============================================================================
-- 1. Logical 3NF View: Users
-- ============================================================================
CREATE OR REPLACE VIEW v_users AS
SELECT
    u.id,
    ue.email,
    uu.username,
    uph.password_hash,
    ur.chess_rating,
    uca.created_at,
    uua.updated_at
FROM users u
JOIN user_emails ue ON u.id = ue.user_id
JOIN user_usernames uu ON u.id = uu.user_id
JOIN user_password_hashes uph ON u.id = uph.user_id
LEFT JOIN LATERAL (
    SELECT chess_rating
    FROM user_ratings
    WHERE user_id = u.id AND upper(valid_during) IS NULL
    ORDER BY lower(valid_during) DESC
    LIMIT 1
) ur ON TRUE
JOIN user_created_at uca ON u.id = uca.user_id
JOIN user_updated_at uua ON u.id = uua.user_id;

-- ============================================================================
-- 2. Logical 3NF View: Chess Openings Catalog
-- ============================================================================
CREATE OR REPLACE VIEW v_chess_openings AS
SELECT
    co.eco_code,
    con.name,
    cov.variation,
    cop.pgn_moves
FROM chess_openings co
JOIN chess_opening_names con ON co.eco_code = con.eco_code
LEFT JOIN chess_opening_variations cov ON co.eco_code = cov.eco_code
JOIN chess_opening_pgn_moves cop ON co.eco_code = cop.eco_code;

-- ============================================================================
-- 3. Logical 3NF View: Games
-- ============================================================================
CREATE OR REPLACE VIEW v_games AS
SELECT
    g.id,
    gu.user_id,
    ge.eco_code,
    gwp.white_player,
    gbp.black_player,
    gwe.white_elo,
    gbe.black_elo,
    gr.result,
    guc.user_color,
    gpa.played_at,
    gpr.pgn_raw,
    gms.move_signature,
    gca.created_at
FROM games g
JOIN game_users gu ON g.id = gu.game_id
LEFT JOIN game_ecos ge ON g.id = ge.game_id
JOIN game_white_players gwp ON g.id = gwp.game_id
JOIN game_black_players gbp ON g.id = gbp.game_id
LEFT JOIN game_white_elos gwe ON g.id = gwe.game_id
LEFT JOIN game_black_elos gbe ON g.id = gbe.game_id
JOIN game_results gr ON g.id = gr.game_id
JOIN game_user_colors guc ON g.id = guc.game_id
JOIN game_played_at gpa ON g.id = gpa.game_id
JOIN game_pgn_raws gpr ON g.id = gpr.game_id
JOIN game_move_signatures gms ON g.id = gms.game_id
JOIN game_created_at gca ON g.id = gca.game_id;

-- ============================================================================
-- 4. Logical 3NF View: Game Analysis Jobs (Queue Domain)
-- Strict 3NF/BCNF: user_id is resolved via game_users(game_id)
-- ============================================================================
CREATE OR REPLACE VIEW v_game_analysis_jobs AS
SELECT
    j.id,
    jg.game_id,
    gu.user_id,
    COALESCE(js.status, 'pending') AS status,
    COALESCE(jcp.current_ply, 0) AS current_ply,
    COALESCE(jtp.total_plies, 0) AS total_plies,
    COALESCE(jac.attempt_count, 0) AS attempt_count,
    COALESCE(jmr.max_retries, 3) AS max_retries,
    jct.claim_token,
    jlb.locked_by,
    jla.locked_at,
    jha.heartbeat_at,
    jsa.started_at,
    jca.completed_at,
    jle.last_error,
    jua.updated_at,
    jcr.created_at
FROM game_analysis_jobs j
JOIN job_games jg ON j.id = jg.job_id
JOIN game_users gu ON jg.game_id = gu.game_id
LEFT JOIN LATERAL (
    SELECT status
    FROM job_statuses
    WHERE job_id = j.id AND upper(valid_during) IS NULL
    ORDER BY lower(valid_during) DESC
    LIMIT 1
) js ON TRUE
LEFT JOIN job_current_plies jcp ON j.id = jcp.job_id
LEFT JOIN job_total_plies jtp ON j.id = jtp.job_id
LEFT JOIN job_attempt_counts jac ON j.id = jac.job_id
LEFT JOIN job_max_retries jmr ON j.id = jmr.job_id
LEFT JOIN job_claim_tokens jct ON j.id = jct.job_id
LEFT JOIN job_locked_by jlb ON j.id = jlb.job_id
LEFT JOIN job_locked_at jla ON j.id = jla.job_id
LEFT JOIN job_heartbeat_at jha ON j.id = jha.job_id
LEFT JOIN job_started_at jsa ON j.id = jsa.job_id
LEFT JOIN job_completed_at jca ON j.id = jca.job_id
LEFT JOIN job_last_errors jle ON j.id = jle.job_id
JOIN job_updated_at jua ON j.id = jua.job_id
JOIN job_created_at jcr ON j.id = jcr.job_id;

-- ============================================================================
-- 5. Logical 3NF View: Game Analyses (Aggregate Telemetry)
-- ============================================================================
CREATE OR REPLACE VIEW v_game_analyses AS
SELECT
    a.id,
    gag.game_id,
    awa.white_acpl,
    aba.black_acpl,
    COALESCE(awb.white_blunders, 0) AS white_blunders,
    COALESCE(awm.white_mistakes, 0) AS white_mistakes,
    COALESCE(awi.white_inaccuracies, 0) AS white_inaccuracies,
    COALESCE(abb.black_blunders, 0) AS black_blunders,
    COALESCE(abm.black_mistakes, 0) AS black_mistakes,
    COALESCE(abi.black_inaccuracies, 0) AS black_inaccuracies,
    aed.engine_depth,
    COALESCE(acf.is_completed, FALSE) AS is_completed,
    aca.completed_at
FROM game_analyses a
JOIN game_analysis_games gag ON a.id = gag.analysis_id
JOIN analysis_white_acpls awa ON a.id = awa.analysis_id
JOIN analysis_black_acpls aba ON a.id = aba.analysis_id
LEFT JOIN analysis_white_blunders awb ON a.id = awb.analysis_id
LEFT JOIN analysis_white_mistakes awm ON a.id = awm.analysis_id
LEFT JOIN analysis_white_inaccuracies awi ON a.id = awi.analysis_id
LEFT JOIN analysis_black_blunders abb ON a.id = abb.analysis_id
LEFT JOIN analysis_black_mistakes abm ON a.id = abm.analysis_id
LEFT JOIN analysis_black_inaccuracies abi ON a.id = abi.analysis_id
JOIN analysis_engine_depths aed ON a.id = aed.analysis_id
LEFT JOIN analysis_completion_flags acf ON a.id = acf.analysis_id
LEFT JOIN analysis_completed_at aca ON a.id = aca.analysis_id;

-- ============================================================================
-- 6. Logical 3NF View: Move Analyses (Per-Ply Evaluations)
-- Resolves 'color' dynamically via ply_number; preserves catalog 'is_book_move'
-- ============================================================================
CREATE OR REPLACE VIEW v_move_analyses AS
SELECT
    m.id,
    map.analysis_id,
    mpl.ply_number,
    mn.move_number,
    CASE WHEN mpl.ply_number % 2 = 1 THEN 'WHITE' ELSE 'BLACK' END AS color,
    ms.move_san,
    mu.move_uci,
    mfb.fen_before,
    mfa.fen_after,
    mret.raw_eval_type,
    mrev.raw_eval_value,
    mec.eval_centipawns,
    mem.eval_mate,
    mcr.cpl_raw,
    mcc.cpl_capped,
    mwp.win_probability,
    mwpd.win_prob_delta,
    mbu.best_move_uci,
    mmt.mistake_type,
    mph.game_phase,
    COALESCE(mib.is_book_move, FALSE) AS is_book_move,
    mpv.pv_line
FROM move_analyses m
JOIN move_analysis_parents map ON m.id = map.move_id
JOIN move_plies mpl ON m.id = mpl.move_id
JOIN move_numbers mn ON m.id = mn.move_id
JOIN move_sans ms ON m.id = ms.move_id
JOIN move_ucis mu ON m.id = mu.move_id
JOIN move_fen_befores mfb ON m.id = mfb.move_id
JOIN move_fen_afters mfa ON m.id = mfa.move_id
JOIN move_raw_eval_types mret ON m.id = mret.move_id
JOIN move_raw_eval_values mrev ON m.id = mrev.move_id
LEFT JOIN move_eval_centipawns mec ON m.id = mec.move_id
LEFT JOIN move_eval_mates mem ON m.id = mem.move_id
JOIN move_cpl_raws mcr ON m.id = mcr.move_id
JOIN move_cpl_capped mcc ON m.id = mcc.move_id
JOIN move_win_probabilities mwp ON m.id = mwp.move_id
JOIN move_win_prob_deltas mwpd ON m.id = mwpd.move_id
LEFT JOIN move_best_ucis mbu ON m.id = mbu.move_id
JOIN move_mistake_types mmt ON m.id = mmt.move_id
JOIN move_phases mph ON m.id = mph.move_id
LEFT JOIN move_is_book_moves mib ON m.id = mib.move_id
JOIN move_pv_lines mpv ON m.id = mpv.move_id;

-- ============================================================================
-- 7. Logical 3NF View: Training Puzzles (1NF Aggregation)
-- ============================================================================
CREATE OR REPLACE VIEW v_training_puzzles AS
SELECT
    p.id,
    pf.fen,
    pm.moves,
    pr.rating,
    pct.created_at,
    COALESCE(
        jsonb_agg(
            jsonb_build_object('theme_code', pt.theme_code, 'description', ptt.description)
        ) FILTER (WHERE pt.theme_code IS NOT NULL),
        '[]'::jsonb
    ) AS themes
FROM training_puzzles p
JOIN puzzle_fens pf ON p.id = pf.puzzle_id
JOIN puzzle_moves pm ON p.id = pm.puzzle_id
JOIN puzzle_ratings pr ON p.id = pr.puzzle_id
JOIN puzzle_created_times pct ON p.id = pct.puzzle_id
LEFT JOIN puzzle_themes pt ON p.id = pt.puzzle_id
LEFT JOIN puzzle_theme_types ptt ON pt.theme_code = ptt.theme_code
GROUP BY p.id, pf.fen, pm.moves, pr.rating, pct.created_at;

-- ============================================================================
-- 8. Logical 3NF View: Training Recommendations
-- ============================================================================
CREATE OR REPLACE VIEW v_training_recommendations AS
SELECT
    r.id,
    ru.user_id,
    rp.puzzle_id,
    rc.category,
    rd.description,
    rm.metric_evidence,
    COALESCE(rcs.is_completed, FALSE) AS is_completed,
    rct.created_at
FROM training_recommendations r
JOIN recommendation_users ru ON r.id = ru.recommendation_id
LEFT JOIN recommendation_puzzles rp ON r.id = rp.recommendation_id
JOIN recommendation_categories rc ON r.id = rc.recommendation_id
JOIN recommendation_descriptions rd ON r.id = rd.recommendation_id
JOIN recommendation_metrics rm ON r.id = rm.recommendation_id
LEFT JOIN recommendation_completion_states rcs ON r.id = rcs.recommendation_id
JOIN recommendation_creation_times rct ON r.id = rct.recommendation_id;

-- ============================================================================
-- 9. Diagnostic Verification Function for 6NF Schema & 3NF Views
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_verify_6nf_schema()
RETURNS JSONB AS $$
DECLARe
    v_table_count INT;
    v_view_count INT;
    v_missing_views TEXT[];
    v_has_user_ratings_gist BOOLEAN;
    v_has_job_statuses_gist BOOLEAN;
    v_result JSONB;
    c_expected_views CONSTANT TEXT[] := ARRAY[
        'v_users',
        'v_chess_openings',
        'v_games',
        'v_game_analysis_jobs',
        'v_game_analyses',
        'v_move_analyses',
        'v_training_puzzles',
        'v_training_recommendations'
    ];
BEGIN
    -- Count 6NF tables in public schema (excluding schema_migrations)
    SELECT count(*)::INT
    INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name != 'schema_migrations';

    -- Count 3NF views in public schema
    SELECT count(*)::INT
    INTO v_view_count
    FROM information_schema.views
    WHERE table_schema = 'public';

    -- Check for missing views
    SELECT ARRAY(
        SELECT ev
        FROM unnest(c_expected_views) AS ev
        WHERE ev NOT IN (
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = 'public'
        )
    ) INTO v_missing_views;

    -- Verify GiST exclusion constraint on user_ratings
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'user_ratings'
          AND c.contype = 'x' -- 'x' indicates EXCLUSION constraint
    ) INTO v_has_user_ratings_gist;

    -- Verify GiST exclusion constraint on job_statuses
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'job_statuses'
          AND c.contype = 'x'
    ) INTO v_has_job_statuses_gist;

    -- Assertions
    IF array_length(v_missing_views, 1) > 0 THEN
        RAISE EXCEPTION 'Missing expected 3NF reconstruction views: %', array_to_string(v_missing_views, ', ');
    END IF;

    IF NOT v_has_user_ratings_gist THEN
        RAISE EXCEPTION 'GiST exclusion constraint missing on user_ratings!';
    END IF;

    IF NOT v_has_job_statuses_gist THEN
        RAISE EXCEPTION 'GiST exclusion constraint missing on job_statuses!';
    END IF;

    v_result := jsonb_build_object(
        'status', 'PASSED',
        'total_6nf_tables', v_table_count,
        'total_3nf_views', v_view_count,
        'all_expected_views_present', TRUE,
        'user_ratings_gist_active', v_has_user_ratings_gist,
        'job_statuses_gist_active', v_has_job_statuses_gist,
        'timestamp', CURRENT_TIMESTAMP
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
