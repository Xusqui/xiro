-- =====================================================
-- ÍNDICES COMPUESTOS PARA OPTIMIZACIÓN ADICIONAL
-- XIRO! Trivia System - Fase 2
-- =====================================================
-- Fecha: 2 de febrero de 2026
-- Objetivo: Optimizar queries con múltiples condiciones WHERE
-- 
-- INSTRUCCIONES:
-- 1. Hacer backup de la base de datos antes de ejecutar
-- 2. Ejecutar en horario de bajo tráfico (tardará ~10 segundos)
-- 3. Verificar que se crearon correctamente con \di
-- =====================================================

BEGIN;

-- =====================================================
-- ÍNDICES COMPUESTOS PARA visible_to_presenter
-- =====================================================

-- Optimiza: WHERE pin = $1 AND visible_to_presenter = true
-- Impacto: validatePinForPresenter (query frecuente)
CREATE INDEX IF NOT EXISTS idx_games_pin_visible 
    ON games(pin, visible_to_presenter)
    WHERE visible_to_presenter = true;

COMMENT ON INDEX idx_games_pin_visible IS 
    'Índice parcial para games visibles a presentador - Reduce scan en validatePinForPresenter';

CREATE INDEX IF NOT EXISTS idx_question_banks_pin_visible 
    ON question_banks(pin, visible_to_presenter)
    WHERE visible_to_presenter = true;

COMMENT ON INDEX idx_question_banks_pin_visible IS 
    'Índice parcial para banks visibles a presentador - Optimiza filtrado por visibilidad';

CREATE INDEX IF NOT EXISTS idx_custom_games_pin_visible 
    ON custom_games(pin, visible_to_presenter)
    WHERE visible_to_presenter = true;

COMMENT ON INDEX idx_custom_games_pin_visible IS 
    'Índice parcial para custom games visibles - Solo registros con visible_to_presenter=true';

-- =====================================================
-- ÍNDICE COMPUESTO PARA custom_game_questions
-- =====================================================

-- Optimiza: WHERE custom_game_id = $1 ORDER BY position
-- Impacto: getCustomGameWithQuestions (query frecuente)
CREATE INDEX IF NOT EXISTS idx_custom_game_questions_game_position 
    ON custom_game_questions(custom_game_id, position);

COMMENT ON INDEX idx_custom_game_questions_game_position IS 
    'Índice compuesto para ordenar preguntas por posición - Elimina filesort en ORDER BY';

-- =====================================================
-- ANÁLISIS DE ÍNDICES DUPLICADOS (cleanup)
-- =====================================================

-- Nota: idx_custom_game_questions_game_id puede ser redundante ahora
-- que tenemos idx_custom_game_questions_game_position (custom_game_id, position)
-- PostgreSQL puede usar el índice compuesto para queries solo con custom_game_id
-- 
-- Consideración: Mantener ambos por ahora, monitorear uso con pg_stat_user_indexes
-- Si idx_custom_game_questions_game_id no se usa en 30 días, eliminar con:
-- DROP INDEX IF EXISTS idx_custom_game_questions_game_id;

COMMIT;

-- =====================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =====================================================

-- Ejecutar después de la migración para verificar:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE indexname LIKE 'idx_%'
-- ORDER BY idx_scan DESC;

-- Tamaño de índices:
-- SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size
-- FROM pg_indexes
-- WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
-- ORDER BY pg_relation_size(indexname::regclass) DESC;
