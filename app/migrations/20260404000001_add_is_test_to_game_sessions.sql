-- Migration: add is_test flag to game_sessions
-- Games played via load-testing scripts (PINs starting with "TEST") are
-- automatically marked as test sessions so they can be excluded from the
-- admin history view without being deleted.

ALTER TABLE game_sessions
    ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_game_sessions_is_test ON game_sessions(is_test);

-- Back-fill: mark any existing sessions whose PIN is not purely numeric as test games.
-- Real PINs are always 6-digit numbers; non-numeric PINs (ROOM1, TEST123, UNDEFINED, …)
-- come from integration tests or load-testing scripts.
UPDATE game_sessions SET is_test = TRUE WHERE pin !~ '^\d+$';
