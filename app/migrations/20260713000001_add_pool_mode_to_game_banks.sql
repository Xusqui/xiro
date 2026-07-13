-- =====================================================
-- Migración: 20260713000001_add_pool_mode_to_game_banks
-- Descripción: Permite marcar bancos de una Mezcla de Preguntas
--              (games/game_banks) como "sin cantidad fija": esos
--              bancos se combinan en un pool compartido del que se
--              extrae un número total configurable de preguntas al
--              azar, en vez de una cuota fija por banco.
--              game_banks.question_count NULL => banco en modo pool.
--              games.pool_question_count => total a extraer del pool.
-- Autor: Sistema
-- Fecha: 2026-07-13
-- =====================================================

ALTER TABLE IF EXISTS game_banks
    ALTER COLUMN question_count DROP NOT NULL;

ALTER TABLE IF EXISTS games
    ADD COLUMN IF NOT EXISTS pool_question_count INTEGER;

-- Log de finalización
DO $$
BEGIN
    RAISE NOTICE '✅ Modo pool añadido a game_banks/games (Mezcla de Preguntas)';
END $$;
