-- ============================================================================
-- ChessIQ v3.3.0 — Migration 001: Master Sixth Normal Form (6NF) Relational DDL
-- Target Engine: PostgreSQL 16.x / 17.x
-- Role: Abhijit Saha — Project Lead & Database Architect (@DB)
-- 
-- Theoretical Grounding:
-- Complete decomposition into irreducible binary relations (at most one non-key
-- attribute per physical table) with temporal validities enforced via native
-- tstzrange and GiST exclusion constraints (btree_gist).
-- ============================================================================

-- Ensure Required Core Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- 1. USERS DOMAIN (Binary 6NF Decomposed)
-- ============================================================================

-- User Existence Anchor (Identifier Relation)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- User Email (Binary 6NF)
CREATE TABLE IF NOT EXISTS user_emails (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_user_emails_email ON user_emails(email);

-- User Username (Binary 6NF)
CREATE TABLE IF NOT EXISTS user_usernames (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_user_usernames_username ON user_usernames(username);

-- User Password Hash (Binary 6NF)
CREATE TABLE IF NOT EXISTS user_password_hashes (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL
);

-- User Chess Rating with Temporal Validity Interval (Temporal 6NF)
CREATE TABLE IF NOT EXISTS user_ratings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chess_rating INT NOT NULL CHECK (chess_rating >= 100 AND chess_rating <= 4000),
    valid_during TSTZRANGE NOT NULL DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL, '[)'),
    EXCLUDE USING gist (user_id WITH =, valid_during WITH &&)
);
CREATE INDEX IF NOT EXISTS idx_user_ratings_temporal ON user_ratings USING gist (user_id, valid_during);

