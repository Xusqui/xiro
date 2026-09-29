-- =====================================================
-- Migración: 20260214000002_fix_question_type_length
-- Descripción: Ajustar longitud de question_type para numeric_approximation
-- Fecha: 2026-02-14
-- =====================================================

BEGIN;

-- [TAG:SCHEMA] Asegurar longitud suficiente para 'numeric_approximation' (23 caracteres)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'questions'
          AND column_name = 'question_type'
          AND data_type IN ('character varying', 'character')
          AND character_maximum_length IS NOT NULL
          AND character_maximum_length < 30
    ) THEN
        ALTER TABLE questions
            ALTER COLUMN question_type TYPE VARCHAR(30);
    END IF;
END $$;

-- [TAG:LOG] Log de finalización
DO $$
BEGIN
    RAISE NOTICE '✅ Migración fix_question_type_length ejecutada';
    RAISE NOTICE '   - questions.question_type: VARCHAR(30)';
END $$;

COMMIT;
