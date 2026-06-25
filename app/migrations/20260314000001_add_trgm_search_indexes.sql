-- =====================================================
-- ÍNDICES GIN (pg_trgm) PARA BÚSQUEDA DE TEXTO
-- XIRO! Trivia System
-- =====================================================
-- Fecha: 14 de marzo de 2026
-- Objetivo: Eliminar full scan en searchQuestions
--           ILIKE '%query%' sin índice → O(n) por fila
--           Con GIN trigram → O(log n)
--
-- INSTRUCCIONES:
-- Ejecutar en el servidor:
--   docker exec -i xiro_postgres psql -U postgres -d xiro_db < migrations/20260314000001_add_trgm_search_indexes.sql
-- Duración estimada: <5 segundos en tablas de tamaño normal
-- =====================================================

BEGIN;

-- Activar extensión pg_trgm (viene incluida en PostgreSQL, solo hay que habilitarla)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice GIN en question_text para ILIKE '%query%'
CREATE INDEX IF NOT EXISTS idx_questions_text_trgm
    ON questions USING gin(question_text gin_trgm_ops);

COMMENT ON INDEX idx_questions_text_trgm IS
    'Optimiza búsqueda ILIKE en question_text — elimina full scan';

-- Índice GIN en option_text para el EXISTS correlacionado
CREATE INDEX IF NOT EXISTS idx_options_text_trgm
    ON options USING gin(option_text gin_trgm_ops);

COMMENT ON INDEX idx_options_text_trgm IS
    'Optimiza búsqueda ILIKE en option_text — elimina full scan en el EXISTS de searchQuestions';

COMMIT;
