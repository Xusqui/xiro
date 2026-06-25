-- =====================================================
-- Migración: 20260212000001_add_text_slide_type
-- Descripción: Agregar tipo 'text' (título + cuerpo) a custom_game_questions
-- Autor: Sistema
-- Fecha: 2026-02-12
-- =====================================================

-- [TAG:SCHEMA] Nuevas columnas para slides tipo "text"
ALTER TABLE custom_game_questions
    ADD COLUMN IF NOT EXISTS slide_title TEXT,
    ADD COLUMN IF NOT EXISTS slide_body  TEXT;

-- [TAG:CONSTRAINT] Permitir el nuevo slide_type = 'text'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'custom_game_questions_slide_type_check'
    ) THEN
        ALTER TABLE custom_game_questions
        DROP CONSTRAINT custom_game_questions_slide_type_check;
    END IF;
END $$;

ALTER TABLE custom_game_questions
ADD CONSTRAINT custom_game_questions_slide_type_check
CHECK (slide_type IN ('question', 'comment', 'info', 'text'));

-- [TAG:DOCS] Documentación de columnas
COMMENT ON COLUMN custom_game_questions.slide_type IS
    'Tipo de slide: question (pregunta), comment (actividad con puntos manuales), info (información sin puntos), text (diapositiva con título + texto)';

COMMENT ON COLUMN custom_game_questions.slide_title IS
    'Título de diapositiva (solo para slide_type = text)';

COMMENT ON COLUMN custom_game_questions.slide_body IS
    'Cuerpo de la diapositiva (solo para slide_type = text)';

-- [TAG:LOG] Log de finalización
DO $$
BEGIN
    RAISE NOTICE '✅ Tipo de slide ''text'' agregado exitosamente';
    RAISE NOTICE '   - slide_type ahora permite: question, comment, info, text';
    RAISE NOTICE '   - columnas agregadas: slide_title, slide_body';
END $$;
