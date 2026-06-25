-- Añadir columna slide_image_position
ALTER TABLE custom_game_questions
    ADD COLUMN IF NOT EXISTS slide_image_position VARCHAR(5) CHECK (slide_image_position IN ('left','right'));

-- Actualizar constraint de slide_type para incluir 'text-image'
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
CHECK (slide_type IN ('question', 'comment', 'info', 'text', 'image', 'text-image'));

COMMENT ON COLUMN custom_game_questions.slide_image_position IS
    'Posición de la imagen en text-image: left o right';
COMMENT ON COLUMN custom_game_questions.slide_type IS
    'Tipo de slide: question, comment, info, text, image, text-image';
