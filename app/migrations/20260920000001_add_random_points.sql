-- =====================================================
-- Migración: 20260920000001_add_random_points
-- Descripción: Puntuación aleatoria por pregunta. Cada juego puede
--              activar un rango [mín, máx] del que se sortea un entero
--              antes de cada pregunta elegible (quiz y anagrama); ese
--              valor sustituye a BASE_POINTS al puntuar esa pregunta.
--              Se aplica a los 4 tipos de juego: bancos, mezclas,
--              personalizados y trivial.
-- Autor: Sistema
-- Fecha: 2026-09-20
-- =====================================================

ALTER TABLE question_banks
    ADD COLUMN IF NOT EXISTS use_random_points BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS random_points_min INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS random_points_max INTEGER NOT NULL DEFAULT 50;

ALTER TABLE games
    ADD COLUMN IF NOT EXISTS use_random_points BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS random_points_min INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS random_points_max INTEGER NOT NULL DEFAULT 50;

ALTER TABLE custom_games
    ADD COLUMN IF NOT EXISTS use_random_points BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS random_points_min INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS random_points_max INTEGER NOT NULL DEFAULT 50;

ALTER TABLE trivial_games
    ADD COLUMN IF NOT EXISTS use_random_points BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS random_points_min INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS random_points_max INTEGER NOT NULL DEFAULT 50;

COMMENT ON COLUMN question_banks.use_random_points IS
    'Si true, cada pregunta elegible (quiz, word_scramble) sortea sus puntos base en [random_points_min, random_points_max].';
COMMENT ON COLUMN question_banks.random_points_min IS
    'Puntos base mínimos del sorteo (entero >= 1, <= random_points_max).';
COMMENT ON COLUMN question_banks.random_points_max IS
    'Puntos base máximos del sorteo (entero <= 500, >= random_points_min).';

COMMENT ON COLUMN games.use_random_points IS
    'Si true, cada pregunta elegible (quiz, word_scramble) sortea sus puntos base en [random_points_min, random_points_max].';
COMMENT ON COLUMN games.random_points_min IS
    'Puntos base mínimos del sorteo (entero >= 1, <= random_points_max).';
COMMENT ON COLUMN games.random_points_max IS
    'Puntos base máximos del sorteo (entero <= 500, >= random_points_min).';

COMMENT ON COLUMN custom_games.use_random_points IS
    'Si true, cada pregunta elegible (quiz, word_scramble) sortea sus puntos base en [random_points_min, random_points_max].';
COMMENT ON COLUMN custom_games.random_points_min IS
    'Puntos base mínimos del sorteo (entero >= 1, <= random_points_max).';
COMMENT ON COLUMN custom_games.random_points_max IS
    'Puntos base máximos del sorteo (entero <= 500, >= random_points_min).';

COMMENT ON COLUMN trivial_games.use_random_points IS
    'Si true, cada pregunta elegible (quiz, word_scramble) sortea sus puntos base en [random_points_min, random_points_max].';
COMMENT ON COLUMN trivial_games.random_points_min IS
    'Puntos base mínimos del sorteo (entero >= 1, <= random_points_max).';
COMMENT ON COLUMN trivial_games.random_points_max IS
    'Puntos base máximos del sorteo (entero <= 500, >= random_points_min).';

-- Constraints idempotentes (mismo patrón que 20260303000003/4_add_streak_config*)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['question_banks', 'games', 'custom_games', 'trivial_games']
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = tbl || '_random_points_min_check') THEN
            EXECUTE format(
                'ALTER TABLE %I ADD CONSTRAINT %I CHECK (random_points_min BETWEEN 1 AND 500)',
                tbl, tbl || '_random_points_min_check');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = tbl || '_random_points_max_check') THEN
            EXECUTE format(
                'ALTER TABLE %I ADD CONSTRAINT %I CHECK (random_points_max BETWEEN 1 AND 500)',
                tbl, tbl || '_random_points_max_check');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = tbl || '_random_points_range_check') THEN
            EXECUTE format(
                'ALTER TABLE %I ADD CONSTRAINT %I CHECK (random_points_max >= random_points_min)',
                tbl, tbl || '_random_points_range_check');
        END IF;
    END LOOP;
END $$;

DO $$
BEGIN
    RAISE NOTICE '✅ Columnas use_random_points, random_points_min y random_points_max añadidas a question_banks, games, custom_games y trivial_games';
END $$;
