-- Migración: 20261019000001_add_canvas_slide_type.sql
-- Descripción: Añadir tipo de diapositiva 'canvas' con columna slide_canvas para juegos personalizados

ALTER TABLE custom_game_questions ADD COLUMN IF NOT EXISTS slide_canvas JSONB;

-- Actualizar constraint de slide_type para incluir 'canvas'
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
CHECK (slide_type IN ('question', 'comment', 'info', 'text', 'image', 'text-image', 'video', 'canvas'));

COMMENT ON COLUMN custom_game_questions.slide_type IS 'Tipo de slide: question, comment, info, text, image, text-image, video, canvas';
COMMENT ON COLUMN custom_game_questions.slide_canvas IS 'Composición JSON (versión 1) de la diapositiva libre: fondo y elementos posicionados en un lienzo lógico de 1920x1080';