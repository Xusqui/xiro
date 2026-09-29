-- Migration: add player_answers column to game_sessions
-- Stores per-player per-question detail: answer given, isCorrect, pointsEarned, responseTimeMs

ALTER TABLE game_sessions
    ADD COLUMN IF NOT EXISTS player_answers JSONB NOT NULL DEFAULT '{}';
