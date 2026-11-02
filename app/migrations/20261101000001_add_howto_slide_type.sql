-- Migración: 20261101000001_add_howto_slide_type.sql
-- Descripción: Tipo de diapositiva 'howto' (instrucciones con animación fija del código) con
--              columna slide_howto, que solo elige un tema de una lista cerrada (p. ej. 'wordsearch')

ALTER TABLE custom_game_questions ADD COLUMN IF NOT EXISTS slide_howto VARCHAR(32);

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
CHECK (slide_type IN ('question', 'comment', 'info', 'text', 'image', 'text-image', 'video', 'canvas', 'howto'));

COMMENT ON COLUMN custom_game_questions.slide_type IS 'Tipo de slide: question, comment, info, text, image, text-image, video, canvas, howto';
COMMENT ON COLUMN custom_game_questions.slide_howto IS 'Tema de la diapositiva de instrucciones (lista cerrada en core/howto-wordsearch.js y HowToSlideValidator): el contenido es fijo del código';
