-- =====================================================
-- Migración: 20260118000002_add_info_slide_type
-- Descripción: Agregar tipo 'info' a slide_type para slides informativos sin asignación de puntos
-- Autor: Sistema
-- Fecha: 2026-01-18
-- =====================================================

-- Modificar el constraint CHECK de la columna slide_type en custom_game_questions
-- para permitir 'question', 'comment' e 'info'

-- Primero eliminamos el constraint existente (si existe)
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

-- Agregar el nuevo constraint con los tres tipos
ALTER TABLE custom_game_questions 
ADD CONSTRAINT custom_game_questions_slide_type_check 
CHECK (slide_type IN ('question', 'comment', 'info'));

-- Documentación
COMMENT ON COLUMN custom_game_questions.slide_type IS 
    'Tipo de slide: question (pregunta normal), comment (comentario con puntos manuales), info (slide informativo sin puntos)';

-- Log de finalización
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Tipo de slide ''info'' agregado exitosamente';
    RAISE NOTICE '   - slide_type ahora permite: question, comment, info';
    RAISE NOTICE '   - info: Slides informativos que se muestran sin asignación de puntos';
END $$;
