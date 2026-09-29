-- =====================================================
-- Migración: 20260618000002_add_option_image_url
-- Descripción: Agregar imagen pequeña a opciones de respuesta.
--              Mismos límites que question_image_url:
--              máx. 100x100 px / ~25 KB.
-- Autor: Sistema
-- Fecha: 2026-06-18
-- =====================================================

ALTER TABLE options
    ADD COLUMN IF NOT EXISTS option_image_url TEXT DEFAULT NULL;

-- Documentación de la columna
COMMENT ON COLUMN options.option_image_url IS
    'URL relativa de imagen pequeña de la opción de respuesta (máx. 100x100 px / 25 KB). '
    'Opcional. Complementa option_text para tipos quiz, survey y multiple_choice.';

-- Log de finalización
DO $$
BEGIN
    RAISE NOTICE '✅ Columna option_image_url añadida a options';
    RAISE NOTICE '   - Tipo: TEXT DEFAULT NULL';
    RAISE NOTICE '   - Uso: imagen pequeña de opción (≤ 100x100 px, ≤ 25 KB)';
END $$;
