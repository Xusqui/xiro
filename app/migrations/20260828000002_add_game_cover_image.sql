-- =====================================================
-- Migración: 20260828000002_add_game_cover_image
-- Descripción: Agregar imagen representativa (portada) a cada
--              tipo de juego: bancos, personalizados, mezclas
--              y trivial. Máx. 1 MB, formatos JPG/PNG/GIF/WebP.
-- Autor: Sistema
-- Fecha: 2026-08-28
-- =====================================================

ALTER TABLE question_banks
    ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

ALTER TABLE custom_games
    ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

ALTER TABLE games
    ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

ALTER TABLE trivial_games
    ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

COMMENT ON COLUMN question_banks.image_url IS
    'URL relativa de la imagen de portada del banco (máx. 1 MB).';
COMMENT ON COLUMN custom_games.image_url IS
    'URL relativa de la imagen de portada del juego personalizado (máx. 1 MB).';
COMMENT ON COLUMN games.image_url IS
    'URL relativa de la imagen de portada de la mezcla de preguntas (máx. 1 MB).';
COMMENT ON COLUMN trivial_games.image_url IS
    'URL relativa de la imagen de portada del trivial (máx. 1 MB).';

DO $$
BEGIN
    RAISE NOTICE '✅ Columna image_url añadida a question_banks, custom_games, games y trivial_games';
END $$;
