-- =====================================================
-- Migración: 20260427000001_add_matching_question
-- Descripción: Agregar soporte para preguntas tipo matching (Emparejar)
-- Autor: Sistema
-- Fecha: 2026-04-27
-- =====================================================

BEGIN;

-- [TAG:SCHEMA] Añadir columna match_value a options para almacenar el par derecho
ALTER TABLE options
    ADD COLUMN IF NOT EXISTS match_value TEXT;

COMMENT ON COLUMN options.match_value IS
    'Valor del par derecho para preguntas tipo matching. option_text = item izquierdo (fijo), match_value = par correcto derecho.';

-- [TAG:CONSTRAINT] Actualizar constraint de question_type para permitir matching
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
    CHECK (question_type IN (
        'quiz', 'survey', 'order', 'numeric_approximation',
        'word_scramble', 'multiple_choice', 'matching'
    ));

-- [TAG:INDEX] Índice para acelerar ordenación de pares en preguntas matching
CREATE INDEX IF NOT EXISTS idx_options_question_order_matching
    ON options(question_id, order_index)
    WHERE match_value IS NOT NULL;

COMMIT;
