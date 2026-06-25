-- =====================================================
-- Migración: 20260220000001_add_word_scramble
-- Descripción: Agregar soporte para preguntas tipo word_scramble
-- Autor: Sistema
-- Fecha: 2026-02-20
-- =====================================================

BEGIN;

-- [TAG:SCHEMA] Agregar columna correct_word para preguntas tipo word_scramble
ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS correct_word VARCHAR(50);

-- [TAG:COMMENT] Documentación de columna
COMMENT ON COLUMN questions.correct_word IS
    'Respuesta correcta (palabra) para preguntas tipo word_scramble. Entre 7 y 10 letras.';

-- [TAG:CONSTRAINT] Actualizar constraint de question_type para permitir word_scramble
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
    CHECK (question_type IN ('quiz', 'survey', 'order', 'numeric_approximation', 'word_scramble'));

COMMIT;
