-- =====================================================
-- ESTRATEGIAS DE PUNTUACIÓN - Phase 17.2
-- XIRO! Trivia System
-- =====================================================
-- Fecha: 3 de febrero de 2026
-- Objetivo: Agregar soporte para estrategias de puntuación configurables
-- 
-- ESTRATEGIAS SOPORTADAS:
-- - time_based: Puntuación basada en tiempo (sistema actual)
-- - streak_bonus: Bonus por rachas correctas (individual + equipo)
-- - betting: Sistema de apuestas antes de responder
--
-- INSTRUCCIONES:
-- 1. Hacer backup de la base de datos antes de ejecutar
-- 2. Ejecutar en horario de bajo tráfico
-- 3. Verificar que las columnas se crearon con \d questions y \d games
-- =====================================================

BEGIN;

-- =====================================================
-- TABLA questions: Estrategia por pregunta
-- =====================================================

-- Columna: scoring_strategy
-- Define qué estrategia usar para calcular puntos
-- Valores: 'time_based' | 'streak_bonus' | 'betting'
ALTER TABLE questions 
    ADD COLUMN IF NOT EXISTS scoring_strategy VARCHAR(50) DEFAULT 'time_based';

COMMENT ON COLUMN questions.scoring_strategy IS 
    'Estrategia de puntuación: time_based (default), streak_bonus, betting';

-- Columna: scoring_params
-- Parámetros específicos de la estrategia en formato JSON
-- Ejemplos:
--   time_based: {"basePoints": 20, "maxTimeBonus": 20}
--   streak_bonus: {"streakThreshold": 3, "streakBonusPercentage": 0.50}
--   betting: {"minBetPercentage": 0.10, "allowNegativeScore": false}
ALTER TABLE questions 
    ADD COLUMN IF NOT EXISTS scoring_params JSONB DEFAULT NULL;

COMMENT ON COLUMN questions.scoring_params IS 
    'Parámetros JSON específicos de la estrategia de puntuación';

-- Índice para búsquedas por estrategia
CREATE INDEX IF NOT EXISTS idx_questions_scoring_strategy 
    ON questions(scoring_strategy);

COMMENT ON INDEX idx_questions_scoring_strategy IS 
    'Índice para filtrar preguntas por estrategia de puntuación';

-- =====================================================
-- TABLA games: Configuración de rachas (streak)
-- =====================================================

-- Columna: streak_threshold
-- Número de respuestas correctas consecutivas para activar racha
-- Default: 3 (según game-constants.js)
ALTER TABLE games 
    ADD COLUMN IF NOT EXISTS streak_threshold INTEGER DEFAULT 3;

COMMENT ON COLUMN games.streak_threshold IS 
    'Número de respuestas correctas para activar bonus de racha (default: 3)';

-- Columna: streak_bonus_percentage
-- Porcentaje de bonus por racha individual (0.50 = +50%)
-- Default: 0.50 (según game-constants.js)
ALTER TABLE games 
    ADD COLUMN IF NOT EXISTS streak_bonus_percentage DECIMAL(3,2) DEFAULT 0.50;

COMMENT ON COLUMN games.streak_bonus_percentage IS 
    'Porcentaje de bonus por racha individual (ej: 0.50 = +50%)';

-- Columna: team_streak_enabled
-- Habilitar bonus adicional cuando TODO el equipo está en racha
-- Default: true
ALTER TABLE games 
    ADD COLUMN IF NOT EXISTS team_streak_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN games.team_streak_enabled IS 
    'Si TRUE, aplica bonus adicional cuando todo el equipo está en racha';

-- Columna: team_streak_bonus_percentage
-- Porcentaje ADICIONAL cuando todo el equipo está en racha (acumulativo)
-- Default: 0.50 (+50% adicional sobre el bonus individual)
ALTER TABLE games 
    ADD COLUMN IF NOT EXISTS team_streak_bonus_percentage DECIMAL(3,2) DEFAULT 0.50;

