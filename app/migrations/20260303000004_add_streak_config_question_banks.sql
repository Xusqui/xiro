-- Migration: Add streak configuration columns to question_banks table
-- Date: 2026-03-03

BEGIN;

ALTER TABLE question_banks
    ADD COLUMN IF NOT EXISTS use_streaks BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS streak_threshold INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS streak_bonus_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.50,
    ADD COLUMN IF NOT EXISTS use_double_streaks BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS double_streak_threshold INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS double_streak_bonus_percentage NUMERIC(5,2) NOT NULL DEFAULT 1.00;

-- Add check constraints (safe pattern for PostgreSQL)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'question_banks_streak_threshold_check'
    ) THEN
        ALTER TABLE question_banks ADD CONSTRAINT question_banks_streak_threshold_check
            CHECK (streak_threshold BETWEEN 1 AND 20);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'question_banks_streak_bonus_check'
    ) THEN
        ALTER TABLE question_banks ADD CONSTRAINT question_banks_streak_bonus_check
            CHECK (streak_bonus_percentage BETWEEN 0 AND 2);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'question_banks_double_streak_threshold_check'
    ) THEN
        ALTER TABLE question_banks ADD CONSTRAINT question_banks_double_streak_threshold_check
            CHECK (double_streak_threshold BETWEEN 1 AND 20);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'question_banks_double_streak_bonus_check'
    ) THEN
        ALTER TABLE question_banks ADD CONSTRAINT question_banks_double_streak_bonus_check
            CHECK (double_streak_bonus_percentage BETWEEN 0 AND 2);
    END IF;
END $$;

COMMIT;
