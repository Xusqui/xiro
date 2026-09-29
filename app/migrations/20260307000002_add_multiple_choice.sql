-- =====================================================
-- Migración: 20260307000002_add_multiple_choice
-- Descripción: Agregar soporte para preguntas tipo multiple_choice
-- Autor: Sistema
-- Fecha: 2026-03-07
-- =====================================================

BEGIN;

-- [TAG:SCHEMA] Agregar columnas para preguntas tipo multiple_choice
ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS mc_points_per_correct INTEGER DEFAULT 10,
    ADD COLUMN IF NOT EXISTS mc_penalty_per_incorrect INTEGER DEFAULT 10,
    ADD COLUMN IF NOT EXISTS mc_perfect_bonus INTEGER DEFAULT 20;

-- [TAG:COMMENT] Documentación de columnas
COMMENT ON COLUMN questions.mc_points_per_correct IS
    'Puntos por cada respuesta correcta marcada en preguntas multiple_choice (1-100)';

COMMENT ON COLUMN questions.mc_penalty_per_incorrect IS
    'Penalización por cada respuesta incorrecta marcada en preguntas multiple_choice (0-100)';

COMMENT ON COLUMN questions.mc_perfect_bonus IS
    'Bonus extra si marca todas las correctas y ninguna incorrecta en preguntas multiple_choice (0-100)';

-- [TAG:CONSTRAINT] Actualizar constraint de question_type para permitir multiple_choice
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
    CHECK (question_type IN ('quiz', 'survey', 'order', 'numeric_approximation', 'word_scramble', 'multiple_choice'));

-- [TAG:CONSTRAINT] Validaciones específicas para multiple_choice
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_multiple_choice_fields'
    ) THEN
        ALTER TABLE questions
        DROP CONSTRAINT chk_multiple_choice_fields;
    END IF;
END $$;

ALTER TABLE questions
    ADD CONSTRAINT chk_multiple_choice_fields
    CHECK (
        (question_type != 'multiple_choice') OR
        (mc_points_per_correct IS NOT NULL AND mc_points_per_correct >= 1 AND mc_points_per_correct <= 100 AND
         mc_penalty_per_incorrect IS NOT NULL AND mc_penalty_per_incorrect >= 0 AND mc_penalty_per_incorrect <= 100 AND
         mc_perfect_bonus IS NOT NULL AND mc_perfect_bonus >= 0 AND mc_perfect_bonus <= 100)
    );

COMMENT ON CONSTRAINT chk_multiple_choice_fields ON questions IS
    'Asegura que las preguntas multiple_choice tengan configuradas las 3 variables de puntuación';

COMMIT;
