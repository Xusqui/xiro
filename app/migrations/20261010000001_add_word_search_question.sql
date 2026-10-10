-- =====================================================
-- Migración: 20261010000001_add_word_search_question
-- Descripción: Agregar soporte para preguntas tipo word_search (Sopa de letras)
-- Autor: Sistema
-- Fecha: 2026-10-10
-- =====================================================
-- Las palabras se guardan en options (option_text = palabra, order_index = orden).
-- La rejilla se genera al arrancar cada partida, así que no hace falta ninguna columna.

BEGIN;

-- [TAG:CONSTRAINT] Actualizar constraint de question_type para permitir word_search
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
        'word_scramble', 'multiple_choice', 'matching', 'word_search'
    ));

COMMIT;
