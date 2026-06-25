-- Migration: add started_at to game_sessions
-- Stores the real game start timestamp so duration is always computable
-- as (played_at - started_at) regardless of what was stored in duration_ms.
-- Existing rows get started_at = NULL (fallback to duration_ms for display).

ALTER TABLE game_sessions
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- For existing rows: estimate started_at from played_at and duration_ms
-- only when duration_ms looks plausible (> 60 seconds).
-- Rows with obviously wrong duration (e.g. 47s from the RedisSyncBus bug)
-- are left as NULL so the UI shows "—" rather than a wrong value.
UPDATE game_sessions
SET started_at = played_at - (duration_ms * INTERVAL '1 millisecond')
WHERE duration_ms IS NOT NULL
  AND duration_ms > 60000;