COMMENT ON COLUMN games.team_streak_bonus_percentage IS 
    'Bonus ADICIONAL cuando todo el equipo en racha (ej: 0.50 = +50% extra)';

-- =====================================================
-- VALIDACIONES (Constraints)
-- =====================================================

-- Validar que scoring_strategy sea uno de los valores permitidos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_scoring_strategy_valid'
    ) THEN
        ALTER TABLE questions 
            ADD CONSTRAINT chk_scoring_strategy_valid 
            CHECK (scoring_strategy IN ('time_based', 'streak_bonus', 'betting'));
    END IF;
END $$;

-- Validar que streak_threshold sea positivo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_streak_threshold_positive'
    ) THEN
        ALTER TABLE games 
            ADD CONSTRAINT chk_streak_threshold_positive 
            CHECK (streak_threshold > 0);
    END IF;
END $$;

-- Validar que los porcentajes estén entre 0.00 y 2.00 (0% a 200%)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_streak_bonus_range'
    ) THEN
        ALTER TABLE games 
            ADD CONSTRAINT chk_streak_bonus_range 
            CHECK (streak_bonus_percentage >= 0 AND streak_bonus_percentage <= 2.00);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_team_streak_bonus_range'
    ) THEN
        ALTER TABLE games 
            ADD CONSTRAINT chk_team_streak_bonus_range 
            CHECK (team_streak_bonus_percentage >= 0 AND team_streak_bonus_percentage <= 2.00);
    END IF;
END $$;

-- =====================================================
-- DATOS DE PRUEBA (Opcional)
-- =====================================================

-- Actualizar preguntas existentes para usar time_based (ya es el default)
-- No se requiere UPDATE porque la columna tiene DEFAULT 'time_based'

-- Actualizar juegos existentes con valores default de racha
-- No se requiere UPDATE porque las columnas tienen DEFAULT

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar columnas en questions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' 
        AND column_name = 'scoring_strategy'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna scoring_strategy no creada en questions';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' 
        AND column_name = 'scoring_params'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna scoring_params no creada en questions';
    END IF;
    
    RAISE NOTICE 'OK: Columnas scoring_strategy y scoring_params creadas en questions';
END $$;

-- Verificar columnas en games
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' 
        AND column_name = 'streak_threshold'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna streak_threshold no creada en games';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' 
        AND column_name = 'streak_bonus_percentage'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna streak_bonus_percentage no creada en games';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' 
        AND column_name = 'team_streak_enabled'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna team_streak_enabled no creada en games';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' 
        AND column_name = 'team_streak_bonus_percentage'
    ) THEN
        RAISE EXCEPTION 'ERROR: Columna team_streak_bonus_percentage no creada en games';
    END IF;
    
    RAISE NOTICE 'OK: Columnas de streak creadas en games';
END $$;

COMMIT;

-- =====================================================
-- RESUMEN
-- =====================================================
-- 
-- TABLA questions:
--   + scoring_strategy VARCHAR(50) DEFAULT 'time_based'
--   + scoring_params JSONB
--   + idx_questions_scoring_strategy
--   + chk_scoring_strategy_valid (time_based|streak_bonus|betting)
--
-- TABLA games:
--   + streak_threshold INTEGER DEFAULT 3
--   + streak_bonus_percentage DECIMAL(3,2) DEFAULT 0.50
--   + team_streak_enabled BOOLEAN DEFAULT true
--   + team_streak_bonus_percentage DECIMAL(3,2) DEFAULT 0.50
--   + chk_streak_threshold_positive
--   + chk_streak_bonus_range
--   + chk_team_streak_bonus_range
--
-- BACKWARD COMPATIBILITY: ✅
--   - Todas las columnas tienen DEFAULT
--   - Registros existentes funcionarán con time_based (comportamiento actual)
--   - No requiere UPDATE de datos existentes
-- =====================================================
