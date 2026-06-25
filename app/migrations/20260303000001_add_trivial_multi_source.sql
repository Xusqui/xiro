-- MIGRATION: Allow trivial categories to source from banks, games or custom_games
ALTER TABLE trivial_categories ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'bank';
ALTER TABLE trivial_categories ADD COLUMN IF NOT EXISTS source_id INTEGER;
UPDATE trivial_categories SET source_type = 'bank', source_id = bank_id WHERE source_id IS NULL AND bank_id IS NOT NULL;
