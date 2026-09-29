-- Migration: add game_sessions table
-- Stores a persistent snapshot of each completed or abandoned game.
-- Used for post-game CSV export and (future) match history.

CREATE TABLE IF NOT EXISTS game_sessions (
    id              SERIAL PRIMARY KEY,
    pin             VARCHAR(20)  NOT NULL,
    game_type       VARCHAR(50),
    played_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    duration_ms     INTEGER,
    player_count    INTEGER      NOT NULL DEFAULT 0,
    question_count  INTEGER      NOT NULL DEFAULT 0,
    reason          VARCHAR(50)  NOT NULL DEFAULT 'completed',
    final_ranking   JSONB        NOT NULL DEFAULT '[]',
    questions_snapshot JSONB     NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_pin       ON game_sessions(pin);
CREATE INDEX IF NOT EXISTS idx_game_sessions_played_at ON game_sessions(played_at DESC);
