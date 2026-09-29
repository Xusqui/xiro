-- =====================================================
-- CONFIGURACIÓN DE RACHAS (STREAK CONFIG) - Phase 19
-- XIRO! Trivia System
-- =====================================================
-- Fecha: 3 de marzo de 2026
-- Objetivo: Agregar flags de activación y configuración de doble racha
--
-- COLUMNAS EXISTENTES (migration 20260203000001):
--   games.streak_threshold            INTEGER DEFAULT 3
--   games.streak_bonus_percentage     DECIMAL(3,2) DEFAULT 0.50
--   games.team_streak_enabled         BOOLEAN DEFAULT true
--   games.team_streak_bonus_percentage DECIMAL(3,2) DEFAULT 0.50
--
-- NUEVAS COLUMNAS:
--   games.use_streaks                     BOOLEAN DEFAULT false
--   games.use_double_streaks              BOOLEAN DEFAULT false
--   games.double_streak_threshold         INTEGER DEFAULT 5
--   games.double_streak_bonus_percentage  DECIMAL(3,2) DEFAULT 1.00
-- =====================================================

BEGIN;

-- =====================================================
-- TABLA games: Flags de activación de rachas
-- =====================================================

ALTER TABLE games
    ADD COLUMN IF NOT EXISTS use_streaks BOOLEAN DEFAULT false;

COMMENT ON COLUMN games.use_streaks IS
    'Si TRUE, aplica bonus de racha individual en este juego';

ALTER TABLE games
    ADD COLUMN IF NOT EXISTS use_double_streaks BOOLEAN DEFAULT false;

COMMENT ON COLUMN games.use_double_streaks IS
    'Si TRUE, aplica bonus de doble racha cuando se alcanza double_streak_threshold';

ALTER TABLE games
    ADD COLUMN IF NOT EXISTS double_streak_threshold INTEGER DEFAULT 5;

COMMENT ON COLUMN games.double_streak_threshold IS
    'Número de respuestas correctas consecutivas para activar la doble racha (default: 5)';

ALTER TABLE games
    ADD COLUMN IF NOT EXISTS double_streak_bonus_percentage DECIMAL(3,2) DEFAULT 1.00;

COMMENT ON COLUMN games.double_streak_bonus_percentage IS
    'Porcentaje de bonus por doble racha (ej: 1.00 = +100%)';

-- =====================================================
-- VALIDACIONES
-- =====================================================

ALTER TABLE games
    ADD CONSTRAINT chk_double_streak_threshold_positive
    CHECK (double_streak_threshold > 0);

ALTER TABLE games
    ADD CONSTRAINT chk_double_streak_bonus_range
    CHECK (double_streak_bonus_percentage >= 0 AND double_streak_bonus_percentage <= 2.00);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'games' AND column_name = 'use_streaks'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna use_streaks no creada en games';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'games' AND column_name = 'use_double_streaks'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna use_double_streaks no creada en games';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'games' AND column_name = 'double_streak_threshold'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna double_streak_threshold no creada en games';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'games' AND column_name = 'double_streak_bonus_percentage'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna double_streak_bonus_percentage no creada en games';
    END IF;

    RAISE NOTICE 'OK: Columnas de configuración de rachas creadas en games';
END $$;

COMMIT;

-- =====================================================
-- RESUMEN
-- =====================================================
--
-- TABLA games:
--   + use_streaks BOOLEAN DEFAULT false
--   + use_double_streaks BOOLEAN DEFAULT false
--   + double_streak_threshold INTEGER DEFAULT 5
--   + double_streak_bonus_percentage DECIMAL(3,2) DEFAULT 1.00
--   + chk_double_streak_threshold_positive
--   + chk_double_streak_bonus_range
--
-- BACKWARD COMPATIBILITY: ✅
--   - Todas las columnas tienen DEFAULT
--   - Juegos existentes tendrán use_streaks=false (sin bonus) por defecto
-- =====================================================