-- User Creation Timestamp (Binary 6NF)
CREATE TABLE IF NOT EXISTS user_created_at (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User Update Timestamp (Binary 6NF)
CREATE TABLE IF NOT EXISTS user_updated_at (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. CHESS OPENINGS CATALOG (Reference Domain)
-- ============================================================================

-- Opening Existence Anchor (ECO Code Primary Key)
CREATE TABLE IF NOT EXISTS chess_openings (
    eco_code VARCHAR(3) PRIMARY KEY -- e.g., 'B20', 'C50'
);

-- Opening Common Name (Binary 6NF)
CREATE TABLE IF NOT EXISTS chess_opening_names (
    eco_code VARCHAR(3) PRIMARY KEY REFERENCES chess_openings(eco_code) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chess_opening_names_name ON chess_opening_names(name);

-- Opening Variation (Binary 6NF, Optional)
CREATE TABLE IF NOT EXISTS chess_opening_variations (
    eco_code VARCHAR(3) PRIMARY KEY REFERENCES chess_openings(eco_code) ON DELETE RESTRICT,
    variation VARCHAR(100) NOT NULL
);

-- Opening Canonical PGN Moves (Binary 6NF)
CREATE TABLE IF NOT EXISTS chess_opening_pgn_moves (
    eco_code VARCHAR(3) PRIMARY KEY REFERENCES chess_openings(eco_code) ON DELETE RESTRICT,
    pgn_moves TEXT NOT NULL
);

-- ============================================================================
-- 3. GAMES DOMAIN (Binary 6NF Decomposed)
-- ============================================================================

-- Game Existence Anchor (Identifier Relation)
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Game User Owner (Binary 6NF)
CREATE TABLE IF NOT EXISTS game_users (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_game_users_user ON game_users(user_id);

-- Game ECO Code (Binary 6NF, Optional Reference)
CREATE TABLE IF NOT EXISTS game_ecos (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    eco_code VARCHAR(3) REFERENCES chess_openings(eco_code) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_game_ecos_eco ON game_ecos(eco_code);

-- Game White Player Name (Binary 6NF)
CREATE TABLE IF NOT EXISTS game_white_players (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    white_player VARCHAR(100) NOT NULL
);

-- Game Black Player Name (Binary 6NF)
CREATE TABLE IF NOT EXISTS game_black_players (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    black_player VARCHAR(100) NOT NULL
);

-- Game White Elo Rating (Binary 6NF, Optional)
CREATE TABLE IF NOT EXISTS game_white_elos (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    white_elo INT CHECK (white_elo >= 100 AND white_elo <= 4000)
);

-- Game Black Elo Rating (Binary 6NF, Optional)
CREATE TABLE IF NOT EXISTS game_black_elos (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    black_elo INT CHECK (black_elo >= 100 AND black_elo <= 4000)
);

-- Game Result (Binary 6NF)
CREATE TABLE IF NOT EXISTS game_results (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    result VARCHAR(10) NOT NULL CHECK (result IN ('1-0', '0-1', '1/2-1/2', '*'))
);

-- Game User Played Color (Binary 6NF)
CREATE TABLE IF NOT EXISTS game_user_colors (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    user_color VARCHAR(5) NOT NULL CHECK (user_color IN ('WHITE', 'BLACK'))
);

-- Game Played Timestamp (Binary 6NF)
CREATE TABLE IF NOT EXISTS game_played_at (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    played_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_game_played_at_time ON game_played_at(played_at DESC);

-- Game Raw PGN Content (Binary 6NF)
CREATE TABLE IF NOT EXISTS game_pgn_raws (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    pgn_raw TEXT NOT NULL
);

-- Game Move Signature Hash (Binary 6NF, Canonical SHA-256 for Deduplication)
CREATE TABLE IF NOT EXISTS game_move_signatures (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    move_signature VARCHAR(64) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_game_move_signatures_hash ON game_move_signatures(move_signature);

-- Deduplication Junction Table: User + Move Signature Uniqueness
CREATE TABLE IF NOT EXISTS user_game_move_signatures (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    move_signature VARCHAR(64) NOT NULL,
    PRIMARY KEY (user_id, move_signature)
);
CREATE INDEX IF NOT EXISTS idx_user_game_move_sig_hash ON user_game_move_signatures(move_signature);

-- Game Creation Timestamp (Binary 6NF)
CREATE TABLE IF NOT EXISTS game_created_at (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. GAME ANALYSIS JOBS DOMAIN (Asynchronous Queue & Concurrency, Binary 6NF)
-- Strict 3NF/BCNF: user_id is NOT stored here; resolved via game_users(game_id)
-- ============================================================================

-- Job Existence Anchor
CREATE TABLE IF NOT EXISTS game_analysis_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Job Game Reference (Binary 6NF)
CREATE TABLE IF NOT EXISTS job_games (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_job_games_game ON job_games(game_id);

-- Job Status with Temporal Interval Validity (Temporal 6NF)
CREATE TABLE IF NOT EXISTS job_statuses (
    job_id UUID NOT NULL REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    valid_during TSTZRANGE NOT NULL DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL, '[)'),
    EXCLUDE USING gist (job_id WITH =, valid_during WITH &&)
);
CREATE INDEX IF NOT EXISTS idx_job_statuses_temporal ON job_statuses USING gist (job_id, valid_during);
CREATE INDEX IF NOT EXISTS idx_job_statuses_active ON job_statuses(job_id, status) WHERE upper(valid_during) IS NULL;

-- Job Current Ply Progress (Binary 6NF)
CREATE TABLE IF NOT EXISTS job_current_plies (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    current_ply INT NOT NULL DEFAULT 0 CHECK (current_ply >= 0)
);

-- Job Total Plies (Binary 6NF)
CREATE TABLE IF NOT EXISTS job_total_plies (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    total_plies INT NOT NULL DEFAULT 0 CHECK (total_plies >= 0)
);

-- Job Attempt Count (Binary 6NF)
CREATE TABLE IF NOT EXISTS job_attempt_counts (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0)
);

-- Job Maximum Retries (Binary 6NF)
CREATE TABLE IF NOT EXISTS job_max_retries (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    max_retries INT NOT NULL DEFAULT 3 CHECK (max_retries >= 0)
);

-- Job Fencing Claim Token (Binary 6NF, Optional — Active Leases Only)
CREATE TABLE IF NOT EXISTS job_claim_tokens (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    claim_token UUID NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_job_claim_tokens_token ON job_claim_tokens(claim_token);

-- Job Locked By Worker ID (Binary 6NF, Optional)
CREATE TABLE IF NOT EXISTS job_locked_by (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    locked_by VARCHAR(100) NOT NULL
);

-- Job Locked Timestamp (Binary 6NF, Optional)
CREATE TABLE IF NOT EXISTS job_locked_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    locked_at TIMESTAMPTZ NOT NULL
);

-- Job Heartbeat Timestamp (Binary 6NF, Optional — Polled by Circuit Breaker)
CREATE TABLE IF NOT EXISTS job_heartbeat_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    heartbeat_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_job_heartbeat_time ON job_heartbeat_at(heartbeat_at);

-- Job Started Timestamp (Binary 6NF, Optional)
CREATE TABLE IF NOT EXISTS job_started_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL
);

-- Job Completed Timestamp (Binary 6NF, Optional)
CREATE TABLE IF NOT EXISTS job_completed_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL
);

-- Job Last Error Message (Binary 6NF, Optional — Zero-NULL)
CREATE TABLE IF NOT EXISTS job_last_errors (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    last_error TEXT NOT NULL
);

-- Job Creation Timestamp (Binary 6NF — Used for FIFO Queue Ordering)
CREATE TABLE IF NOT EXISTS job_created_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_job_created_at_time ON job_created_at(created_at ASC);

-- Job Update Timestamp (Binary 6NF)
CREATE TABLE IF NOT EXISTS job_updated_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. GAME ANALYSES DOMAIN (Aggregate Metrics, Binary 6NF)
-- ============================================================================

-- Analysis Existence Anchor
CREATE TABLE IF NOT EXISTS game_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Analysis Game Link (Binary 6NF)
CREATE TABLE IF NOT EXISTS game_analysis_games (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    game_id UUID NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_game_analysis_games_game ON game_analysis_games(game_id);

-- White Average Centipawn Loss (Binary 6NF)
CREATE TABLE IF NOT EXISTS analysis_white_acpls (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    white_acpl INT NOT NULL CHECK (white_acpl >= 0)
);

-- Black Average Centipawn Loss (Binary 6NF)
CREATE TABLE IF NOT EXISTS analysis_black_acpls (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    black_acpl INT NOT NULL CHECK (black_acpl >= 0)
);

-- White Blunders Count (Binary 6NF)
CREATE TABLE IF NOT EXISTS analysis_white_blunders (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    white_blunders INT NOT NULL DEFAULT 0 CHECK (white_blunders >= 0)
);

-- White Mistakes Count (Binary 6NF)
CREATE TABLE IF NOT EXISTS analysis_white_mistakes (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    white_mistakes INT NOT NULL DEFAULT 0 CHECK (white_mistakes >= 0)
);

-- White Inaccuracies Count (Binary 6NF)
CREATE TABLE IF NOT EXISTS analysis_white_inaccuracies (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    white_inaccuracies INT NOT NULL DEFAULT 0 CHECK (white_inaccuracies >= 0)
);

-- Black Blunders Count (Binary 6NF)
CREATE TABLE IF NOT EXISTS analysis_black_blunders (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    black_blunders INT NOT NULL DEFAULT 0 CHECK (black_blunders >= 0)
);

-- Black Mistakes Count (Binary 6NF)
CREATE TABLE IF NOT EXISTS analysis_black_mistakes (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    black_mistakes INT NOT NULL DEFAULT 0 CHECK (black_mistakes >= 0)
);

-- Black Inaccuracies Count (Binary 6NF)
CREATE TABLE IF NOT EXISTS analysis_black_inaccuracies (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    black_inaccuracies INT NOT NULL DEFAULT 0 CHECK (black_inaccuracies >= 0)
);

-- Analysis Engine Depth (Binary 6NF)
CREATE TABLE IF NOT EXISTS analysis_engine_depths (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    engine_depth INT NOT NULL CHECK (engine_depth >= 1 AND engine_depth <= 32)
);

-- Analysis Completion Flag (Binary 6NF)
CREATE TABLE IF NOT EXISTS analysis_completion_flags (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    is_completed BOOLEAN NOT NULL DEFAULT TRUE
);

-- Analysis Completed Timestamp (Binary 6NF)
CREATE TABLE IF NOT EXISTS analysis_completed_at (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. MOVE ANALYSES DOMAIN (Per-Ply Evaluations, Binary 6NF)
-- Strict Normalization: 'color' is eliminated (derived dynamically via ply_number)
-- ============================================================================

-- Move Existence Anchor
CREATE TABLE IF NOT EXISTS move_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Move Analysis Parent Link (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_analysis_parents (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES game_analyses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_move_analysis_parents_parent ON move_analysis_parents(analysis_id);

-- Move Ply Number (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_plies (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    ply_number INT NOT NULL CHECK (ply_number >= 1)
);

-- Move Analysis Ply Composite Uniqueness (Binary Relationship 6NF)
CREATE TABLE IF NOT EXISTS move_analysis_plies (
    analysis_id UUID NOT NULL REFERENCES game_analyses(id) ON DELETE CASCADE,
    ply_number INT NOT NULL CHECK (ply_number >= 1),
    move_id UUID NOT NULL UNIQUE REFERENCES move_analyses(id) ON DELETE CASCADE,
    PRIMARY KEY (analysis_id, ply_number)
);
CREATE INDEX IF NOT EXISTS idx_move_analysis_plies_lookup ON move_analysis_plies(analysis_id, ply_number);

-- Move Number (Full Move, Binary 6NF)
CREATE TABLE IF NOT EXISTS move_numbers (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    move_number INT NOT NULL CHECK (move_number >= 1)
);

-- Move Standard Algebraic Notation (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_sans (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    move_san VARCHAR(10) NOT NULL
);

-- Move Universal Chess Interface Notation (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_ucis (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    move_uci VARCHAR(10) NOT NULL
);

-- Move FEN Before (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_fen_befores (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    fen_before VARCHAR(100) NOT NULL
);

-- Move FEN After (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_fen_afters (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    fen_after VARCHAR(100) NOT NULL
);

-- Raw Evaluation Type (Binary 6NF: 'cp' | 'mate')
CREATE TABLE IF NOT EXISTS move_raw_eval_types (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    raw_eval_type VARCHAR(10) NOT NULL CHECK (raw_eval_type IN ('cp', 'mate'))
);

-- Raw Evaluation Value (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_raw_eval_values (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    raw_eval_value INT NOT NULL
);

-- Centipawn Evaluation (Binary 6NF, Optional — Zero-NULL: row absent if mate)
CREATE TABLE IF NOT EXISTS move_eval_centipawns (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    eval_centipawns INT NOT NULL
);

-- Mate Evaluation (Binary 6NF, Optional — Zero-NULL: row absent if cp)
CREATE TABLE IF NOT EXISTS move_eval_mates (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    eval_mate INT NOT NULL
);

-- Raw Centipawn Loss (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_cpl_raws (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    cpl_raw INT NOT NULL CHECK (cpl_raw >= 0)
);

-- Capped Centipawn Loss (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_cpl_capped (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    cpl_capped INT NOT NULL DEFAULT 0 CHECK (cpl_capped >= 0 AND cpl_capped <= 1000)
);

-- Logistic Win Probability (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_win_probabilities (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    win_probability NUMERIC(5, 4) NOT NULL CHECK (win_probability >= 0.0000 AND win_probability <= 1.0000)
);

-- Win Probability Delta (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_win_prob_deltas (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    win_prob_delta NUMERIC(5, 4) NOT NULL DEFAULT 0.0000
);

-- Best Engine Move UCI (Binary 6NF, Optional — Zero-NULL: row absent if timeout)
CREATE TABLE IF NOT EXISTS move_best_ucis (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    best_move_uci VARCHAR(10) NOT NULL
);

-- Mistake Classification Tier (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_mistake_types (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    mistake_type VARCHAR(20) NOT NULL DEFAULT 'BEST'
        CHECK (mistake_type IN ('BEST', 'GOOD', 'INACCURACY', 'MISTAKE', 'BLUNDER', 'MISSED_WIN'))
);
CREATE INDEX IF NOT EXISTS idx_move_mistakes ON move_mistake_types(mistake_type);

-- Game Phase Classification (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_phases (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    game_phase VARCHAR(15) NOT NULL DEFAULT 'OPENING'
        CHECK (game_phase IN ('OPENING', 'MIDDLEGAME', 'ENDGAME'))
);
CREATE INDEX IF NOT EXISTS idx_move_phases ON move_phases(game_phase);

-- Principal Variation Line (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_pv_lines (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    pv_line JSONB NOT NULL
);

-- Catalog Opening Book Move Indicator (Binary 6NF)
CREATE TABLE IF NOT EXISTS move_is_book_moves (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    is_book_move BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_move_is_book_moves_flag ON move_is_book_moves(is_book_move);

-- ============================================================================
-- 7. TRAINING PUZZLES & RECOMMENDATIONS DOMAIN (1NF & 6NF Normalized)
-- ============================================================================

-- Puzzle Existence Anchor
CREATE TABLE IF NOT EXISTS training_puzzles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Puzzle FEN (Binary 6NF)
CREATE TABLE IF NOT EXISTS puzzle_fens (
    puzzle_id UUID PRIMARY KEY REFERENCES training_puzzles(id) ON DELETE CASCADE,
    fen VARCHAR(100) NOT NULL
);

-- Puzzle Moves (Binary 6NF)
CREATE TABLE IF NOT EXISTS puzzle_moves (
    puzzle_id UUID PRIMARY KEY REFERENCES training_puzzles(id) ON DELETE CASCADE,
    moves VARCHAR(255) NOT NULL
);

-- Puzzle Difficulty Rating (Binary 6NF)
CREATE TABLE IF NOT EXISTS puzzle_ratings (
    puzzle_id UUID PRIMARY KEY REFERENCES training_puzzles(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 400 AND rating <= 3200)
);
CREATE INDEX IF NOT EXISTS idx_puzzle_ratings_rating ON puzzle_ratings(rating);

-- Puzzle Created Timestamp (Binary 6NF)
CREATE TABLE IF NOT EXISTS puzzle_created_times (
    puzzle_id UUID PRIMARY KEY REFERENCES training_puzzles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 1NF Decomposition: Theme Catalog Table
CREATE TABLE IF NOT EXISTS puzzle_theme_types (
    theme_code VARCHAR(30) PRIMARY KEY, -- e.g., 'pin', 'fork', 'backRankMate', 'endgame'
    description TEXT NOT NULL
);

-- 1NF Decomposition: Theme Associative Junction Table (Binary 6NF Relationship)
CREATE TABLE IF NOT EXISTS puzzle_themes (
    puzzle_id UUID NOT NULL REFERENCES training_puzzles(id) ON DELETE CASCADE,
    theme_code VARCHAR(30) NOT NULL REFERENCES puzzle_theme_types(theme_code) ON DELETE RESTRICT,
    PRIMARY KEY (puzzle_id, theme_code)
);
CREATE INDEX IF NOT EXISTS idx_puzzle_themes_code ON puzzle_themes(theme_code);

-- Recommendation Existence Anchor
CREATE TABLE IF NOT EXISTS training_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Recommendation User Link (Binary 6NF)
CREATE TABLE IF NOT EXISTS recommendation_users (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_recommendation_users_user ON recommendation_users(user_id);

-- Recommendation Puzzle Link (Binary 6NF, Optional)
CREATE TABLE IF NOT EXISTS recommendation_puzzles (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    puzzle_id UUID REFERENCES training_puzzles(id) ON DELETE SET NULL
);

-- Recommendation Category (Binary 6NF)
CREATE TABLE IF NOT EXISTS recommendation_categories (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL
);

-- Recommendation Description (Binary 6NF)
CREATE TABLE IF NOT EXISTS recommendation_descriptions (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    description TEXT NOT NULL
);

-- Recommendation Metric Evidence (Binary 6NF)
CREATE TABLE IF NOT EXISTS recommendation_metrics (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    metric_evidence JSONB NOT NULL
);

-- Recommendation Completion State (Binary 6NF)
CREATE TABLE IF NOT EXISTS recommendation_completion_states (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Recommendation Creation Timestamp (Binary 6NF)
CREATE TABLE IF NOT EXISTS recommendation_creation_times (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. ASYNCHRONOUS REACTIVE NOTIFY TRIGGER (PostgreSQL LISTEN/NOTIFY)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_notify_new_analysis_job()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('new_analysis_job', NEW.job_id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_new_analysis_job ON job_statuses;
CREATE TRIGGER trg_notify_new_analysis_job
    AFTER INSERT ON job_statuses
    FOR EACH ROW
    WHEN (NEW.status = 'pending' AND upper(NEW.valid_during) IS NULL)
    EXECUTE FUNCTION fn_notify_new_analysis_job();
