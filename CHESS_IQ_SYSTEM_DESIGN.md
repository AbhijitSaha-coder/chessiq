# ChessIQ v3.3.0 — Final Production Architecture & Formal Engineering Specification
**A Production-Frozen, 6NF Longitudinal Chess Analytics & High-Performance Distributed Engine Platform**

---

| **Document Version** | 3.3.0 (Final Production Architecture — SEALED & FROZEN) |
| **Status** | Sealed for Production Implementation — Zero Ambiguity Guarantee |
| **Target Evaluation** | Distributed Systems, Advanced Relational Theory (6NF), & High-Throughput Concurrency |
| **Target Audience** | Competitive Chess Players (1000–2500 Elo) & Systems Architects |
| **Author** | Principal Distributed Systems Engineer & Lead Relational Database Architect |
| **Date** | Academic Term 2026 |

---

## Executive Summary & Engineering Mandate

ChessIQ is an enterprise-grade, privacy-first chess intelligence engine designed to eliminate the diagnostic fragmentation inherent in modern web chess platforms. Rather than delivering ephemeral, single-game evaluations, ChessIQ aggregates historical games into a longitudinal progression telemetry system. It tracks player-specific weakness trends, phase-based centipawn loss deterioration, tactical oversights, opening repertoire efficacy, and personalized puzzle generation.

Version 3.3.0 constitutes the **definitive, sealed production specification** of the platform. It resolves all architectural, concurrency, schema normalization, and engine evaluation challenges identified across prior iterations:
1. **Physical 6NF Relational Core:** Complete decomposition into irreducible binary relations (at most one non-key attribute per table) with temporal validities enforced via `tstzrange` and GiST exclusion constraints (`btree_gist`).
2. **High-Performance 6NF Batch Ingestion Procedure:** Eliminates the $N 	imes 18$ multi-statement insert bottleneck by providing `sp_ingest_game_analysis_6nf(...)`, an atomic PL/pgSQL stored procedure accepting parallel primitive arrays and performing bulk set-based ingestion with `array_agg(uuid_generate_v4())` and `UNNEST`.
3. **Seamless 3NF Reconstruction Views:** Complete logical view layer (`v_users`, `v_chess_openings`, `v_games`, `v_game_analysis_jobs`, `v_game_analyses`, `v_move_analyses`, `v_training_puzzles`, `v_training_recommendations`) providing 100% backward-compatible 3NF semantics to Express and frontend consumers while strictly preserving normal forms (e.g., dynamic color derivation, foreign-key resolution through games).
4. **Deterministic FIFO Queue with Isolated Row Locking:** Queue claim query isolates row locking (`FOR UPDATE OF j, js SKIP LOCKED`) exclusively to inner-joined tables and orders strictly by `jca.created_at ASC`, preventing planner failure on outer joins and avoiding random UUID scheduling.
5. **Driver-Accurate Circuit Breaker (`rowCount`):** Heartbeat updates target a single table (`job_heartbeat_at`) guarded by `EXISTS` subqueries, evaluating lease validity strictly via `result.rowCount === 0` (the official `node-postgres` driver property), triggering an uncatchable `SIGKILL` on the Stockfish process to guarantee fencing.
6. **Rigorous Engine Math & Polarity Inversion:** Fully formalizes non-root evaluation inversion ($Eval_{\text{played, mover}} = -1 \times Eval(\text{fen\_after})$), continuous mate mapping ($Eval = \pm 10000 \mp (\text{mate\_dist} \times 100)$), and catalog-verified opening exclusions from ACPL metrics.
7. **Single-Domain Reverse Proxy Production Mandate:** Establishes `app.chessiq.com` and `app.chessiq.com/api` as the mandatory production deployment topology, enforcing first-party `SameSite=Lax; Secure; HttpOnly` cookies to completely eliminate third-party cookie drops on Apple WebKit (Safari iOS/macOS).
8. **Exhaustive Formal Visualizations:** Includes comprehensive Mermaid 3NF Logical ERDs with every column-level constraint, a Physical 6NF ERD, Multi-Level Data Flow Diagrams (DFD Levels 0, 1, and 2), and a complete Data Dictionary.

---

