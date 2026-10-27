-- ============================================================================
-- ChessIQ v3.3.0 — Migration 000: Initialize Extensions & Baseline Diagnostics
-- Target Engine: PostgreSQL 16.x / 17.x
-- ============================================================================

-- Step 1: Enable Core Extensions Required for 6NF Decomposed Architecture
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Step 2: Establish Migration Audit Table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    execution_ms INT NOT NULL
);

-- Step 3: Diagnostic Verification Function for 6NF Baseline Readiness
CREATE OR REPLACE FUNCTION fn_verify_6nf_baseline()
RETURNS JSONB AS $$
DECLARE
    v_server_version_num INT;
    v_server_version TEXT;
    v_has_uuid_ossp BOOLEAN;
    v_has_btree_gist BOOLEAN;
    v_has_gist_am BOOLEAN;
    v_result JSONB;
BEGIN
    -- 1. Assert PostgreSQL Server Version >= 16.0 (160000)
    SELECT current_setting('server_version_num')::INT, version()
    INTO v_server_version_num, v_server_version;

    IF v_server_version_num < 160000 THEN
        RAISE EXCEPTION 'ChessIQ 6NF Engine requires PostgreSQL 16.0 or higher. Current version: % (%)',
            v_server_version, v_server_version_num;
    END IF;

    -- 2. Verify uuid-ossp Extension
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
    ) INTO v_has_uuid_ossp;

    IF NOT v_has_uuid_ossp THEN
        RAISE EXCEPTION 'Mandatory extension "uuid-ossp" is missing from pg_extension.';
    END IF;

    -- 3. Verify btree_gist Extension (Required for GiST exclusion constraints on temporal intervals)
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'
    ) INTO v_has_btree_gist;

    IF NOT v_has_btree_gist THEN
        RAISE EXCEPTION 'Mandatory extension "btree_gist" is missing from pg_extension.';
    END IF;

    -- 4. Verify GiST Index Access Method
    SELECT EXISTS (
        SELECT 1 FROM pg_am WHERE amname = 'gist'
    ) INTO v_has_gist_am;

    IF NOT v_has_gist_am THEN
        RAISE EXCEPTION 'GiST access method is not registered in pg_am.';
    END IF;

    -- Build Telemetry Payload
    v_result := jsonb_build_object(
        'status', 'PASSED',
        'server_version_num', v_server_version_num,
        'server_version', v_server_version,
        'uuid_ossp_installed', v_has_uuid_ossp,
        'btree_gist_installed', v_has_btree_gist,
        'gist_am_available', v_has_gist_am,
        'timestamp', CURRENT_TIMESTAMP
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
