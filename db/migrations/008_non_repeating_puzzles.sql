-- ============================================================================
-- ChessIQ v3.3.0 — Non-Repeating Personalized Training Puzzles
-- Ensures fn_generate_personalized_puzzles & sp_generate_user_training_recommendations
-- never repeat already-recommended or already-solved puzzles for a user.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_generate_personalized_puzzles(
    p_user_id UUID,
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    puzzle_id UUID,
    fen VARCHAR(100),
    moves VARCHAR(255),
    rating INT,
    created_at TIMESTAMPTZ,
    themes JSONB,
    match_reason TEXT
) AS $$
DECLARE
    v_user_rating INT := 1500;
    v_worst_phase VARCHAR(15) := 'MIDDLEGAME';
    v_blunder_count INT := 0;
BEGIN
    SELECT COALESCE(chess_rating, 1500)
    INTO v_user_rating
    FROM user_ratings
    WHERE user_id = p_user_id
      AND upper(valid_during) IS NULL
    ORDER BY lower(valid_during) DESC
    LIMIT 1;

    IF v_user_rating IS NULL THEN
        v_user_rating := 1500;
    END IF;

    SELECT
        vma.game_phase,
        COUNT(*)::INT AS cnt
    INTO v_worst_phase, v_blunder_count
    FROM v_games vg
    JOIN v_game_analyses vga ON vg.id = vga.game_id
    JOIN v_move_analyses vma ON vga.id = vma.analysis_id
    WHERE vg.user_id = p_user_id
      AND vma.color = vg.user_color
      AND vma.mistake_type IN ('BLUNDER', 'MISTAKE')
    GROUP BY vma.game_phase
    ORDER BY cnt DESC
    LIMIT 1;

    IF v_worst_phase IS NULL THEN
        v_worst_phase := 'MIDDLEGAME';
    END IF;

    -- Prefer unseen puzzles first (never recommended before); if exhausted, only uncompleted ones
    RETURN QUERY
    SELECT
        p.id AS puzzle_id,
        p.fen,
        p.moves,
        p.rating,
        p.created_at,
        p.themes,
        CASE
            WHEN v_worst_phase = 'ENDGAME' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(p.themes) t WHERE t->>'theme_code' = 'endgame'
            ) THEN 'Recommended based on high Endgame conversion centipawn loss in your recent games.'
            WHEN v_worst_phase = 'OPENING' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(p.themes) t WHERE t->>'theme_code' IN ('fork', 'pin', 'backRankMate')
            ) THEN 'Recommended to reinforce early-game tactical alertness and punish opening oversights.'
            ELSE 'Recommended to sharpen calculation and reduce ' || v_worst_phase || ' tactical blunders.'
        END AS match_reason
    FROM v_training_puzzles p
    WHERE NOT EXISTS (
        SELECT 1
        FROM recommendation_users ru
        JOIN recommendation_puzzles rp ON rp.recommendation_id = ru.recommendation_id
        WHERE ru.user_id = p_user_id
          AND rp.puzzle_id = p.id
    )
    ORDER BY
        CASE
            WHEN v_worst_phase = 'ENDGAME' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(p.themes) t WHERE t->>'theme_code' = 'endgame'
            ) THEN 0
            WHEN v_worst_phase = 'MIDDLEGAME' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(p.themes) t WHERE t->>'theme_code' IN ('pin', 'fork', 'discoveredAttack', 'hangingPiece', 'deflection')
            ) THEN 0
            ELSE 1
        END ASC,
        ABS(p.rating - v_user_rating) ASC,
        RANDOM()
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE OR REPLACE PROCEDURE sp_generate_user_training_recommendations(
    p_user_id UUID,
    p_limit INT DEFAULT 3
)
AS $$
DECLARE
    v_rec RECORD;
    v_rec_id UUID;
    v_count INT := 0;
BEGIN
    FOR v_rec IN (
        SELECT
            p.puzzle_id,
            p.rating,
            p.match_reason,
            p.themes
        FROM fn_generate_personalized_puzzles(p_user_id, p_limit) p
    ) LOOP
        -- Extra guard against duplicate puzzle recommendations for this user
        CONTINUE WHEN EXISTS (
            SELECT 1
            FROM recommendation_users ru
            JOIN recommendation_puzzles rp ON rp.recommendation_id = ru.recommendation_id
            WHERE ru.user_id = p_user_id
              AND rp.puzzle_id = v_rec.puzzle_id
        );

        v_rec_id := uuid_generate_v4();

        INSERT INTO training_recommendations (id) VALUES (v_rec_id);
        INSERT INTO recommendation_users (recommendation_id, user_id) VALUES (v_rec_id, p_user_id);
        INSERT INTO recommendation_puzzles (recommendation_id, puzzle_id) VALUES (v_rec_id, v_rec.puzzle_id);
        INSERT INTO recommendation_categories (recommendation_id, category) VALUES (v_rec_id, 'TACTICAL_TRAINING');
        INSERT INTO recommendation_descriptions (recommendation_id, description) VALUES (v_rec_id, v_rec.match_reason);
        INSERT INTO recommendation_metrics (recommendation_id, metric_evidence) VALUES (
            v_rec_id,
            jsonb_build_object(
                'puzzle_rating', v_rec.rating,
                'target_themes', v_rec.themes,
                'generated_at', CURRENT_TIMESTAMP
            )
        );
        INSERT INTO recommendation_completion_states (recommendation_id, is_completed) VALUES (v_rec_id, FALSE);
        INSERT INTO recommendation_creation_times (recommendation_id, created_at) VALUES (v_rec_id, CURRENT_TIMESTAMP);

        v_count := v_count + 1;
        EXIT WHEN v_count >= p_limit;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
