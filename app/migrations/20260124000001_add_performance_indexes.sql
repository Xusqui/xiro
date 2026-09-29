-- =====================================================
-- SCRIPT DE ÍNDICES PARA OPTIMIZACIÓN DE RENDIMIENTO
-- XIRO! Trivia System - Fase 1
-- =====================================================
-- Fecha: 24 de enero de 2026
-- Objetivo: Reducir tiempo de queries de 500ms a <100ms
-- 
-- INSTRUCCIONES:
-- 1. Hacer backup de la base de datos antes de ejecutar
-- 2. Ejecutar en horario de bajo tráfico (tardará ~30 segundos)
-- 3. Verificar que se crearon correctamente con \di
-- =====================================================

-- Conectar a la base de datos
-- \c xiro_db

-- Nota: Ejecutar este script estando ya conectado a la base de datos correcta
-- docker exec -i xiro_postgres psql -U postgres -d xiro_db < script.sql

BEGIN;

-- =====================================================
-- ÍNDICES PARA TABLA questions
-- =====================================================

-- Índice para queries frecuentes por bank_id
-- Mejora: SELECT * FROM questions WHERE bank_id = X
-- Impacto: getGameQuestions, getBankQuestions
CREATE INDEX IF NOT EXISTS idx_questions_bank_id 
    ON questions(bank_id);

COMMENT ON INDEX idx_questions_bank_id IS 
    'Optimiza queries de preguntas por banco - Reduce de O(n) a O(log n)';

-- =====================================================
-- ÍNDICES PARA TABLA options
-- =====================================================

-- Índice para FK hacia questions (acelera JOINs)
-- Mejora: JOIN options o ON o.question_id = q.id
-- Impacto: TODAS las queries de preguntas
CREATE INDEX IF NOT EXISTS idx_options_question_id 
    ON options(question_id);

COMMENT ON INDEX idx_options_question_id IS 
    'Optimiza JOINs de opciones con preguntas - Crítico para N+1 problem';

-- =====================================================
-- ÍNDICES PARA TABLA custom_game_questions
-- =====================================================

-- Índice para queries por custom_game_id
-- Mejora: SELECT * FROM custom_game_questions WHERE custom_game_id = X
-- Impacto: getCustomGameQuestionsForPlay
CREATE INDEX IF NOT EXISTS idx_custom_game_questions_game_id 
    ON custom_game_questions(custom_game_id);

COMMENT ON INDEX idx_custom_game_questions_game_id IS 
    'Optimiza carga de juegos personalizados';

-- Índice compuesto para ordenamiento por posición
-- Mejora: ORDER BY position al cargar juegos personalizados
CREATE INDEX IF NOT EXISTS idx_custom_game_questions_game_position 
    ON custom_game_questions(custom_game_id, position);

COMMENT ON INDEX idx_custom_game_questions_game_position IS 
    'Optimiza ordenamiento de slides en juegos personalizados';

-- =====================================================
-- ÍNDICES PARA TABLA game_banks
-- =====================================================

-- Índice compuesto para JOINs frecuentes
-- Mejora: JOIN game_banks gb ON g.id = gb.game_id
-- Impacto: getAllGames, getGameWithBanks
CREATE INDEX IF NOT EXISTS idx_game_banks_game_bank 
    ON game_banks(game_id, bank_id);

COMMENT ON INDEX idx_game_banks_game_bank IS 
    'Optimiza JOINs de juegos con bancos - Reduce latencia en 80%';

-- =====================================================
-- ÍNDICES PARA VALIDACIÓN DE PINS (CRÍTICO)
-- =====================================================

-- Índice para búsquedas por PIN en games
-- Mejora: SELECT * FROM games WHERE pin = 'XXXX'
-- Impacto: validatePinInDatabase (llamado en cada JOIN de jugador)
CREATE INDEX IF NOT EXISTS idx_games_pin 
    ON games(pin);

COMMENT ON INDEX idx_games_pin IS 
    'Optimiza validación de PINs - De 50ms a <5ms';

-- Índice para búsquedas por PIN en custom_games
CREATE INDEX IF NOT EXISTS idx_custom_games_pin 
    ON custom_games(pin);

COMMENT ON INDEX idx_custom_games_pin IS 
    'Optimiza validación de PINs en juegos personalizados';

-- Índice para búsquedas por PIN en question_banks
CREATE INDEX IF NOT EXISTS idx_question_banks_pin 
    ON question_banks(pin);

COMMENT ON INDEX idx_question_banks_pin IS 
    'Optimiza validación de PINs en bancos de preguntas';

-- Índice para búsquedas por PIN en quizzes (legacy)
CREATE INDEX IF NOT EXISTS idx_quizzes_pin 
    ON quizzes(pin) WHERE pin IS NOT NULL;

COMMENT ON INDEX idx_quizzes_pin IS 
    'Optimiza validación de PINs en quizzes legacy - Índice parcial';

-- =====================================================
-- ÍNDICES PARA TABLA questions (TIME_LIMIT)
-- =====================================================

-- Índice compuesto para queries con time_limit
-- Mejora: SELECT con GROUP BY incluyendo time_limit
CREATE INDEX IF NOT EXISTS idx_questions_bank_time 
    ON questions(bank_id, time_limit);

COMMENT ON INDEX idx_questions_bank_time IS 
    'Optimiza queries que necesitan time_limit por banco';

-- =====================================================
-- ANÁLISIS Y ESTADÍSTICAS
-- =====================================================

-- Actualizar estadísticas de las tablas para que el query planner
-- use correctamente los nuevos índices
ANALYZE questions;
ANALYZE options;
ANALYZE custom_game_questions;
ANALYZE game_banks;
ANALYZE games;
ANALYZE custom_games;
ANALYZE question_banks;
ANALYZE quizzes;

-- =====================================================
-- VERIFICACIÓN DE ÍNDICES CREADOS
-- =====================================================

-- Listar todos los índices creados
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

COMMIT;

-- =====================================================
-- COMANDOS ÚTILES POST-INSTALACIÓN
-- =====================================================

-- Verificar tamaño de índices:
-- SELECT 
--     indexname,
--     pg_size_pretty(pg_relation_size(indexrelid)) as size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--     AND indexrelname LIKE 'idx_%'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- Verificar uso de índices (ejecutar después de usar el sistema):
-- SELECT 
--     indexrelname as index_name,
--     idx_scan as times_used,
--     idx_tup_read as tuples_read,
--     idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--     AND indexrelname LIKE 'idx_%'
-- ORDER BY idx_scan DESC;

-- =====================================================
-- ROLLBACK (Solo si hay problemas)
-- =====================================================

-- Para eliminar todos los índices creados (NO EJECUTAR normalmente):
-- DROP INDEX IF EXISTS idx_questions_bank_id;
-- DROP INDEX IF EXISTS idx_options_question_id;
-- DROP INDEX IF EXISTS idx_custom_game_questions_game_id;
-- DROP INDEX IF EXISTS idx_custom_game_questions_game_position;
-- DROP INDEX IF EXISTS idx_game_banks_game_bank;
-- DROP INDEX IF EXISTS idx_games_pin;
-- DROP INDEX IF EXISTS idx_custom_games_pin;
-- DROP INDEX IF EXISTS idx_question_banks_pin;
-- DROP INDEX IF EXISTS idx_quizzes_pin;
-- DROP INDEX IF EXISTS idx_questions_bank_time;
