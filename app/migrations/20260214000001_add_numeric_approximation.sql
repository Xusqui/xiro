-- =====================================================
-- Migración: 20260214000001_add_numeric_approximation
-- Descripción: Agregar soporte para preguntas tipo numeric_approximation
-- Autor: Sistema
-- Fecha: 2026-02-14
-- =====================================================

BEGIN;

-- [TAG:SCHEMA] Ampliar question_type para soportar 'numeric_approximation' (23 caracteres)
ALTER TABLE questions
    ALTER COLUMN question_type TYPE VARCHAR(30);

-- [TAG:SCHEMA] Agregar columnas para preguntas tipo numeric_approximation
ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS correct_answer NUMERIC,
    ADD COLUMN IF NOT EXISTS max_points INTEGER;

-- [TAG:COMMENT] Documentación de columnas
COMMENT ON COLUMN questions.correct_answer IS
    'Respuesta correcta (valor numérico) para preguntas tipo numeric_approximation';

COMMENT ON COLUMN questions.max_points IS
    'Puntos máximos para preguntas tipo numeric_approximation. Para quiz/survey usa time_limit configuration';

-- [TAG:CONSTRAINT] Actualizar constraint de question_type para permitir numeric_approximation
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_question_type_valid'
    ) THEN
        ALTER TABLE questions
        DROP CONSTRAINT chk_question_type_valid;
    END IF;
END $$;

ALTER TABLE questions
    ADD CONSTRAINT chk_question_type_valid
    CHECK (question_type IN ('quiz', 'survey', 'order', 'numeric_approximation'));

-- [TAG:CONSTRAINT] Validaciones específicas para numeric_approximation
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_numeric_approximation_fields'
    ) THEN
        ALTER TABLE questions
        DROP CONSTRAINT chk_numeric_approximation_fields;
    END IF;
END $$;

ALTER TABLE questions
    ADD CONSTRAINT chk_numeric_approximation_fields
    CHECK (
        (question_type != 'numeric_approximation') OR
        (correct_answer IS NOT NULL AND max_points IS NOT NULL AND max_points > 0)
    );

-- [TAG:INDEX] Índice para optimizar consultas de preguntas numéricas
CREATE INDEX IF NOT EXISTS idx_questions_numeric_type
    ON questions(question_type)
    WHERE question_type = 'numeric_approximation';

-- [TAG:LOG] Log de finalización
DO $$
BEGIN
    RAISE NOTICE '✅ Migración add_numeric_approximation ejecutada exitosamente';
    RAISE NOTICE '   - Columnas agregadas: correct_answer, max_points';
    RAISE NOTICE '   - question_type ahora permite: quiz, survey, order, numeric_approximation';
    RAISE NOTICE '   - Validaciones: correct_answer y max_points requeridos para numeric_approximation';
END $$;

COMMIT;
