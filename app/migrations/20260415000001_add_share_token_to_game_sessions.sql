-- Migration: add share_token column for public result sharing
-- Allows sharing game results via a non-guessable UUID token instead of sequential IDs.

ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_sessions_share_token ON game_sessions(share_token);
