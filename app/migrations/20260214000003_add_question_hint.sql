-- =====================================================
-- Migración: 20260214000003_add_question_hint
-- Descripción: Agregar campo de pista para preguntas
-- Fecha: 2026-02-14
-- =====================================================

BEGIN;

ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS hint_text TEXT;

COMMENT ON COLUMN questions.hint_text IS
    'Pista opcional mostrada por el presentador durante la pregunta';

COMMIT;
