-- Migration: backfill share_token for existing game sessions that have NULL
-- The ADD COLUMN DEFAULT in 20260415000001 only covers new rows; this UPDATE
-- ensures every historical session gets a non-guessable share token.

UPDATE game_sessions
SET share_token = gen_random_uuid()
WHERE share_token IS NULL;
