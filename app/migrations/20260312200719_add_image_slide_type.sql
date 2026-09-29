-- =====================================================
-- Migración: 20260312200719_add_image_slide_type.sql
-- Descripción: Agregar tipo 'image' a custom_game_questions
-- =====================================================

ALTER TABLE custom_game_questions
    ADD COLUMN IF NOT EXISTS slide_image TEXT;

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
CHECK (slide_type IN ('question', 'comment', 'info', 'text', 'image'));

COMMENT ON COLUMN custom_game_questions.slide_type IS
    'Tipo de slide: question, comment, info, text, image';

COMMENT ON COLUMN custom_game_questions.slide_image IS
    'Ruta de la imagen para el slide tipo image';

