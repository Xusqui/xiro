-- =====================================================
-- Migración: 20261021000001_add_survey_multiple_question
-- Descripción: Agregar el tipo survey_multiple (Encuesta de selección múltiple)
-- Autor: Sistema
-- Fecha: 2026-10-21
-- =====================================================
-- Encuesta sin respuesta correcta en la que cada jugador marca varias opciones.
-- Usa las mismas columnas que survey (options sin is_correct), así que solo
-- hay que ampliar el constraint de question_type.

BEGIN;

-- [TAG:CONSTRAINT] Actualizar constraint de question_type para permitir survey_multiple
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
        'word_scramble', 'multiple_choice', 'matching', 'word_search', 'fill_blanks',
        'survey_multiple'
    ));

COMMIT;
