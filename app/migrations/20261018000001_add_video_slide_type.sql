-- Migración: 20261018000001_add_video_slide_type.sql
-- Descripción: Añadir tipo de diapositiva 'video' con columna slide_video para juegos personalizados

ALTER TABLE custom_game_questions ADD COLUMN IF NOT EXISTS slide_video TEXT;

-- Actualizar constraint de slide_type para incluir 'video'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'custom_game_questions_slide_type_check'
    ) THEN
        ALTER TABLE custom_game_questions DROP CONSTRAINT custom_game_questions_slide_type_check;
    END IF;
END $$;

ALTER TABLE custom_game_questions
ADD CONSTRAINT custom_game_questions_slide_type_check
CHECK (slide_type IN ('question', 'comment', 'info', 'text', 'image', 'text-image', 'video'));

COMMENT ON COLUMN custom_game_questions.slide_type IS 'Tipo de slide: question, comment, info, text, image, text-image, video';
COMMENT ON COLUMN custom_game_questions.slide_video IS 'URL del vídeo de la diapositiva video (archivo .mp4/.webm/.ogg/.mov, YouTube, Vimeo o Dailymotion); solo se reproduce en el presentador';
