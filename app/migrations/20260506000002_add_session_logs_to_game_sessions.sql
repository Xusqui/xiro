-- Migration: add persisted per-session logs to game_sessions

ALTER TABLE game_sessions
ADD COLUMN IF NOT EXISTS session_logs JSONB NOT NULL DEFAULT '[]'::jsonb;
