-- =====================================================
-- MIGRATION: Trivial Pursuit Game Type
-- Date: 2026-02-21
-- =====================================================

-- Main trivial game table
CREATE TABLE IF NOT EXISTS trivial_games (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  pin VARCHAR(10) UNIQUE NOT NULL,
  outer_casillas INTEGER NOT NULL DEFAULT 24,
  visible_to_presenter BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories for each trivial game (2-6 per game)
CREATE TABLE IF NOT EXISTS trivial_categories (
  id SERIAL PRIMARY KEY,
  trivial_id INTEGER REFERENCES trivial_games(id) ON DELETE CASCADE,
  category_name VARCHAR(255) NOT NULL,
  color VARCHAR(7) NOT NULL,
  bank_id INTEGER REFERENCES question_banks(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  UNIQUE(trivial_id, position)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trivial_games_pin ON trivial_games(pin);
CREATE INDEX IF NOT EXISTS idx_trivial_categories_trivial_id ON trivial_categories(trivial_id);