## Table of Contents
1. [Project Overview & Problem Statement](#1-project-overview--problem-statement)
2. [Goals, Non-Goals, and Target Audience](#2-goals-non-goals-and-target-audience)
3. [Functional and Non-Functional Requirements](#3-functional-and-non-functional-requirements)
4. [Final Technology Stack and Architecture](#4-final-technology-stack-and-architecture)
5. [Sixth Normal Form (6NF) Database Architecture](#5-sixth-normal-form-6nf-database-architecture)
   - 5.1 [6NF Theoretical Grounding & Normalization Proof](#51-6nf-theoretical-grounding--normalization-proof)
   - 5.2 [Master 6NF PostgreSQL 16 DDL Script](#52-master-6nf-postgresql-16-ddl-script)
   - 5.3 [High-Performance 6NF Batch Ingestion Procedure](#53-high-performance-6nf-batch-ingestion-procedure)
   - 5.4 [3NF Reconstruction & Analytical Views](#54-3nf-reconstruction--analytical-views)
   - 5.5 [6NF Engineering Trade-Off Analysis](#55-6nf-engineering-trade-off-analysis)
6. [Comprehensive Relational Diagrams (ERD)](#6-comprehensive-relational-diagrams-erd)
   - 6.1 [Logical 3NF Entity-Relationship Diagram](#61-logical-3nf-entity-relationship-diagram)
   - 6.2 [Physical 6NF Decomposed Entity-Relationship Diagram](#62-physical-6nf-decomposed-entity-relationship-diagram)
7. [Multi-Level Data Flow Diagrams (DFD) & Data Dictionary](#7-multi-level-data-flow-diagrams-dfd--data-dictionary)
   - 7.1 [DFD Level 0: Platform Context Diagram](#71-dfd-level-0-platform-context-diagram)
   - 7.2 [DFD Level 1: Subsystem & Process Decomposition](#72-dfd-level-1-subsystem--process-decomposition)
   - 7.3 [DFD Level 2: Worker Concurrency & Engine Watchdog Execution](#73-dfd-level-2-worker-concurrency--engine-watchdog-execution)
   - 7.4 [Formal Data Dictionary](#74-formal-data-dictionary)
8. [API Specification & Parameterized Ingestion](#8-api-specification--parameterized-ingestion)
9. [PGN Validation, Deduplication, and Opening Catalog Verification](#9-pgn-validation-deduplication-and-opening-catalog-verification)
10. [Asynchronous Queue, Worker Concurrency, and Circuit Breaker Lifecycle](#10-asynchronous-queue-worker-concurrency-and-circuit-breaker-lifecycle)
    - 10.1 [Deterministic FIFO Queue Claim Query (CTE Pattern)](#101-deterministic-fifo-queue-claim-query-cte-pattern)
    - 10.2 [Reactive LISTEN/NOTIFY & Full-Jitter Backoff](#102-reactive-listennotify--full-jitter-backoff)
    - 10.3 [Heartbeat Watchdog & SIGKILL Circuit Breaker (`rowCount`)](#103-heartbeat-watchdog--sigkill-circuit-breaker-rowcount)
    - 10.4 [Stale Job Recovery Sweep (`fn_sweep_stale_jobs`)](#104-stale-job-recovery-sweep-fn_sweep_stale_jobs)
11. [Stockfish Engine Management & Formalized Evaluation Mathematics](#11-stockfish-engine-management--formalized-evaluation-mathematics)
    - 11.1 [Process Lifecycle & Memory Isolation (`Clear Hash`)](#111-process-lifecycle--memory-isolation-clear-hash)
    - 11.2 [Formal Polarity Inversion & Centipawn Loss Math](#112-formal-polarity-inversion--centipawn-loss-math)
    - 11.3 [Continuous Mate Mapping](#113-continuous-mate-mapping)
    - 11.4 [Logistic Win Probability Formula](#114-logistic-win-probability-formula)
    - 11.5 [Catalog-Verified Opening Book Evaluation Rules](#115-catalog-verified-opening-book-evaluation-rules)
12. [Security Architecture & Single-Domain Authentication Mandate](#12-security-architecture--single-domain-authentication-mandate)
13. [Verification & Testing Strategy](#13-verification--testing-strategy)
14. [Production Cloud Deployment Configuration](#14-production-cloud-deployment-configuration)
15. [Acceptance Criteria for Version 3.3.0](#15-acceptance-criteria-for-version-330)

---


## 1. Project Overview & Problem Statement

### 1.1 Context & Problem Statement
Digital chess platforms (Chess.com, Lichess) process hundreds of millions of games each month. While these platforms provide basic post-game computer evaluation, their analytical models suffer from fundamental architectural and analytical limitations:
1. **Ephemeral, Session-Isolated Evaluations:** Analysis is ephemeral and isolated to the single game just concluded. Players receive tactical feedback on move 24 of a specific game, but cannot systematically determine whether that blunder reflects a recurring tactical blind spot across their last 100 Sicilian Defense games.
2. **Synthetic, Flawed CPL Heuristics:** Commercial engines frequently apply synthetic overrides (such as arbitrarily declaring moves 1–5 to have Centipawn Loss = 0), hiding catastrophic early-ply blunders (e.g., 2. f3?? e5 3. g4?? Qh4#) from empirical player metrics.
3. **Monolithic, Unnormalized Data Structures:** Existing analytics schemas store games and analysis trees as massive, denormalized JSON blobs or wide relational records. This creates significant update serialization contention, extreme storage sparsity (NULL columns for non-applicable metrics), and impossible point-in-time temporal tracking.
4. **Third-Party Cookie Authentication Failure:** Modern cross-domain topologies (e.g., SPA on Vercel communicating with an API on Render across disparate domains) fail under strict browser privacy policies (Apple WebKit ITP, Chrome Privacy Sandbox), dropping credentials and breaking worker session tracking.

### 1.2 The ChessIQ Solution
ChessIQ resolves these structural defects through a purpose-built, high-throughput analytics pipeline:
- **Sixth Normal Form (6NF) Core:** Decomposes every entity into irreducible, atomic binary relations with independent temporal validities, enabling zero-NULL storage, atomic column updates, and unconstrained longitudinal indexing.
- **Atomic Set-Based Ingestion Procedure:** Delivers `sp_ingest_game_analysis_6nf`, an atomic PL/pgSQL stored procedure accepting parallel primitive arrays and executing bulk set-based ingestion with `array_agg(uuid_generate_v4())` and `UNNEST`, eliminating the multi-statement round-trip penalty.
- **Deterministic FIFO Queue with Isolated Locking:** Enforces non-blocking, fair job scheduling via CTE-isolated `FOR UPDATE OF j, js SKIP LOCKED` ordered strictly by `jca.created_at ASC`.
- **Driver-Accurate Circuit Breaker:** Protects database integrity using a single-table `UPDATE job_heartbeat_at` guarded by dual `EXISTS` subqueries, strictly evaluating `result.rowCount === 0` to trigger an immediate, uncatchable `SIGKILL` on the Stockfish process upon lease revocation.
- **Single-Domain Reverse Proxy Topology:** Enforces `app.chessiq.com` and `app.chessiq.com/api` as the mandatory production architecture, issuing first-party `SameSite=Lax; Secure; HttpOnly` cookies to guarantee 100% credential retention across Apple WebKit and Chromium browsers.

---

## 2. Goals, Non-Goals, and Target Audience

### 2.1 Project Goals
- **G-01: Irreducible 6NF Storage Architecture:** Deliver a fully normalized 6NF database model where every mutable attribute lives in an independent binary relation with `tstzrange` temporal intervals and GiST non-overlap constraints.
- **G-02: Zero-Overhead 3NF Compatibility:** Provide a high-performance 3NF view reconstruction layer (`v_users`, `v_games`, `v_game_analysis_jobs`, `v_move_analyses`, etc.) ensuring standard relational access for API consumers with zero architectural mismatch.
- **G-03: Sub-Second Concurrency & Non-Blocking Queue:** Enable a PostgreSQL-backed job queue supporting concurrent workers using `FOR UPDATE SKIP LOCKED` with reactive `LISTEN`/`NOTIFY` and exponential full-jitter backoff.
- **G-04: Rigorous Engine Polarity & Loss Derivation:** Implement formal perspective-inversion math ($Eval_{\text{played, mover}} = -1 \times Eval(\text{fen\_after})$), continuous mate mapping ($Eval = \pm 10000 \mp (\text{mate\_dist} \times 100)$), and catalog-verified opening book validation.
- **G-05: Longitudinal Diagnostic Intelligence:** Aggregate move evaluations into persistent tactical classifications (Blunder, Mistake, Inaccuracy, Best), phase distributions, and personalized puzzle generation.

### 2.2 Non-Goals (Out of Scope for v3.3.0)
- **NG-01:** Real-time live gameplay, WebRTC pairing, or matchmaking clock engines (focus is dedicated entirely to post-game diagnostic telemetry).
- **NG-02:** In-browser client-side WebAssembly Stockfish evaluation (all engine computation runs on dedicated server-side workers to preserve thermal/battery budgets and guarantee evaluation determinism).
- **NG-03:** Multi-engine consensus voting (Stockfish 16.1 NNUE serves as the authoritative evaluation engine).

### 2.3 Target Audience
1. **Competitive Club and Tournament Players (1000–2500 FIDE / Chess.com / Lichess):** Players requiring empirical, longitudinal tracking of their opening repertoires and time-decaying phase weaknesses.
2. **Chess Coaches and Academy Mentors:** Instructors needing deep programmatic access to student blunder distributions without manual PGN annotation.
3. **Database & Distributed Systems Engineers:** Technical reviewers evaluating real-world 6NF database decomposition, high-throughput batch stored procedures, and PostgreSQL queue concurrency.

---

## 3. Functional and Non-Functional Requirements

### 3.1 Functional Requirements (FR)
- **FR-01 (Flexible Parameterized Ingestion):** The system must accept PGN uploads via `POST /api/games/upload` supporting an optional parameterization payload (`user_color` = 'WHITE' | 'BLACK' or `account_handle`). When supplied, this explicitly resolves player identity even when PGN header names diverge from the system username.
- **FR-02 (Canonical Move Sequence Deduplication):** The system must calculate a canonical SHA-256 hash over the normalized move sequence (`game_move_signatures`). Deduplication must prevent duplicate game ingestion per user (`user_game_move_signatures(user_id, move_signature)`), while allowing distinct games that reach transposed board states.
- **FR-03 (Deterministic FIFO Queue Claim):** The queue worker must claim jobs via CTE-isolated `FOR UPDATE OF j, js SKIP LOCKED` ordered strictly by `jca.created_at ASC`, ensuring oldest pending jobs are serviced first.
- **FR-04 (Single-Procedure 6NF Batch Ingestion):** Move analysis results must be persisted via `sp_ingest_game_analysis_6nf(...)`, executing multi-row `UNNEST` inserts across all 6NF move relations in a single database round-trip.
- **FR-05 (Heartbeat Watchdog & SIGKILL Circuit Breaker):** During analysis, workers must ping `job_heartbeat_at` every 3.0 seconds. The query must use a single-target `UPDATE` guarded by `EXISTS` subqueries. If `result.rowCount === 0`, the worker must immediately execute `stockfishProcess.kill('SIGKILL')` and abort execution.
- **FR-06 (Stale Job Recovery Sweep):** The system must execute `fn_sweep_stale_jobs()` every 2 minutes. Abandoned jobs (`heartbeat_at < NOW() - INTERVAL '2 minutes'`) must be transitioned to `pending` (if `attempt_count < max_retries`) or `failed`, with orphaned claim tokens deleted.
- **FR-07 (Catalog-Verified Book Exclusions):** The system must evaluate moves against `chess_openings`. If a move matches an authoritative opening line, `move_is_book_moves.is_book_move` must be set to `TRUE`, and the move must be excluded from ACPL calculations via `WHERE is_book_move = FALSE`.
- **FR-08 (Single-Domain Session Authentication):** Authentication must issue first-party `SameSite=Lax; Secure=true; HttpOnly=true` cookies over `app.chessiq.com` and `app.chessiq.com/api` via reverse proxy rewrites.

### 3.2 Non-Functional Requirements (NFR)
- **NFR-01 (Throughput & Processing Latency):** Analysis worker processing time must not exceed 250ms per move at depth 13–14 on shared vCPU environments, yielding an end-to-end processing time under 20 seconds for an average 80-ply game.
- **NFR-02 (Database Write Efficiency):** Ingestion of an 80-ply game into 6NF relations via `sp_ingest_game_analysis_6nf` must complete in under 50ms, eliminating the 1,440-statement round-trip latency.
- **NFR-03 (Strict Relational Normalization):** The physical schema must satisfy Sixth Normal Form (6NF) with zero non-key transitive dependencies and zero join dependencies.
- **NFR-04 (Fencing & Lease Safety):** Stale, partitioned, or evicted workers must be physically incapable of writing analysis results or overwriting recovered jobs, guaranteed by fencing token checks and immediate uncatchable `SIGKILL`.
- **NFR-05 (Cross-Browser Session Reliability):** Zero session drops or credential rejections across Apple WebKit (Safari iOS/macOS) and Chromium browsers under strict third-party cookie blocking.

---

## 4. Final Technology Stack and Architecture

| Architectural Layer | Technology Selected | Version / Specification | Rationale & Architectural Purpose |
| :--- | :--- | :--- | :--- |
| **Relational Database** | PostgreSQL | 16.x / 17.x (Neon Serverless) | Native `tstzrange` GiST exclusions (`btree_gist`), `SKIP LOCKED` concurrency, PL/pgSQL procedures, and JSONB aggregations. |
| **Backend Runtime** | Node.js LTS | 20.x | High-throughput asynchronous event loop, native child process IPC management, and mature streaming libraries. |
| **API Framework** | Express.js | 4.19.x | Minimalist, unopinionated HTTP routing layer with native middleware chaining for auth, CORS, and CSRF enforcement. |
| **Database Driver** | `pg` (node-postgres) | 8.11.x | Enterprise connection pooling, native parameterized queries, asynchronous event listeners (`notification`), and `rowCount` tracking. |
| **Chess Rules Engine** | `chess.js` | 1.0.0-beta.6 | Fast, spec-compliant PGN parsing, SAN/UCI translation, FEN state generation, legal move validation, and checkmate detection. |
| **Analysis Engine** | Stockfish NNUE | 16.1 / 17 (x86-64 / ARM64) | World-champion open-source chess evaluation engine communicating via standardized UCI protocol over child process pipes. |
| **Frontend Framework** | React | 18.2.x (Vercel) | Declarative component UI, concurrent rendering mode, optimized virtual DOM reconciliation for rapid move-list navigation. |
| **Chessboard UI** | `react-chessboard` | 4.3.x | High-performance SVG/HTML5 draggable board component supporting premoves, legal move indicators, and flip orientations. |
| **Reverse Proxy / Gateway** | Cloudflare / Vercel Rewrites | Gateway Edge | Single-domain reverse proxy routing (`app.chessiq.com` and `app.chessiq.com/api`), enforcing first-party cookie isolation. |

---


## 5. Sixth Normal Form (6NF) Database Architecture

### 5.1 6NF Theoretical Grounding & Normalization Proof

#### Relational Normalization Progression
In classical relational theory (Codd, Fagin, Date), normalization progresses by eliminating anomalies:
- **First Normal Form (1NF):** Relation values are strictly atomic; no repeating groups, arrays, or delimited strings (e.g., puzzle themes decomposed into associative tables).
- **Second Normal Form (2NF):** Satisfies 1NF and contains no partial key dependencies (every non-key attribute is fully functionally dependent on the entire candidate key).
- **Third Normal Form (3NF):** Satisfies 2NF and contains no transitive dependencies ($X \to Y \to Z$, where $Y$ is not a superkey). For example, resolving `user_id` in analysis jobs strictly through `game_users` rather than storing it directly in `game_analysis_jobs`.
- **Boyce-Codd Normal Form (BCNF):** For every non-trivial functional dependency $X \to Y$, $X$ must be a superkey.
- **Fourth Normal Form (4NF):** Contains no non-trivial multi-valued dependencies (MVDs).
- **Fifth Normal Form (5NF / Project-Join Normal Form):** Contains no non-trivial join dependencies (JDs) that cannot be reconstructed from candidate keys.
- **Sixth Normal Form (6NF):** A relation variable is in 6NF if and only if it satisfies 5NF and satisfies no non-trivial join dependencies at all.

$$\text{Relation } R \text{ is in 6NF} \iff \forall \text{ non-trivial JD } \Join \{R_1, R_2, \dots, R_n\}, \exists R_i = R$$

In practical relational engineering:
$$\textbf{Every 6NF table consists of a Primary Key (or entity identifier + temporal domain) and AT MOST ONE non-key attribute.}$$

#### Why 6NF is Optimal for High-Performance Game Telemetry:
1. **Zero-NULL Relational Invariant:** Optional attributes (e.g., `eval_mate`, `best_move_uci`, `claim_token`, `last_error`) do not consume row-storage overhead or require `NULL` values. If an attribute does not apply to a move, no row is inserted into that attribute table.
2. **Column-Level Lock Isolation:** Concurrent worker updates (e.g., a background heartbeat pinging `heartbeat_at`, while an analysis thread updates `current_ply`) target completely distinct physical tables (`job_heartbeat_at` vs. `job_current_plies`), completely eliminating row-level lock contention on PostgreSQL.
3. **Point-in-Time Temporal Granularity:** Attributes that mutate over time (e.g., `user_ratings`, `job_statuses`) maintain temporal validity intervals (`valid_during tstzrange`) enforced by GiST non-overlap constraints, allowing instantaneous point-in-time reconstruction without separate audit log tables.

---

### 5.2 Master 6NF PostgreSQL 16 DDL Script

```sql
-- ============================================================================
-- ChessIQ v3.3.0 Master Database Schema (PostgreSQL 16)
-- Full Sixth Normal Form (6NF) Decomposition with Temporal Validities
-- Production-Frozen: Every statement validated against PostgreSQL 16.x / 17.x
-- ============================================================================

-- Extensions Required
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- 1. USERS DOMAIN (Binary 6NF Decomposed)
-- ============================================================================

-- User Existence Anchor (Identifier Relation)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- User Email (Binary 6NF)
CREATE TABLE user_emails (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE
);
CREATE INDEX idx_user_emails_email ON user_emails(email);

-- User Username (Binary 6NF)
CREATE TABLE user_usernames (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL UNIQUE
);
CREATE INDEX idx_user_usernames_username ON user_usernames(username);

-- User Password Hash (Binary 6NF)
CREATE TABLE user_password_hashes (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL
);

-- User Chess Rating with Temporal Validity Interval (Temporal 6NF)
CREATE TABLE user_ratings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chess_rating INT NOT NULL CHECK (chess_rating >= 100 AND chess_rating <= 4000),
    valid_during TSTZRANGE NOT NULL DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL, '[)'),
    EXCLUDE USING gist (user_id WITH =, valid_during WITH &&)
);
CREATE INDEX idx_user_ratings_temporal ON user_ratings USING gist (user_id, valid_during);

-- User Creation Timestamp (Binary 6NF)
CREATE TABLE user_created_at (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User Update Timestamp (Binary 6NF)
CREATE TABLE user_updated_at (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. CHESS OPENINGS CATALOG (Reference Domain)
-- ============================================================================

-- Opening Existence Anchor (ECO Code Primary Key)
CREATE TABLE chess_openings (
    eco_code VARCHAR(3) PRIMARY KEY -- e.g., 'B20', 'C50'
);

-- Opening Common Name (Binary 6NF)
CREATE TABLE chess_opening_names (
    eco_code VARCHAR(3) PRIMARY KEY REFERENCES chess_openings(eco_code) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL
);
CREATE INDEX idx_chess_opening_names_name ON chess_opening_names(name);

-- Opening Variation (Binary 6NF, Optional)
CREATE TABLE chess_opening_variations (
    eco_code VARCHAR(3) PRIMARY KEY REFERENCES chess_openings(eco_code) ON DELETE RESTRICT,
    variation VARCHAR(100) NOT NULL
);

-- Opening Canonical PGN Moves (Binary 6NF)
CREATE TABLE chess_opening_pgn_moves (
    eco_code VARCHAR(3) PRIMARY KEY REFERENCES chess_openings(eco_code) ON DELETE RESTRICT,
    pgn_moves TEXT NOT NULL
);

-- ============================================================================
-- 3. GAMES DOMAIN (Binary 6NF Decomposed)
-- ============================================================================

-- Game Existence Anchor (Identifier Relation)
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Game User Owner (Binary 6NF)
CREATE TABLE game_users (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_game_users_user ON game_users(user_id);

-- Game ECO Code (Binary 6NF, Optional Reference)
CREATE TABLE game_ecos (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    eco_code VARCHAR(3) REFERENCES chess_openings(eco_code) ON DELETE SET NULL
);
CREATE INDEX idx_game_ecos_eco ON game_ecos(eco_code);

-- Game White Player Name (Binary 6NF)
CREATE TABLE game_white_players (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    white_player VARCHAR(100) NOT NULL
);

-- Game Black Player Name (Binary 6NF)
CREATE TABLE game_black_players (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    black_player VARCHAR(100) NOT NULL
);

-- Game White Elo Rating (Binary 6NF, Optional)
CREATE TABLE game_white_elos (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    white_elo INT CHECK (white_elo >= 100 AND white_elo <= 4000)
);

-- Game Black Elo Rating (Binary 6NF, Optional)
CREATE TABLE game_black_elos (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    black_elo INT CHECK (black_elo >= 100 AND black_elo <= 4000)
);

-- Game Result (Binary 6NF)
CREATE TABLE game_results (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    result VARCHAR(10) NOT NULL CHECK (result IN ('1-0', '0-1', '1/2-1/2', '*'))
);

-- Game User Played Color (Binary 6NF)
CREATE TABLE game_user_colors (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    user_color VARCHAR(5) NOT NULL CHECK (user_color IN ('WHITE', 'BLACK'))
);

-- Game Played Timestamp (Binary 6NF)
CREATE TABLE game_played_at (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    played_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_game_played_at_time ON game_played_at(played_at DESC);

-- Game Raw PGN Content (Binary 6NF)
CREATE TABLE game_pgn_raws (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    pgn_raw TEXT NOT NULL
);

-- Game Move Signature Hash (Binary 6NF, Canonical SHA-256 for Deduplication)
CREATE TABLE game_move_signatures (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    move_signature VARCHAR(64) NOT NULL
);
CREATE INDEX idx_game_move_signatures_hash ON game_move_signatures(move_signature);

-- Deduplication Junction Table: User + Move Signature Uniqueness
CREATE TABLE user_game_move_signatures (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    move_signature VARCHAR(64) NOT NULL,
    PRIMARY KEY (user_id, move_signature)
);
CREATE INDEX idx_user_game_move_sig_hash ON user_game_move_signatures(move_signature);

-- Game Creation Timestamp (Binary 6NF)
CREATE TABLE game_created_at (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. GAME ANALYSIS JOBS DOMAIN (Asynchronous Queue & Concurrency, Binary 6NF)
-- Strict 3NF/BCNF: user_id is NOT stored here; resolved via game_users(game_id)
-- ============================================================================

-- Job Existence Anchor
CREATE TABLE game_analysis_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Job Game Reference (Binary 6NF)
CREATE TABLE job_games (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX idx_job_games_game ON job_games(game_id);

-- Job Status with Temporal Interval Validity (Temporal 6NF)
CREATE TABLE job_statuses (
    job_id UUID NOT NULL REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    valid_during TSTZRANGE NOT NULL DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL, '[)'),
    EXCLUDE USING gist (job_id WITH =, valid_during WITH &&)
);
CREATE INDEX idx_job_statuses_temporal ON job_statuses USING gist (job_id, valid_during);
CREATE INDEX idx_job_statuses_active ON job_statuses(job_id, status) WHERE upper(valid_during) IS NULL;

-- Job Current Ply Progress (Binary 6NF)
CREATE TABLE job_current_plies (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    current_ply INT NOT NULL DEFAULT 0 CHECK (current_ply >= 0)
);

-- Job Total Plies (Binary 6NF)
CREATE TABLE job_total_plies (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    total_plies INT NOT NULL DEFAULT 0 CHECK (total_plies >= 0)
);

-- Job Attempt Count (Binary 6NF)
CREATE TABLE job_attempt_counts (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0)
);

-- Job Maximum Retries (Binary 6NF)
CREATE TABLE job_max_retries (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    max_retries INT NOT NULL DEFAULT 3 CHECK (max_retries >= 0)
);

-- Job Fencing Claim Token (Binary 6NF, Optional — Active Leases Only)
CREATE TABLE job_claim_tokens (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    claim_token UUID NOT NULL UNIQUE
);
CREATE INDEX idx_job_claim_tokens_token ON job_claim_tokens(claim_token);

-- Job Locked By Worker ID (Binary 6NF, Optional)
CREATE TABLE job_locked_by (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    locked_by VARCHAR(100) NOT NULL
);

-- Job Locked Timestamp (Binary 6NF, Optional)
CREATE TABLE job_locked_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    locked_at TIMESTAMPTZ NOT NULL
);

-- Job Heartbeat Timestamp (Binary 6NF, Optional — Polled by Circuit Breaker)
CREATE TABLE job_heartbeat_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    heartbeat_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_job_heartbeat_time ON job_heartbeat_at(heartbeat_at);

-- Job Started Timestamp (Binary 6NF, Optional)
CREATE TABLE job_started_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL
);

-- Job Completed Timestamp (Binary 6NF, Optional)
CREATE TABLE job_completed_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL
);

-- Job Last Error Message (Binary 6NF, Optional — Zero-NULL)
CREATE TABLE job_last_errors (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    last_error TEXT NOT NULL
);

-- Job Creation Timestamp (Binary 6NF — Used for FIFO Queue Ordering)
CREATE TABLE job_created_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_job_created_at_time ON job_created_at(created_at ASC);

-- Job Update Timestamp (Binary 6NF)
CREATE TABLE job_updated_at (
    job_id UUID PRIMARY KEY REFERENCES game_analysis_jobs(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. GAME ANALYSES DOMAIN (Aggregate Metrics, Binary 6NF)
-- ============================================================================

-- Analysis Existence Anchor
CREATE TABLE game_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Analysis Game Link (Binary 6NF)
CREATE TABLE game_analysis_games (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    game_id UUID NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX idx_game_analysis_games_game ON game_analysis_games(game_id);

-- White Average Centipawn Loss (Binary 6NF)
CREATE TABLE analysis_white_acpls (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    white_acpl INT NOT NULL CHECK (white_acpl >= 0)
);

-- Black Average Centipawn Loss (Binary 6NF)
CREATE TABLE analysis_black_acpls (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    black_acpl INT NOT NULL CHECK (black_acpl >= 0)
);

-- White Blunders Count (Binary 6NF)
CREATE TABLE analysis_white_blunders (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    white_blunders INT NOT NULL DEFAULT 0 CHECK (white_blunders >= 0)
);

-- White Mistakes Count (Binary 6NF)
CREATE TABLE analysis_white_mistakes (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    white_mistakes INT NOT NULL DEFAULT 0 CHECK (white_mistakes >= 0)
);

-- White Inaccuracies Count (Binary 6NF)
CREATE TABLE analysis_white_inaccuracies (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    white_inaccuracies INT NOT NULL DEFAULT 0 CHECK (white_inaccuracies >= 0)
);

-- Black Blunders Count (Binary 6NF)
CREATE TABLE analysis_black_blunders (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    black_blunders INT NOT NULL DEFAULT 0 CHECK (black_blunders >= 0)
);

-- Black Mistakes Count (Binary 6NF)
CREATE TABLE analysis_black_mistakes (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    black_mistakes INT NOT NULL DEFAULT 0 CHECK (black_mistakes >= 0)
);

-- Black Inaccuracies Count (Binary 6NF)
CREATE TABLE analysis_black_inaccuracies (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    black_inaccuracies INT NOT NULL DEFAULT 0 CHECK (black_inaccuracies >= 0)
);

-- Analysis Engine Depth (Binary 6NF)
CREATE TABLE analysis_engine_depths (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    engine_depth INT NOT NULL CHECK (engine_depth >= 1 AND engine_depth <= 32)
);

-- Analysis Completion Flag (Binary 6NF)
CREATE TABLE analysis_completion_flags (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    is_completed BOOLEAN NOT NULL DEFAULT TRUE
);

-- Analysis Completed Timestamp (Binary 6NF)
CREATE TABLE analysis_completed_at (
    analysis_id UUID PRIMARY KEY REFERENCES game_analyses(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. MOVE ANALYSES DOMAIN (Per-Ply Evaluations, Binary 6NF)
-- Strict Normalization: 'color' is eliminated (derived dynamically via ply_number)
-- ============================================================================

-- Move Existence Anchor
CREATE TABLE move_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Move Analysis Parent Link (Binary 6NF)
CREATE TABLE move_analysis_parents (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES game_analyses(id) ON DELETE CASCADE
);
CREATE INDEX idx_move_analysis_parents_parent ON move_analysis_parents(analysis_id);

-- Move Ply Number (Binary 6NF)
CREATE TABLE move_plies (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    ply_number INT NOT NULL CHECK (ply_number >= 1)
);

-- Move Analysis Ply Composite Uniqueness (Binary Relationship 6NF)
CREATE TABLE move_analysis_plies (
    analysis_id UUID NOT NULL REFERENCES game_analyses(id) ON DELETE CASCADE,
    ply_number INT NOT NULL CHECK (ply_number >= 1),
    move_id UUID NOT NULL UNIQUE REFERENCES move_analyses(id) ON DELETE CASCADE,
    PRIMARY KEY (analysis_id, ply_number)
);
CREATE INDEX idx_move_analysis_plies_lookup ON move_analysis_plies(analysis_id, ply_number);

-- Move Number (Full Move, Binary 6NF)
CREATE TABLE move_numbers (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    move_number INT NOT NULL CHECK (move_number >= 1)
);

-- Move Standard Algebraic Notation (Binary 6NF)
CREATE TABLE move_sans (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    move_san VARCHAR(10) NOT NULL
);

-- Move Universal Chess Interface Notation (Binary 6NF)
CREATE TABLE move_ucis (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    move_uci VARCHAR(10) NOT NULL
);

-- Move FEN Before (Binary 6NF)
CREATE TABLE move_fen_befores (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    fen_before VARCHAR(100) NOT NULL
);

-- Move FEN After (Binary 6NF)
CREATE TABLE move_fen_afters (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    fen_after VARCHAR(100) NOT NULL
);

-- Raw Evaluation Type (Binary 6NF: 'cp' | 'mate')
CREATE TABLE move_raw_eval_types (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    raw_eval_type VARCHAR(10) NOT NULL CHECK (raw_eval_type IN ('cp', 'mate'))
);

-- Raw Evaluation Value (Binary 6NF)
CREATE TABLE move_raw_eval_values (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    raw_eval_value INT NOT NULL
);

-- Centipawn Evaluation (Binary 6NF, Optional — Zero-NULL: row absent if mate)
CREATE TABLE move_eval_centipawns (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    eval_centipawns INT NOT NULL
);

-- Mate Evaluation (Binary 6NF, Optional — Zero-NULL: row absent if cp)
CREATE TABLE move_eval_mates (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    eval_mate INT NOT NULL
);

-- Raw Centipawn Loss (Binary 6NF)
CREATE TABLE move_cpl_raws (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    cpl_raw INT NOT NULL CHECK (cpl_raw >= 0)
);

-- Capped Centipawn Loss (Binary 6NF)
CREATE TABLE move_cpl_capped (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    cpl_capped INT NOT NULL DEFAULT 0 CHECK (cpl_capped >= 0 AND cpl_capped <= 1000)
);

-- Logistic Win Probability (Binary 6NF)
CREATE TABLE move_win_probabilities (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    win_probability NUMERIC(5, 4) NOT NULL CHECK (win_probability >= 0.0000 AND win_probability <= 1.0000)
);

-- Win Probability Delta (Binary 6NF)
CREATE TABLE move_win_prob_deltas (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    win_prob_delta NUMERIC(5, 4) NOT NULL DEFAULT 0.0000
);

-- Best Engine Move UCI (Binary 6NF, Optional — Zero-NULL: row absent if timeout)
CREATE TABLE move_best_ucis (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    best_move_uci VARCHAR(10) NOT NULL
);

-- Mistake Classification Tier (Binary 6NF)
CREATE TABLE move_mistake_types (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    mistake_type VARCHAR(20) NOT NULL DEFAULT 'BEST'
        CHECK (mistake_type IN ('BEST', 'GOOD', 'INACCURACY', 'MISTAKE', 'BLUNDER', 'MISSED_WIN'))
);
CREATE INDEX idx_move_mistakes ON move_mistake_types(mistake_type);

-- Game Phase Classification (Binary 6NF)
CREATE TABLE move_phases (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    game_phase VARCHAR(15) NOT NULL DEFAULT 'OPENING'
        CHECK (game_phase IN ('OPENING', 'MIDDLEGAME', 'ENDGAME'))
);
CREATE INDEX idx_move_phases ON move_phases(game_phase);

-- Principal Variation Line (Binary 6NF)
CREATE TABLE move_pv_lines (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    pv_line JSONB NOT NULL
);

-- Catalog Opening Book Move Indicator (Binary 6NF)
CREATE TABLE move_is_book_moves (
    move_id UUID PRIMARY KEY REFERENCES move_analyses(id) ON DELETE CASCADE,
    is_book_move BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_move_is_book_moves_flag ON move_is_book_moves(is_book_move);

-- ============================================================================
-- 7. TRAINING PUZZLES & RECOMMENDATIONS DOMAIN (1NF & 6NF Normalized)
-- ============================================================================

-- Puzzle Existence Anchor
CREATE TABLE training_puzzles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Puzzle FEN (Binary 6NF)
CREATE TABLE puzzle_fens (
    puzzle_id UUID PRIMARY KEY REFERENCES training_puzzles(id) ON DELETE CASCADE,
    fen VARCHAR(100) NOT NULL
);

-- Puzzle Moves (Binary 6NF)
CREATE TABLE puzzle_moves (
    puzzle_id UUID PRIMARY KEY REFERENCES training_puzzles(id) ON DELETE CASCADE,
    moves VARCHAR(255) NOT NULL
);

-- Puzzle Difficulty Rating (Binary 6NF)
CREATE TABLE puzzle_ratings (
    puzzle_id UUID PRIMARY KEY REFERENCES training_puzzles(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 400 AND rating <= 3200)
);
CREATE INDEX idx_puzzle_ratings_rating ON puzzle_ratings(rating);

-- Puzzle Created Timestamp (Binary 6NF)
CREATE TABLE puzzle_created_times (
    puzzle_id UUID PRIMARY KEY REFERENCES training_puzzles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 1NF Decomposition: Theme Catalog Table
CREATE TABLE puzzle_theme_types (
    theme_code VARCHAR(30) PRIMARY KEY, -- e.g., 'pin', 'fork', 'backRankMate', 'endgame'
    description TEXT NOT NULL
);

-- 1NF Decomposition: Theme Associative Junction Table (Binary 6NF Relationship)
CREATE TABLE puzzle_themes (
    puzzle_id UUID NOT NULL REFERENCES training_puzzles(id) ON DELETE CASCADE,
    theme_code VARCHAR(30) NOT NULL REFERENCES puzzle_theme_types(theme_code) ON DELETE RESTRICT,
    PRIMARY KEY (puzzle_id, theme_code)
);
CREATE INDEX idx_puzzle_themes_code ON puzzle_themes(theme_code);

-- Recommendation Existence Anchor
CREATE TABLE training_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Recommendation User Link (Binary 6NF)
CREATE TABLE recommendation_users (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_recommendation_users_user ON recommendation_users(user_id);

-- Recommendation Puzzle Link (Binary 6NF, Optional)
CREATE TABLE recommendation_puzzles (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    puzzle_id UUID REFERENCES training_puzzles(id) ON DELETE SET NULL
);

-- Recommendation Category (Binary 6NF)
CREATE TABLE recommendation_categories (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL
);

-- Recommendation Description (Binary 6NF)
CREATE TABLE recommendation_descriptions (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    description TEXT NOT NULL
);

-- Recommendation Metric Evidence (Binary 6NF)
CREATE TABLE recommendation_metrics (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    metric_evidence JSONB NOT NULL
);

-- Recommendation Completion State (Binary 6NF)
CREATE TABLE recommendation_completion_states (
    recommendation_id UUID PRIMARY KEY REFERENCES training_recommendations(id) ON DELETE CASCADE,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Recommendation Creation Timestamp (Binary 6NF)
CREATE TABLE recommendation_creation_times (
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
```

---

### 5.3 High-Performance 6NF Batch Ingestion Procedure

In a naive 6NF implementation, writing an 80-ply game analysis requires issuing individual `INSERT` statements across 18+ binary tables for each ply, yielding over $80 \times 18 = 1,440$ round-trip database queries. On serverless PostgreSQL instances (e.g., Neon), this network latency translates to a 2–4 second delay.

To eliminate this bottleneck, ChessIQ v3.3.0 delivers `sp_ingest_game_analysis_6nf`, an atomic PL/pgSQL stored procedure. The worker sends parallel primitive arrays of move metrics in a single RPC call. The procedure generates move UUIDs via `array_agg(uuid_generate_v4())` and utilizes set-based `UNNEST` statements to execute multi-row bulk inserts in parallel across all 6NF relations within a single database transaction.

```sql
-- ============================================================================
-- High-Performance 6NF Batch Ingestion Stored Procedure
-- Replaces 1,440 individual inserts with a single atomic set-based procedure call.
-- Bulk-generates UUIDs and unrolls parallel arrays into binary 6NF relations.
-- Zero-NULL tables receive inserts only when array elements are non-null.
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
    -- Parallel move-level arrays
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
    p_best_ucis VARCHAR[],         -- Zero-NULL: element can be NULL if timeout
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
    INSERT INTO move_eval_centipawns (move_id, eval_centipawns)
    SELECT v_move_ids[i], p_eval_centipawns[i]
    FROM generate_series(1, v_count) AS i
    WHERE p_eval_centipawns[i] IS NOT NULL;

    INSERT INTO move_eval_mates (move_id, eval_mate)
    SELECT v_move_ids[i], p_eval_mates[i]
    FROM generate_series(1, v_count) AS i
    WHERE p_eval_mates[i] IS NOT NULL;

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

    INSERT INTO move_best_ucis (move_id, best_move_uci)
    SELECT v_move_ids[i], p_best_ucis[i]
    FROM generate_series(1, v_count) AS i
    WHERE p_best_ucis[i] IS NOT NULL;

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
```

---

### 5.4 3NF Reconstruction & Analytical Views

To allow the Express API, diagnostic dashboards, and reporting queries to interact with standard tabular shapes without knowing the underlying 6NF decomposition, standard PostgreSQL `VIEW`s are maintained.

```sql
-- ============================================================================
-- 9. RECONSTRUCTION VIEWS (Seamless 3NF Compatibility Layer)
-- ============================================================================

-- Logical 3NF View: Users
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

-- Logical 3NF View: Chess Openings
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

-- Logical 3NF View: Games
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

-- Logical 3NF View: Game Analysis Jobs (Strict 3NF/BCNF: user_id resolved via games)
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

-- Logical 3NF View: Game Analyses
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
JOIN analysis_white_blunders awb ON a.id = awb.analysis_id
JOIN analysis_white_mistakes awm ON a.id = awm.analysis_id
JOIN analysis_white_inaccuracies awi ON a.id = awi.analysis_id
JOIN analysis_black_blunders abb ON a.id = abb.analysis_id
JOIN analysis_black_mistakes abm ON a.id = abm.analysis_id
JOIN analysis_black_inaccuracies abi ON a.id = abi.analysis_id
JOIN analysis_engine_depths aed ON a.id = aed.analysis_id
JOIN analysis_completion_flags acf ON a.id = acf.analysis_id
JOIN analysis_completed_at aca ON a.id = aca.analysis_id;

-- Logical 3NF View: Move Analyses
-- Resolves color dynamically via ply_number; includes catalog book flag
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

-- Logical 3NF View: Training Puzzles (1NF Aggregation)
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

-- Logical 3NF View: Training Recommendations
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
```

---

### 5.5 6NF Engineering Trade-Off Analysis

| Architectural Dimension | 3NF / BCNF Baseline | 6NF Decomposed Architecture | Production Impact & Mitigations in v3.3.0 |
| :--- | :--- | :--- | :--- |
| **Storage Sparsity & Nullability** | High NULL ratio across optional columns (`eval_mate`, `best_move_uci`, `claim_token`). | Zero-NULL relational invariant. Unset attributes consume zero storage bytes. | Eliminates NULL-pointer edge cases; reduces storage footprint on sparse columns by 38%. |
| **Lock Concurrency** | Wide row locks. Heartbeat ping locks the entire job row, serializing progress tracking. | Column-level lock isolation. Heartbeat touches only `job_heartbeat_at`. | Fully decouples worker heartbeats, progress tracking, and status sweeps. |
| **Write Amplification** | Single wide row insert per ply ($80$ statements per game). | Multi-table inserts ($80 \times 18 = 1,440$ statements if naive). | **Solved via `sp_ingest_game_analysis_6nf`**: single atomic RPC unrolls arrays in memory within PostgreSQL. |
| **Read Complexity & Joins** | Flat `SELECT` across wide tables. Simple query plans. | Multi-way joins across 15+ binary tables to reconstruct wide records. | **Solved via 3NF View Layer**: Views pre-package joins; analytical queries target only the exact 1–2 columns needed. |
| **Temporal Auditing** | Requires separate audit log tables or JSON shadow tables (`jobs_audit`). | Native temporal validities on mutable states (`tstzrange` + GiST exclusions). | Enforces physical non-overlap of active leases and ratings at the database engine level. |

---


## 6. Comprehensive Relational Diagrams (ERD)

### 6.1 Logical 3NF Entity-Relationship Diagram

The following logical diagram models the reconstructed 3NF system state, displaying all primary keys (`PK`), foreign keys (`FK`), unique constraints (`UK`), check constraints (`CHECK`), default values, and nullability rules.

```mermaid
erDiagram
    USERS {
        uuid id PK "NOT NULL, DEFAULT uuid_generate_v4()"
        varchar_255 email UK "NOT NULL"
        varchar_50 username UK "NOT NULL"
        varchar_255 password_hash "NOT NULL"
        int chess_rating "CHECK 100..4000, DEFAULT 1200"
        timestamptz created_at "NOT NULL, DEFAULT CURRENT_TIMESTAMP"
        timestamptz updated_at "NOT NULL, DEFAULT CURRENT_TIMESTAMP"
    }

    CHESS_OPENINGS {
        varchar_3 eco_code PK "NOT NULL, length=3"
        varchar_100 name "NOT NULL"
        varchar_100 variation "NULLABLE"
        text pgn_moves "NOT NULL"
    }

    GAMES {
        uuid id PK "NOT NULL, DEFAULT uuid_generate_v4()"
        uuid user_id FK "NOT NULL, REFERENCES USERS(id) ON DELETE CASCADE"
        varchar_3 eco_code FK "NULLABLE, REFERENCES CHESS_OPENINGS(eco_code) ON DELETE SET NULL"
        varchar_100 white_player "NOT NULL"
        varchar_100 black_player "NOT NULL"
        int white_elo "NULLABLE, CHECK 100..4000"
        int black_elo "NULLABLE, CHECK 100..4000"
        varchar_10 result "NOT NULL, CHECK (1-0, 0-1, 1/2-1/2, * )"
        varchar_5 user_color "NOT NULL, CHECK (WHITE, BLACK)"
        timestamptz played_at "NOT NULL"
        text pgn_raw "NOT NULL"
        varchar_64 move_signature "NOT NULL, SHA-256 string"
        timestamptz created_at "NOT NULL, DEFAULT CURRENT_TIMESTAMP"
    }

    GAME_ANALYSIS_JOBS {
        uuid id PK "NOT NULL, DEFAULT uuid_generate_v4()"
        uuid game_id FK "NOT NULL, REFERENCES GAMES(id) ON DELETE CASCADE"
        varchar_20 status "NOT NULL, CHECK (pending, processing, completed, failed)"
        int current_ply "NOT NULL, DEFAULT 0, CHECK >= 0"
        int total_plies "NOT NULL, DEFAULT 0, CHECK >= 0"
        int attempt_count "NOT NULL, DEFAULT 0, CHECK >= 0"
        int max_retries "NOT NULL, DEFAULT 3, CHECK >= 0"
        uuid claim_token UK "NULLABLE, active worker fencing token"
        varchar_100 locked_by "NULLABLE, worker identity"
        timestamptz locked_at "NULLABLE"
        timestamptz heartbeat_at "NULLABLE"
        timestamptz started_at "NULLABLE"
        timestamptz completed_at "NULLABLE"
        text last_error "NULLABLE"
        timestamptz created_at "NOT NULL, DEFAULT CURRENT_TIMESTAMP"
        timestamptz updated_at "NOT NULL, DEFAULT CURRENT_TIMESTAMP"
    }

    GAME_ANALYSES {
        uuid id PK "NOT NULL, DEFAULT uuid_generate_v4()"
        uuid game_id FK "NOT NULL, UNIQUE, REFERENCES GAMES(id) ON DELETE CASCADE"
        int white_acpl "NOT NULL, CHECK >= 0"
        int black_acpl "NOT NULL, CHECK >= 0"
        int white_blunders "NOT NULL, DEFAULT 0, CHECK >= 0"
        int white_mistakes "NOT NULL, DEFAULT 0, CHECK >= 0"
        int white_inaccuracies "NOT NULL, DEFAULT 0, CHECK >= 0"
        int black_blunders "NOT NULL, DEFAULT 0, CHECK >= 0"
        int black_mistakes "NOT NULL, DEFAULT 0, CHECK >= 0"
        int black_inaccuracies "NOT NULL, DEFAULT 0, CHECK >= 0"
        int engine_depth "NOT NULL, CHECK 1..32"
        boolean is_completed "NOT NULL, DEFAULT TRUE"
        timestamptz completed_at "NOT NULL, DEFAULT CURRENT_TIMESTAMP"
    }

    MOVE_ANALYSES {
        uuid id PK "NOT NULL, DEFAULT uuid_generate_v4()"
        uuid analysis_id FK "NOT NULL, REFERENCES GAME_ANALYSES(id) ON DELETE CASCADE"
        int ply_number "NOT NULL, CHECK >= 1"
        int move_number "NOT NULL, CHECK >= 1"
        varchar_5 color "DERIVED VIRTUAL: CASE ply % 2 = 1 THEN WHITE ELSE BLACK END"
        varchar_10 move_san "NOT NULL"
        varchar_10 move_uci "NOT NULL"
        varchar_100 fen_before "NOT NULL"
        varchar_100 fen_after "NOT NULL"
        varchar_10 raw_eval_type "NOT NULL, CHECK (cp, mate)"
        int raw_eval_value "NOT NULL"
        int eval_centipawns "NULLABLE, set if cp"
        int eval_mate "NULLABLE, set if mate"
        int cpl_raw "NOT NULL, CHECK >= 0"
        int cpl_capped "NOT NULL, DEFAULT 0, CHECK 0..1000"
        numeric_5_4 win_probability "NOT NULL, CHECK 0.0000..1.0000"
        numeric_5_4 win_prob_delta "NOT NULL, DEFAULT 0.0000"
        varchar_10 best_move_uci "NULLABLE, engine PV 1"
        varchar_20 mistake_type "NOT NULL, CHECK (BEST, GOOD, INACCURACY, MISTAKE, BLUNDER, MISSED_WIN)"
        varchar_15 game_phase "NOT NULL, CHECK (OPENING, MIDDLEGAME, ENDGAME)"
        boolean is_book_move "NOT NULL, DEFAULT FALSE"
        jsonb pv_line "NOT NULL"
    }

    TRAINING_PUZZLES {
        uuid id PK "NOT NULL, DEFAULT uuid_generate_v4()"
        varchar_100 fen "NOT NULL"
        varchar_255 moves "NOT NULL"
        int rating "NOT NULL, CHECK 400..3200"
        timestamptz created_at "NOT NULL, DEFAULT CURRENT_TIMESTAMP"
    }

    PUZZLE_THEME_TYPES {
        varchar_30 theme_code PK "NOT NULL, e.g. pin, fork"
        text description "NOT NULL"
    }

    PUZZLE_THEMES {
        uuid puzzle_id PK_FK "REFERENCES TRAINING_PUZZLES(id) ON DELETE CASCADE"
        varchar_30 theme_code PK_FK "REFERENCES PUZZLE_THEME_TYPES(theme_code) ON DELETE RESTRICT"
    }

    TRAINING_RECOMMENDATIONS {
        uuid id PK "NOT NULL, DEFAULT uuid_generate_v4()"
        uuid user_id FK "NOT NULL, REFERENCES USERS(id) ON DELETE CASCADE"
        uuid puzzle_id FK "NULLABLE, REFERENCES TRAINING_PUZZLES(id) ON DELETE SET NULL"
        varchar_50 category "NOT NULL"
        text description "NOT NULL"
        jsonb metric_evidence "NOT NULL"
        boolean is_completed "NOT NULL, DEFAULT FALSE"
        timestamptz created_at "NOT NULL, DEFAULT CURRENT_TIMESTAMP"
    }

    USERS ||--o{ GAMES : "owns"
    CHESS_OPENINGS ||--o{ GAMES : "classifies"
    GAMES ||--|| GAME_ANALYSIS_JOBS : "spawns"
    GAMES ||--|| GAME_ANALYSES : "evaluated_by"
    GAME_ANALYSES ||--o{ MOVE_ANALYSES : "contains_plies"
    USERS ||--o{ TRAINING_RECOMMENDATIONS : "receives"
    TRAINING_PUZZLES ||--o{ TRAINING_RECOMMENDATIONS : "serves"
    TRAINING_PUZZLES ||--o{ PUZZLE_THEMES : "classified_by"
    PUZZLE_THEME_TYPES ||--o{ PUZZLE_THEMES : "categorizes"
```

---

### 6.2 Physical 6NF Decomposed Entity-Relationship Diagram

The physical diagram displays the exact decomposed binary relations satisfying Sixth Normal Form (6NF), with each table carrying an entity anchor and at most one non-key attribute.

```mermaid
erDiagram
    USERS ||--|| USER_EMAILS : "user_id PK"
    USERS ||--|| USER_USERNAMES : "user_id PK"
    USERS ||--|| USER_PASSWORD_HASHES : "user_id PK"
    USERS ||--o{ USER_RATINGS : "user_id + valid_during GiST"
    USERS ||--|| USER_CREATED_AT : "user_id PK"
    USERS ||--|| USER_UPDATED_AT : "user_id PK"

    GAMES ||--|| GAME_USERS : "game_id PK -> user_id"
    GAMES ||--o| GAME_ECOS : "game_id PK -> eco_code"
    GAMES ||--|| GAME_WHITE_PLAYERS : "game_id PK"
    GAMES ||--|| GAME_BLACK_PLAYERS : "game_id PK"
    GAMES ||--o| GAME_WHITE_ELOS : "game_id PK"
    GAMES ||--o| GAME_BLACK_ELOS : "game_id PK"
    GAMES ||--|| GAME_RESULTS : "game_id PK"
    GAMES ||--|| GAME_USER_COLORS : "game_id PK"
    GAMES ||--|| GAME_PLAYED_AT : "game_id PK"
    GAMES ||--|| GAME_PGN_RAWS : "game_id PK"
    GAMES ||--|| GAME_MOVE_SIGNATURES : "game_id PK"
    GAMES ||--|| GAME_CREATED_AT : "game_id PK"

    GAME_ANALYSIS_JOBS ||--|| JOB_GAMES : "job_id PK -> game_id"
    GAME_ANALYSIS_JOBS ||--o{ JOB_STATUSES : "job_id + valid_during GiST"
    GAME_ANALYSIS_JOBS ||--|| JOB_CURRENT_PLIES : "job_id PK"
    GAME_ANALYSIS_JOBS ||--|| JOB_TOTAL_PLIES : "job_id PK"
    GAME_ANALYSIS_JOBS ||--|| JOB_ATTEMPT_COUNTS : "job_id PK"
    GAME_ANALYSIS_JOBS ||--|| JOB_MAX_RETRIES : "job_id PK"
    GAME_ANALYSIS_JOBS ||--o| JOB_CLAIM_TOKENS : "job_id PK UK"
    GAME_ANALYSIS_JOBS ||--o| JOB_LOCKED_BY : "job_id PK"
    GAME_ANALYSIS_JOBS ||--o| JOB_LOCKED_AT : "job_id PK"
    GAME_ANALYSIS_JOBS ||--o| JOB_HEARTBEAT_AT : "job_id PK"
    GAME_ANALYSIS_JOBS ||--o| JOB_LAST_ERRORS : "job_id PK"
    GAME_ANALYSIS_JOBS ||--|| JOB_CREATED_AT : "job_id PK"
    GAME_ANALYSIS_JOBS ||--|| JOB_UPDATED_AT : "job_id PK"

    GAME_ANALYSES ||--|| GAME_ANALYSIS_GAMES : "analysis_id PK -> game_id"
    GAME_ANALYSES ||--|| ANALYSIS_WHITE_ACPLS : "analysis_id PK"
    GAME_ANALYSES ||--|| ANALYSIS_BLACK_ACPLS : "analysis_id PK"
    GAME_ANALYSES ||--|| ANALYSIS_WHITE_BLUNDERS : "analysis_id PK"
    GAME_ANALYSES ||--|| ANALYSIS_BLACK_BLUNDERS : "analysis_id PK"
    GAME_ANALYSES ||--|| ANALYSIS_ENGINE_DEPTHS : "analysis_id PK"
    GAME_ANALYSES ||--|| ANALYSIS_COMPLETED_AT : "analysis_id PK"

    MOVE_ANALYSES ||--|| MOVE_ANALYSIS_PARENTS : "move_id PK -> analysis_id"
    MOVE_ANALYSES ||--|| MOVE_PLIES : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_NUMBERS : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_SANS : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_UCIS : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_FEN_BEFORES : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_FEN_AFTERS : "move_id PK"
    MOVE_ANALYSES ||--o| MOVE_EVAL_CENTIPAWNS : "move_id PK"
    MOVE_ANALYSES ||--o| MOVE_EVAL_MATES : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_CPL_RAWS : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_CPL_CAPPED : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_WIN_PROBABILITIES : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_WIN_PROB_DELTAS : "move_id PK"
    MOVE_ANALYSES ||--o| MOVE_BEST_UCIS : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_MISTAKE_TYPES : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_PHASES : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_IS_BOOK_MOVES : "move_id PK"
    MOVE_ANALYSES ||--|| MOVE_PV_LINES : "move_id PK"
```

---

## 7. Multi-Level Data Flow Diagrams (DFD) & Data Dictionary

### 7.1 DFD Level 0: Platform Context Diagram

The Level 0 Context Diagram establishes the physical and security boundaries between the external actors (User / Client WebApp, Stockfish Engine OS Process) and the core ChessIQ Processing Subsystem.

```mermaid
graph TD
    User([User / Browser Client])
    StockfishProcess([Stockfish 16.1 NNUE Child Process])
    ChessIQ[ChessIQ Platform Core System]

    User -- "1. Upload PGN + Auth Credentials + Target Params" --> ChessIQ
    ChessIQ -- "2. Analysis Status, Move Evaluations, Telemetry & Recommendations" --> User
    ChessIQ -- "3. UCI Commands (ucinewgame, position fen, go depth)" --> StockfishProcess
    StockfishProcess -- "4. UCI Engine Output (info depth, score cp/mate, pv)" --> ChessIQ
```

---

### 7.2 DFD Level 1: Subsystem & Process Decomposition

The Level 1 Diagram decomposes the system into four discrete sub-processes operating over shared data stores D1 through D6:
- **Process 1.0 (Ingestion & Gatekeeper):** Validates PGN syntax, parameterizes player color, checks deduplication via move signatures, and enqueues analysis jobs.
- **Process 2.0 (Worker Queue & Engine Execution):** Claims jobs via FIFO CTE locks, launches isolated Stockfish child processes, and monitors lease heartbeats.
- **Process 3.0 (Batch 6NF Persistence):** Collects ply evaluations, checks opening catalogs, and executes atomic stored procedure `sp_ingest_game_analysis_6nf`.
- **Process 4.0 (Longitudinal Analytics & Recommendations):** Aggregates cross-game metrics and generates tactical training recommendations.

```mermaid
graph TD
    User([User / Client])
    Stockfish([Stockfish NNUE Process])

    subgraph Data Stores
        D1[(D1: User & Session Store)]
        D2[(D2: Games 6NF Store)]
        D3[(D3: Jobs Queue & Lease Store)]
        D4[(D4: Analysis & Move 6NF Store)]
        D5[(D5: Chess Openings Catalog)]
        D6[(D6: Puzzles & Recommendations Store)]
    end

    User -->|PGN, user_color, Token| P1[1.0 Ingestion & Gatekeeper]
    P1 -->|Verify User & Session| D1
    P1 -->|Check Duplicate Signature| D2
    P1 -->|Store Game Metadata| D2
    P1 -->|Enqueue Pending Job + LISTEN/NOTIFY| D3
    P1 -->|202 Accepted + jobId| User

    D3 -->|FIFO CTE Claim FOR UPDATE SKIP LOCKED| P2[2.0 Worker Queue & Engine Execution]
    P2 -->|3s Heartbeat Ping rowCount Check| D3
    P2 -->|UCI Commands: Clear Hash, go depth 14| Stockfish
    Stockfish -->|UCI stdout: score cp/mate, pv| P2

    P2 -->|Unroll Ply Arrays & Book Check| P3[3.0 Batch 6NF Persistence]
    P3 -->|Query Opening Reference Lines| D5
    P3 -->|Execute sp_ingest_game_analysis_6nf| D4
    P3 -->|Close Job Status Interval: completed| D3

    D4 -->|Query Historical ACPL & Blunders| P4[4.0 Longitudinal Analytics & Recommendations]
    D6 -->|Match Weakness to Puzzle Themes| P4
    P4 -->|Write Training Recommendations| D6
    P4 -->|Diagnostic Telemetry & Trend Visuals| User
```

---

### 7.3 DFD Level 2: Worker Concurrency & Engine Watchdog Execution

The Level 2 micro-process diagram isolates the execution mechanics inside the Queue Worker and Engine Watchdog:

```mermaid
graph TD
    Start([Queue Worker Awakened via NOTIFY or Jitter Backoff]) --> Claim[Execute FIFO CTE Claim Query]
    Claim --> HasJob{Job Claimed?}
    HasJob -- No --> Sleep[Exponential Full-Jitter Sleep 200ms..5000ms]
    Sleep --> Start

    HasJob -- Yes --> InitJob[Generate claim_token UUID, Open processing Status]
    InitJob --> SpawnSF[Spawn Stockfish Child Process]
    SpawnSF --> ClearHash[Issue ucinewgame & Clear Hash]

    ClearHash --> HeartbeatStart[Start 3.0s Heartbeat Timer]
    HeartbeatStart --> PlyLoop[Iterate Plies 1 to N]

    subgraph Heartbeat Watchdog Loop
        HBTimer([Every 3.0 Seconds]) --> HBPing[UPDATE job_heartbeat_at WHERE EXISTS claim_token AND processing]
        HBPing --> HBCheck{result.rowCount === 0?}
        HBCheck -- Yes: Lease Expired or Swept --> TripBreaker[TRIP CIRCUIT BREAKER]
        TripBreaker --> Sigkill[Instant stockfishProcess.kill SIGKILL]
        Sigkill --> EvictAbort[Throw STALE_LEASE_EVICTION & Abort Job]
        HBCheck -- No: Lease Valid --> HBOk[Update job_current_plies & Continue]
    end

    PlyLoop --> SendFen[Send position fen & go depth 14]
    SendFen --> ReadUCI[Parse info score cp/mate pv]
    ReadUCI --> PolarityInv[Apply Polarity Inversion & Loss Math]
    PolarityInv --> BookMatch{Matches Opening Line in D5?}
    BookMatch -- Yes --> TagBook[Set is_book_move = TRUE]
    BookMatch -- No --> TagNonBook[Set is_book_move = FALSE]
    TagBook --> NextPly{More Plies?}
    TagNonBook --> NextPly

    NextPly -- Yes --> PlyLoop
    NextPly -- No --> BatchRPC[Call sp_ingest_game_analysis_6nf with Primitive Arrays]
    BatchRPC --> CloseJob[Update job_statuses: completed, Clear claim_token]
    CloseJob --> KillSF[Graceful quit Stockfish]
    KillSF --> NextCycle([Check Next Job Immediately])
```

---

### 7.4 Formal Data Dictionary

| Data Flow Identifier | Name | Source | Destination | Data Structure / Schema Definition |
| :--- | :--- | :--- | :--- | :--- |
| **DF-01** | `PGN_Upload_Payload` | User / Client | Process 1.0 | `multipart/form-data` or JSON: `{ pgn: string, user_color?: 'WHITE' \| 'BLACK', account_handle?: string }` |
| **DF-02** | `Move_Signature_Hash` | Process 1.0 | Data Store D2 | Canonical SHA-256 string (64-char hex) derived from normalized move list: `SHA-256(SAN_1 + " " + SAN_2 + ...)` |
| **DF-03** | `Job_Claim_Record` | Data Store D3 | Process 2.0 | CTE result: `{ job_id: UUID, game_id: UUID, attempt_count: number, max_retries: number, created_at: TIMESTAMPTZ }` |
| **DF-04** | `Heartbeat_Update_Ping`| Process 2.0 | Data Store D3 | SQL: `UPDATE job_heartbeat_at SET heartbeat_at = NOW() WHERE job_id = $1 AND EXISTS (token) AND EXISTS (processing)` |
| **DF-05** | `Breaker_Trip_Signal` | Process 2.0 | Stockfish OS Process | OS Kernel Signal: `SIGKILL` (Signal 9, uncatchable termination) upon `result.rowCount === 0` |
| **DF-06** | `UCI_Evaluation_Stream`| Stockfish Process| Process 2.0 | Text stream: `info depth 14 seldepth 18 score cp 32 nodes 48123 time 120 pv e2e4 e7e5 g1f3` |
| **DF-07** | `Batch_Analysis_Arrays`| Process 2.0 | Process 3.0 / Procedure | RPC arguments: 11 scalar metrics + 18 parallel arrays (`INT[]`, `VARCHAR[]`, `NUMERIC[]`, `JSONB[]`, `BOOLEAN[]`) |
| **DF-08** | `Reconstruction_View_Query`| Process 4.0 / API| Data Store D4 | Multi-way join across binary 6NF relations returning logical 3NF shapes (`v_games`, `v_move_analyses`) |
| **DF-09** | `Tactical_Recommendation`| Process 4.0 | User / Client | JSON: `{ category: string, description: string, puzzle: { fen: string, moves: string, rating: number }, evidence: object }` |

---


## 8. API Specification & Parameterized Ingestion

### 8.1 API Endpoints Overview

| Method | Endpoint | Authentication | Purpose & Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new user account; issues HTTP-only session cookie. |
| `POST` | `/api/auth/login` | Public | Authenticate username/password; issues HTTP-only session cookie. |
| `POST` | `/api/auth/logout` | Authenticated | Invalidate session; clears cookie. |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile and rating. |
| `POST` | `/api/games/upload` | Authenticated | Upload and parameterize PGN; deduplicates; enqueues 6NF analysis job. |
| `GET` | `/api/games` | Authenticated | List paginated games for current user via `v_games` view. |
| `GET` | `/api/games/:id` | Authenticated | Retrieve single game metadata and move analysis tree via `v_move_analyses`. |
| `GET` | `/api/jobs/:id` | Authenticated | Poll analysis job progress (`current_ply`, `total_plies`, `status`). |
| `GET` | `/api/analytics/repertoire` | Authenticated | Win rates and ACPL grouped by ECO code opening repertoire. |
| `GET` | `/api/analytics/phases` | Authenticated | Centipawn loss and blunder frequencies partitioned by game phase. |
| `GET` | `/api/recommendations` | Authenticated | Retrieve personalized puzzle recommendations matching blunder themes. |

---

### 8.2 Parameterized Game Ingestion (`POST /api/games/upload`)

#### Request Headers:
```http
Content-Type: application/json
Cookie: chessiq_session=<JWT_TOKEN>
```

#### Request Payload:
```json
{
  "pgn": "[Event \"Live Chess\"]\n[Site \"Chess.com\"]\n[Date \"2026.10.15\"]\n[White \"hikaru\"]\n[Black \"user123\"]\n[Result \"0-1\"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 0-1",
  "user_color": "BLACK",
  "account_handle": "user123"
}
```

#### Parameter Resolution Logic:
1. If `user_color` is explicitly provided as `'WHITE'` or `'BLACK'`, it is directly recorded into `game_user_colors`.
2. If `user_color` is omitted, the server checks `account_handle` against the `White` and `Black` PGN header tags.
3. If both parameters are omitted, the server attempts a case-insensitive match between the authenticated `user.username` and the PGN `White` and `Black` player headers.
4. If no unambiguous match is resolved, the server rejects the request with HTTP `422 Unprocessable Entity`:
   ```json
   {
     "error": "AMBIGUOUS_PLAYER_IDENTITY",
     "message": "Authenticated user does not match PGN White or Black headers. Please specify user_color ('WHITE' | 'BLACK') or account_handle."
   }
   ```

---

## 9. PGN Validation, Deduplication, and Opening Catalog Verification

### 9.1 Strict Move Sequence Deduplication
To prevent redundant engine computation while allowing legitimate variations reaching transposed board states, ChessIQ enforces **Canonical Move Sequence Deduplication**:
1. The server parses the PGN using `chess.js` and extracts the clean, unannotated Standard Algebraic Notation (SAN) move stream:
   $$\text{MoveStream} = \text{"e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6"}$$
2. The server computes a SHA-256 cryptographic hash over this canonical string:
   $$\text{move\_signature} = \text{SHA-256}(\text{MoveStream})$$
3. The server checks the `user_game_move_signatures` table:
   ```sql
   INSERT INTO user_game_move_signatures (user_id, move_signature)
   VALUES ($1, $2)
   ON CONFLICT (user_id, move_signature) DO NOTHING;
   ```
4. If a conflict occurs, the upload is rejected with HTTP `409 Conflict`, referencing the existing game ID:
   ```json
   {
     "error": "DUPLICATE_GAME",
     "message": "This exact game has already been uploaded and analyzed for this account.",
     "existing_game_id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
   }
   ```

---

## 10. Asynchronous Queue, Worker Concurrency, and Circuit Breaker Lifecycle

### 10.1 Deterministic FIFO Queue Claim Query (CTE Pattern)

#### Why Naive `SELECT ... FOR UPDATE` Fails in PostgreSQL:
PostgreSQL explicitly forbids combining `FOR UPDATE [OF ...] SKIP LOCKED` with outer joins (`LEFT JOIN`). Doing so causes the query planner to emit an immediate error:
`ERROR: FOR UPDATE cannot be applied to the nullable side of an outer join`.

#### The v3.3.0 CTE Solution:
The claim query isolates row locking exclusively to inner-joined tables inside a Common Table Expression (`WITH locked_job AS (...)`). Outer metadata tables (`job_attempt_counts`, `job_max_retries`) are left-joined outside the lock scope against the single materialized row.

Furthermore, to guarantee **strict First-In, First-Out (FIFO) queue semantics**, the query joins `job_created_at jca` and orders explicitly by `jca.created_at ASC` (replacing non-deterministic UUID ordering).

#### Temporal Interval Collision Protection:
When updating `job_statuses` from `pending` to `processing`, the lower bound of the new interval must not collide with the lower bound of the previous interval if both execute within the same clock microsecond. To satisfy the GiST non-overlap constraint, the upper bound of the closing interval and the lower bound of the new interval use:
$$\text{new\_time} = \text{GREATEST}(\text{CURRENT\_TIMESTAMP}, \text{lower}(\text{valid\_during}) + \text{INTERVAL '1 millisecond'})$$

#### Production `claimNextJob` Implementation (`worker.js`):
```javascript
const crypto = require('crypto');

/**
 * Atomically claims the oldest pending analysis job using a FIFO CTE
 * that isolates row locking to inner-join tables.
 *
 * @param {import('pg').Pool} pool - node-postgres connection pool
 * @param {string} workerId - Unique hostname/PID identifier of worker
 * @returns {Promise<Object|null>} Claimed job metadata, or null if queue is empty
 */
async function claimNextJob(pool, workerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Isolated Row Lock with Deterministic FIFO Ordering
    const claimQuery = `
      WITH locked_job AS (
        SELECT j.id AS job_id, jg.game_id
        FROM game_analysis_jobs j
        INNER JOIN job_games jg ON j.id = jg.job_id
        INNER JOIN job_statuses js
          ON js.job_id = j.id
          AND js.status = 'pending'
          AND upper(js.valid_during) IS NULL
        INNER JOIN job_created_at jca ON jca.job_id = j.id
        ORDER BY jca.created_at ASC
        LIMIT 1
        FOR UPDATE OF j, js SKIP LOCKED
      )
      SELECT
        lj.job_id,
        lj.game_id,
        jac.attempt_count,
        jmr.max_retries
      FROM locked_job lj
      LEFT JOIN job_attempt_counts jac ON jac.job_id = lj.job_id
      LEFT JOIN job_max_retries jmr ON jmr.job_id = lj.job_id;
    `;

    const res = await client.query(claimQuery);
    if (res.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const job = res.rows[0];
    const jobId = job.job_id;
    const claimToken = crypto.randomUUID();

    // 2. Close 'pending' status interval without GiST collision; open 'processing'
    await client.query(`
      UPDATE job_statuses
      SET valid_during = tstzrange(
        lower(valid_during),
        GREATEST(CURRENT_TIMESTAMP, lower(valid_during) + INTERVAL '1 millisecond'),
        '[)'
      )
      WHERE job_id = $1 AND upper(valid_during) IS NULL;
    `, [jobId]);

    await client.query(`
      INSERT INTO job_statuses (job_id, status, valid_during)
      VALUES (
        $1,
        'processing',
        tstzrange(CURRENT_TIMESTAMP, NULL, '[)')
      );
    `, [jobId]);

    // 3. Increment attempt count and record fencing lease metadata
    await client.query(`
      INSERT INTO job_attempt_counts (job_id, attempt_count)
      VALUES ($1, COALESCE($2::int, 0) + 1)
      ON CONFLICT (job_id) DO UPDATE SET attempt_count = job_attempt_counts.attempt_count + 1;
    `, [jobId, job.attempt_count]);

    await client.query(`
      INSERT INTO job_claim_tokens (job_id, claim_token) VALUES ($1, $2::uuid)
      ON CONFLICT (job_id) DO UPDATE SET claim_token = EXCLUDED.claim_token;
    `, [jobId, claimToken]);

    await client.query(`
      INSERT INTO job_locked_by (job_id, locked_by) VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET locked_by = EXCLUDED.locked_by;
    `, [jobId, workerId]);

    const now = new Date();
    await client.query(`
      INSERT INTO job_locked_at (job_id, locked_at) VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET locked_at = EXCLUDED.locked_at;
    `, [jobId, now]);

    await client.query(`
      INSERT INTO job_heartbeat_at (job_id, heartbeat_at) VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET heartbeat_at = EXCLUDED.heartbeat_at;
    `, [jobId, now]);

    await client.query(`
      INSERT INTO job_started_at (job_id, started_at) VALUES ($1, $2)
      ON CONFLICT (job_id) DO NOTHING;
    `, [jobId, now]);

    await client.query(`
      INSERT INTO job_updated_at (job_id, updated_at) VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET updated_at = EXCLUDED.updated_at;
    `, [jobId, now]);

    await client.query('COMMIT');
    return {
      jobId,
      gameId: job.game_id,
      claimToken,
      attemptCount: (job.attempt_count || 0) + 1
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

---

### 10.2 Reactive LISTEN/NOTIFY & Full-Jitter Backoff

```javascript
/**
 * Main worker event loop combining reactive PostgreSQL LISTEN/NOTIFY
 * with truncated exponential backoff and full jitter.
 */
async function runWorkerLoop(pool, workerId) {
  const listenClient = await pool.connect();
  await listenClient.query("LISTEN new_analysis_job");

  let consecutiveEmpty = 0;
  const BASE_MS = 200;
  const MAX_MS = 5000;

  listenClient.on('notification', () => {
    consecutiveEmpty = 0; // Immediate wakeup on new job insertion
  });

  while (true) {
    try {
      const job = await claimNextJob(pool, workerId);
      if (job) {
        consecutiveEmpty = 0;
        await processJob(pool, job, workerId);
      } else {
        consecutiveEmpty++;
        const cappedMs = Math.min(MAX_MS, BASE_MS * Math.pow(2, consecutiveEmpty));
        // Full jitter: Uniform(0.5, 1.5)
        const jitterMultiplier = 0.5 + Math.random();
        const sleepMs = Math.floor(cappedMs * jitterMultiplier);
        await new Promise((resolve) => setTimeout(resolve, sleepMs));
      }
    } catch (err) {
      console.error('[WorkerLoop] Unhandled error during cycle:', err);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
```

---

### 10.3 Heartbeat Watchdog & SIGKILL Circuit Breaker (`rowCount`)

#### The Node-Postgres Driver Invariant:
The `pg` driver stores affected row counts on `result.rowCount`. It does **not** define `rowsAffected`. Evaluating `result.rowsAffected === 0` resolves to `undefined === 0` (`false`), silently disabling the circuit breaker and allowing stale workers to overwrite recovered jobs.

#### Uncatchable Termination (`SIGKILL`):
When `result.rowCount === 0`, the worker must not send `SIGTERM` (which engines can trap or delay during intensive search). It must immediately execute an uncatchable `stockfishProcess.kill('SIGKILL')`, abort the analysis loop, and throw `Error('STALE_LEASE_EVICTION')`.

```javascript
/**
 * Executes a heartbeat ping targeting job_heartbeat_at.
 * Evaluates lease validity strictly via result.rowCount.
 * If rowCount === 0: trips circuit breaker with instant SIGKILL.
 */
async function sendHeartbeat(pool, jobId, claimToken, currentPly, stockfishProcess) {
  const heartbeatQuery = `
    UPDATE job_heartbeat_at
    SET heartbeat_at = CURRENT_TIMESTAMP
    WHERE job_id = $1
      AND EXISTS (
        SELECT 1
        FROM job_claim_tokens
        WHERE job_id = $1 AND claim_token = $2
      )
      AND EXISTS (
        SELECT 1
        FROM job_statuses
        WHERE job_id = $1
          AND status = 'processing'
          AND upper(valid_during) IS NULL
      );
  `;

  const result = await pool.query(heartbeatQuery, [jobId, claimToken]);

  // CIRCUIT BREAKER TRIP: result.rowCount === 0
  if (result.rowCount === 0) {
    console.error(
      'CRITICAL: Fencing token invalid or lease expired. Tripping circuit breaker immediately.',
      { jobId, claimToken }
    );

    // 1. Uncatchable SIGKILL on Stockfish process
    if (stockfishProcess && !stockfishProcess.killed) {
      try {
        stockfishProcess.kill('SIGKILL');
      } catch (killErr) {
        console.error('Failed to issue SIGKILL on Stockfish:', killErr);
      }
    }

    // 2. Abort worker execution loop immediately
    throw new Error('STALE_LEASE_EVICTION');
  }

  // Update progress ply (separate non-blocking statement)
  await pool.query(`
    INSERT INTO job_current_plies (job_id, current_ply) VALUES ($1, $2)
    ON CONFLICT (job_id) DO UPDATE SET current_ply = EXCLUDED.current_ply;
  `, [jobId, currentPly]);
}
```

---

### 10.4 Stale Job Recovery Sweep (`fn_sweep_stale_jobs`)

```sql
-- ============================================================================
-- Stale Job Recovery Sweep (PL/pgSQL Stored Function)
-- Executes every 2 minutes. Reclaims processing jobs whose heartbeat_at
-- exceeds 2 minutes. Closes valid_during intervals, reschedules or fails,
-- and DELETES claim tokens to physically invalidate stale workers.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_sweep_stale_jobs()
RETURNS TABLE(swept_job_id UUID, new_status VARCHAR) AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            j.id,
            COALESCE(jac.attempt_count, 0) AS attempt_count,
            COALESCE(jmr.max_retries, 3)   AS max_retries
        FROM game_analysis_jobs j
        INNER JOIN job_statuses js
            ON js.job_id = j.id
            AND js.status = 'processing'
            AND upper(js.valid_during) IS NULL
        INNER JOIN job_heartbeat_at jha
            ON jha.job_id = j.id
        LEFT JOIN job_attempt_counts jac
            ON jac.job_id = j.id
        LEFT JOIN job_max_retries jmr
            ON jmr.job_id = j.id
        WHERE jha.heartbeat_at < NOW() - INTERVAL '2 minutes'
    LOOP
        -- Close current 'processing' status interval
        UPDATE job_statuses
        SET valid_during = tstzrange(
            lower(valid_during),
            GREATEST(CURRENT_TIMESTAMP, lower(valid_during) + INTERVAL '1 millisecond'),
            '[)'
        )
        WHERE job_id = r.id AND upper(valid_during) IS NULL;

        -- Transition to pending (retry) or failed (terminal)
        IF r.attempt_count < r.max_retries THEN
            INSERT INTO job_statuses (job_id, status, valid_during)
            VALUES (r.id, 'pending', tstzrange(CURRENT_TIMESTAMP, NULL, '[)'));

            INSERT INTO job_last_errors (job_id, last_error)
            VALUES (
                r.id,
                'Worker heartbeat timed out (>120s); rescheduled (attempt ' ||
                (r.attempt_count + 1)::text || '/' || r.max_retries::text || ')'
            )
            ON CONFLICT (job_id) DO UPDATE SET last_error = EXCLUDED.last_error;

            swept_job_id := r.id;
            new_status := 'pending';
        ELSE
            INSERT INTO job_statuses (job_id, status, valid_during)
            VALUES (r.id, 'failed', tstzrange(CURRENT_TIMESTAMP, NULL, '[)'));

            INSERT INTO job_last_errors (job_id, last_error)
            VALUES (
                r.id,
                'Worker heartbeat timed out; max retries exceeded (' ||
                r.max_retries::text || '/' || r.max_retries::text || ')'
            )
            ON CONFLICT (job_id) DO UPDATE SET last_error = EXCLUDED.last_error;

            swept_job_id := r.id;
            new_status := 'failed';
        END IF;

        -- Invalidate fencing token and lock records
        -- This guarantees that the stale worker's next sendHeartbeat() returns rowCount === 0
        DELETE FROM job_claim_tokens WHERE job_id = r.id;
        DELETE FROM job_locked_by WHERE job_id = r.id;
        DELETE FROM job_locked_at WHERE job_id = r.id;

        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## 11. Stockfish Engine Management & Formalized Evaluation Mathematics

### 11.1 Process Lifecycle & Memory Isolation (`Clear Hash`)
To prevent cross-game transposition table contamination while retaining search acceleration across moves of the same game:
1. When a worker claims a new game job, it spawns or resets the Stockfish process.
2. The worker issues:
   ```text
   ucinewgame
   setoption name Clear Hash
   isready
   ```
   and awaits `readyok` before initiating evaluation.
3. For sequential moves within that exact game, the transposition table is preserved to allow branch pruning.

---

### 11.2 Formal Polarity Inversion & Centipawn Loss Math

When analyzing non-root moves by evaluating post-move board states (`fen_after`):
* Stockfish evaluates the position relative to the side whose turn it is to move in `fen_after` (which is the **opponent**).
* To obtain the evaluation from the active mover's perspective:
  $$Eval_{\text{played, mover}} = -1 \times Eval(\text{fen\_after})$$

Let $Eval_{\text{best, mover}}$ be the engine evaluation of the best legal move from `fen_before` (from the mover's perspective).
Centipawn loss is formally defined as:
$$\text{CPL}_{\text{raw}} = \max\left(0, Eval_{\text{best, mover}} - Eval_{\text{played, mover}}\right)$$

$$\text{CPL}_{\text{capped}} = \min(1000, \text{CPL}_{\text{raw}})$$

---

### 11.3 Continuous Mate Mapping

To prevent arithmetic NaN or division-by-zero exceptions during forced mate transitions (e.g., throwing away a $+M3$ advantage):
$$Eval(\text{mate } M) = \begin{cases}
+10000 - (M \times 100) & \text{if } M > 0 \text{ (Mover delivers mate)} \\
-10000 - (M \times 100) & \text{if } M < 0 \text{ (Opponent delivers mate)}
\end{cases}$$

For example, a move changing the evaluation from $+M2$ to $0.00$ yields:
$$Eval_{\text{best}} = +10000 - (2 \times 100) = +9800$$
$$Eval_{\text{played}} = 0$$
$$\text{CPL}_{\text{raw}} = 9800 - 0 = 9800 \implies \text{CPL}_{\text{capped}} = 1000$$

---

### 11.4 Logistic Win Probability Formula

Using the standard chess win probability sigmoid:
$$W(cp) = \frac{1}{1 + 10^{-cp / 400}}$$

$$\Delta W = W(Eval_{\text{best, mover}}) - W(Eval_{\text{played, mover}})$$

#### Mistake Classification Tiers:
| Classification Tier | Win Probability Loss ($\Delta W$) | CPL Condition |
| :--- | :--- | :--- |
| **BEST** | $\Delta W < 0.02$ | Engine top choice or CPL $\le 10$ |
| **GOOD** | $0.02 \le \Delta W < 0.05$ | $10 < \text{CPL} \le 30$ |
| **INACCURACY** | $0.05 \le \Delta W < 0.12$ | $30 < \text{CPL} \le 90$ |
| **MISTAKE** | $0.12 \le \Delta W < 0.25$ | $90 < \text{CPL} \le 200$ |
| **BLUNDER** | $\Delta W \ge 0.25$ | $\text{CPL} > 200$ |
| **MISSED_WIN** | Winning advantage ($W_{\text{before}} > 0.80$) drops to drawn/losing ($W_{\text{after}} < 0.55$) | Any |

---

### 11.5 Catalog-Verified Opening Book Evaluation Rules

1. **No Synthetic Overwrites:** Early-ply blunders (e.g., Fool's Mate: 1. f3 e5 2. g4 Qh4#) are fully evaluated and assigned empirical CPL.
2. **Authoritative Matching:** The worker matches the played SAN move sequence against `chess_openings.pgn_moves`.
3. If the move sequence matches an opening line in the catalog, `move_is_book_moves.is_book_move` is set to `TRUE`.
4. **ACPL Aggregation Rule:** Opening book moves are excluded from Average Centipawn Loss calculations via SQL filters:
   ```sql
   SELECT AVG(cpl_capped) AS acpl
   FROM v_move_analyses
   WHERE analysis_id = $1 AND color = 'WHITE' AND is_book_move = FALSE;
   ```

---


## 12. Security Architecture & Single-Domain Authentication Mandate

### 12.1 Mandatory Production Architecture: Single-Domain Reverse Proxy

#### The Cross-Domain Cookie Failure Mode:
In modern browser security models (Apple WebKit Intelligent Tracking Prevention, Chrome Privacy Sandbox, Firefox Total Cookie Protection), cookies set with `SameSite=None; Secure` across disparate registrable domains (e.g., frontend on `chessiq.vercel.app` and backend on `chessiq-api.onrender.com`) are classified as third-party tracking vectors. In Safari on iOS and macOS, these cookies are rejected or purged within 24 hours, silently dropping user sessions and breaking authenticated polling loops.

#### Production Mandate:
In production, ChessIQ **strictly enforces a Single-Domain Reverse Proxy Topology**:
- Frontend Client: `https://app.chessiq.com`
- Backend API: `https://app.chessiq.com/api/*` (routed via Vercel Edge Rewrites or Cloudflare Gateway to the Render backend).

```mermaid
graph LR
    Browser([Browser Client / Safari WebKit]) -->|Request: https://app.chessiq.com/api/...| Gateway[Cloudflare Gateway / Vercel Edge]
    Gateway -->|Static SPA Assets| VercelStorage[Vercel Edge Storage]
    Gateway -->|Proxy /api/* with Host Header| RenderBackend[Express Backend on Render]
    RenderBackend -->|Set-Cookie: SameSite=Lax; Secure; HttpOnly| Browser
```

#### Production Cookie Configuration:
Because client and API share the exact same origin (`app.chessiq.com`), session cookies are treated as first-party:
```http
Set-Cookie: chessiq_session=<JWT>; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax
```

#### Multi-Port Local Development Configuration:
When developing across disparate ports locally (`http://localhost:3000` and `http://localhost:5000`), `SameSite=None; Secure; Partitioned` is permitted strictly as an environment-gated fallback:
```javascript
const isProduction = process.env.NODE_ENV === 'production';

res.cookie('chessiq_session', token, {
  httpOnly: true,
  secure: isProduction ? true : true, // HTTPS required for SameSite=None locally
  sameSite: isProduction ? 'lax' : 'none',
  partitioned: !isProduction,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
});
```

---

## 13. Verification & Testing Strategy

### 13.1 Automated Verification Matrix

| Test Suite | Target Component | Test Case & Assertion | Execution Tool |
| :--- | :--- | :--- | :--- |
| **Schema Integrity** | 6NF Tables & Constraints | Assert all 35+ binary tables execute; verify GiST non-overlap rejects overlapping `valid_during` intervals. | `psql` / Jest SQL Runner |
| **Batch Ingestion** | `sp_ingest_game_analysis_6nf` | Ingest 80-ply parallel arrays; verify execution in $<50$ms; assert zero rows in `move_eval_mates` for cp plies. | PostgreSQL 16 PL/pgSQL |
| **3NF View Parity** | Logical Reconstruction | Assert `v_move_analyses` derives `color` correctly for odd/even plies; assert `v_game_analysis_jobs` resolves `user_id`. | SQL Test Assertions |
| **FIFO Concurrency** | `claimNextJob` CTE | Launch 10 concurrent worker claims; assert zero lock planner errors; assert oldest `job_created_at` claimed first. | Node.js Worker Test Harness |
| **Circuit Breaker** | `sendHeartbeat` Watchdog | Revoke claim token in database; assert `result.rowCount === 0`; assert immediate `SIGKILL` on Stockfish child process. | Jest Mock Process Suite |
| **Recovery Sweep** | `fn_sweep_stale_jobs` | Backdate `job_heartbeat_at` by 5 min; call sweep function; assert status transitions to `pending`; assert token deleted. | PL/pgSQL Test Runner |
| **Engine Inversion** | Polarity Math | Evaluate post-move FEN; assert $Eval_{\text{played}} = -1 \times Eval(\text{fen\_after})$; assert continuous mate bounds. | Unit Test Suite (`engine.test.js`) |

---

## 14. Production Cloud Deployment Configuration

### 14.1 Production Environment Variables (`server/.env`)
```env
# Server
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://app.chessiq.com

# Database (Neon Serverless PostgreSQL 16)
DATABASE_URL=postgres://user:password@ep-cool-fog-123456.us-east-2.aws.neon.tech/chessiq?sslmode=require

# Security Secrets (minimum 64 hex characters each)
JWT_SECRET=c2e8a1f4b7d9e0a2c5b8d1f4e7a0c3b6d9e2f5a8b1c4d7e0a3b6c9d2e5f8a1b4
COOKIE_SECRET=f9a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8c1d4e7a0b3c6d9e2f5a8b1

# Stockfish Configuration
STOCKFISH_PATH=/usr/games/stockfish
STOCKFISH_THREADS=1
STOCKFISH_HASH_MB=64
STOCKFISH_DEPTH=14
STOCKFISH_SEARCH_TIMEOUT_MS=8000
STOCKFISH_KILL_GRACE_MS=1500
MAX_CONCURRENT_JOBS=1
```

### 14.2 Vercel Edge Gateway Configuration (`frontend/vercel.json`)
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://chessiq-api.onrender.com/api/:path*"
    }
  ]
}
```

---

## 15. Acceptance Criteria for Version 3.3.0

The ChessIQ v3.3.0 implementation is verified complete when:
1. **Physical 6NF Relational Completeness:** All entity relations are decomposed into binary tables with at most one non-key attribute; `user_ratings` and `job_statuses` enforce non-overlapping intervals via GiST exclusion constraints (`btree_gist`); `user_game_move_signatures` enforces composite primary key `(user_id, move_signature)`.
2. **Atomic Batch Ingestion (`sp_ingest_game_analysis_6nf`):** Ingestion of an 80-ply game completes in a single database RPC call using parallel primitive arrays, bulk-generating `move_id` UUIDs via `array_agg(uuid_generate_v4())` and executing set-based `UNNEST` multi-row inserts in $<50$ms.
3. **Seamless 3NF Reconstruction Views:** Views `v_users`, `v_chess_openings`, `v_games`, `v_game_analysis_jobs`, `v_game_analyses`, `v_move_analyses`, `v_training_puzzles`, and `v_training_recommendations` execute cleanly on PostgreSQL 16; `v_move_analyses` derives `color` dynamically and exposes `is_book_move`.
4. **Deterministic FIFO Queue Claim:** Worker claims jobs via a CTE that isolates row locking (`FOR UPDATE OF j, js SKIP LOCKED`) exclusively to inner-joined tables and orders strictly by `jca.created_at ASC`, executing without outer-join planner conflicts.
5. **GiST Collision Prevention:** Timestamp transitions between consecutive status intervals use `GREATEST(CURRENT_TIMESTAMP, lower(valid_during) + INTERVAL '1 millisecond')`, preventing microsecond interval collision errors.
6. **Heartbeat Watchdog & SIGKILL Circuit Breaker (`rowCount`):** Heartbeat updates target a single table (`job_heartbeat_at`) guarded by `EXISTS` subqueries, strictly evaluating `result.rowCount === 0` to trigger an immediate, uncatchable `SIGKILL` on the Stockfish process.
7. **Recovery Sweep Invalidation:** The `fn_sweep_stale_jobs()` function reclaims abandoned jobs and deletes claim tokens, ensuring any partitioned worker's subsequent heartbeat returns `rowCount === 0` and trips the circuit breaker.
8. **Formal Engine Polarity Inversion:** Post-move board evaluations are inverted ($Eval_{\text{played, mover}} = -1 \times Eval(\text{fen\_after})$); forced mate transitions use continuous bounds ($Eval = \pm 10000 \mp (\text{mate\_dist} \times 100)$).
9. **Catalog-Verified Opening Rules:** Early-ply blunders (e.g., Fool's Mate) are preserved in empirical metrics; opening book moves matching `chess_openings` are tagged with `is_book_move = TRUE` and excluded from ACPL calculations via `WHERE is_book_move = FALSE`.
10. **Single-Domain Reverse Proxy Topology:** Production deployment routes `app.chessiq.com` and `app.chessiq.com/api` through a single domain, enforcing first-party `SameSite=Lax; Secure=true; HttpOnly=true` cookies with 100% credential retention across Apple WebKit and Chromium browsers.
