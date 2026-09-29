-- =====================================================
-- CONFIGURACIÓN DE RACHAS EN TRIVIAL Y PERSONALIZADO
-- XIRO! Trivia System
-- =====================================================
-- Fecha: 3 de marzo de 2026
-- Objetivo: Agregar configuración de rachas a trivial_games y custom_games
--
-- NOTA: La tabla 'games' (Mezcla de Preguntas) ya tiene estas columnas:
--   - streak_threshold, streak_bonus_percentage (desde 20260203000001)
--   - use_streaks, use_double_streaks, double_streak_threshold,
--     double_streak_bonus_percentage (desde 20260303000002)
--
-- NUEVAS COLUMNAS en trivial_games y custom_games:
--   + use_streaks BOOLEAN DEFAULT false
--   + streak_threshold INTEGER DEFAULT 3
--   + streak_bonus_percentage DECIMAL(3,2) DEFAULT 0.50
--   + use_double_streaks BOOLEAN DEFAULT false
--   + double_streak_threshold INTEGER DEFAULT 5
--   + double_streak_bonus_percentage DECIMAL(3,2) DEFAULT 1.00
-- =====================================================

BEGIN;

-- =====================================================
-- TABLA trivial_games
-- =====================================================

ALTER TABLE trivial_games
    ADD COLUMN IF NOT EXISTS use_streaks BOOLEAN DEFAULT false;

ALTER TABLE trivial_games
    ADD COLUMN IF NOT EXISTS streak_threshold INTEGER DEFAULT 3;

ALTER TABLE trivial_games
    ADD COLUMN IF NOT EXISTS streak_bonus_percentage DECIMAL(3,2) DEFAULT 0.50;

ALTER TABLE trivial_games
    ADD COLUMN IF NOT EXISTS use_double_streaks BOOLEAN DEFAULT false;

ALTER TABLE trivial_games
    ADD COLUMN IF NOT EXISTS double_streak_threshold INTEGER DEFAULT 5;

ALTER TABLE trivial_games
    ADD COLUMN IF NOT EXISTS double_streak_bonus_percentage DECIMAL(3,2) DEFAULT 1.00;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trivial_streak_threshold_positive') THEN
        ALTER TABLE trivial_games ADD CONSTRAINT chk_trivial_streak_threshold_positive CHECK (streak_threshold > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trivial_double_threshold_positive') THEN
        ALTER TABLE trivial_games ADD CONSTRAINT chk_trivial_double_threshold_positive CHECK (double_streak_threshold > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trivial_streak_bonus_range') THEN
        ALTER TABLE trivial_games ADD CONSTRAINT chk_trivial_streak_bonus_range CHECK (streak_bonus_percentage >= 0 AND streak_bonus_percentage <= 2.00);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trivial_double_streak_bonus_range') THEN
        ALTER TABLE trivial_games ADD CONSTRAINT chk_trivial_double_streak_bonus_range CHECK (double_streak_bonus_percentage >= 0 AND double_streak_bonus_percentage <= 2.00);
    END IF;
END $$;

-- =====================================================
-- TABLA custom_games
-- =====================================================

ALTER TABLE custom_games
    ADD COLUMN IF NOT EXISTS use_streaks BOOLEAN DEFAULT false;

ALTER TABLE custom_games
    ADD COLUMN IF NOT EXISTS streak_threshold INTEGER DEFAULT 3;

ALTER TABLE custom_games
    ADD COLUMN IF NOT EXISTS streak_bonus_percentage DECIMAL(3,2) DEFAULT 0.50;

ALTER TABLE custom_games
    ADD COLUMN IF NOT EXISTS use_double_streaks BOOLEAN DEFAULT false;

ALTER TABLE custom_games
    ADD COLUMN IF NOT EXISTS double_streak_threshold INTEGER DEFAULT 5;

ALTER TABLE custom_games
    ADD COLUMN IF NOT EXISTS double_streak_bonus_percentage DECIMAL(3,2) DEFAULT 1.00;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_custom_streak_threshold_positive') THEN
        ALTER TABLE custom_games ADD CONSTRAINT chk_custom_streak_threshold_positive CHECK (streak_threshold > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_custom_double_threshold_positive') THEN
        ALTER TABLE custom_games ADD CONSTRAINT chk_custom_double_threshold_positive CHECK (double_streak_threshold > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_custom_streak_bonus_range') THEN
        ALTER TABLE custom_games ADD CONSTRAINT chk_custom_streak_bonus_range CHECK (streak_bonus_percentage >= 0 AND streak_bonus_percentage <= 2.00);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_custom_double_streak_bonus_range') THEN
        ALTER TABLE custom_games ADD CONSTRAINT chk_custom_double_streak_bonus_range CHECK (double_streak_bonus_percentage >= 0 AND double_streak_bonus_percentage <= 2.00);
    END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trivial_games' AND column_name = 'use_streaks'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna use_streaks no creada en trivial_games';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'custom_games' AND column_name = 'use_streaks'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna use_streaks no creada en custom_games';
    END IF;

    RAISE NOTICE 'OK: Columnas de configuración de rachas creadas en trivial_games y custom_games';
END $$;

COMMIT;
