-- =====================================================
-- Migración: 20261012000001_add_fill_blanks_question
-- Descripción: Agregar soporte para preguntas tipo fill_blanks (Completa la frase)
-- Autor: Sistema
-- Fecha: 2026-10-12
-- =====================================================
-- El enunciado se guarda en question_text con marcadores {{1}}..{{3}} y cada
-- palabra en options (option_text = palabra normalizada, order_index = hueco).
-- La solución nunca va en el enunciado, así que no hace falta ninguna columna.

BEGIN;

-- [TAG:CONSTRAINT] Actualizar constraint de question_type para permitir fill_blanks
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
        'word_scramble', 'multiple_choice', 'matching', 'word_search', 'fill_blanks'
    ));

COMMIT;
