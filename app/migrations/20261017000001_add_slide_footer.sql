-- =====================================================
-- Migración: 20261017000001_add_slide_footer.sql
-- Descripción: Pie de diapositiva opcional para las diapositivas especiales
--              (comment, info, text, image, text-image) de juegos personalizados
-- =====================================================

ALTER TABLE custom_game_questions
    ADD COLUMN IF NOT EXISTS slide_footer TEXT;

COMMENT ON COLUMN custom_game_questions.slide_footer IS
    'Pie de diapositiva opcional (texto plano, admite saltos de línea; se escapa al pintar)';
