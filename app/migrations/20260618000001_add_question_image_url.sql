-- =====================================================
-- Migración: 20260618000001_add_question_image_url
-- Descripción: Agregar imagen pequeña de enunciado a preguntas
--              Campo independiente del multimedia principal.
--              Almacena una imagen de máximo 100x100 px / ~25 KB
--              para enriquecer visualmente el enunciado de la pregunta.
-- Autor: Sistema
-- Fecha: 2026-06-18
-- =====================================================

ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS question_image_url TEXT DEFAULT NULL;

-- Documentación de la columna
COMMENT ON COLUMN questions.question_image_url IS
    'URL relativa de imagen pequeña del enunciado (máx. 100x100 px / 25 KB). '
    'Independiente de url_recurso (multimedia principal).';

-- Log de finalización
DO $$
BEGIN
    RAISE NOTICE '✅ Columna question_image_url añadida a questions';
    RAISE NOTICE '   - Tipo: TEXT DEFAULT NULL';
    RAISE NOTICE '   - Uso: imagen pequeña del enunciado (≤ 100x100 px, ≤ 25 KB)';
END $$;
