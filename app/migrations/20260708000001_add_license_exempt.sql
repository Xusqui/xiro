-- =====================================================
-- Migración: 20260708000001_add_license_exempt
-- Descripción: Permite al administrador "liberar" contenido de
--              editores sin licencia: el contenido exento se trata
--              como si lo hubiera creado el administrador (la
--              licencia de sitio lo desbloquea). Reversible.
-- Autor: Sistema
-- Fecha: 2026-07-08
-- =====================================================

ALTER TABLE IF EXISTS question_banks
    ADD COLUMN IF NOT EXISTS license_exempt BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS games
    ADD COLUMN IF NOT EXISTS license_exempt BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS custom_games
    ADD COLUMN IF NOT EXISTS license_exempt BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS trivial_games
    ADD COLUMN IF NOT EXISTS license_exempt BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS quizzes
    ADD COLUMN IF NOT EXISTS license_exempt BOOLEAN NOT NULL DEFAULT false;

-- Log de finalización
DO $$
BEGIN
    RAISE NOTICE '✅ Columna license_exempt añadida a las tablas de contenido';
END $$;
