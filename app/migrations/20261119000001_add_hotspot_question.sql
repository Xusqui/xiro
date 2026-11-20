-- =====================================================
-- Migración: 20261119000001_add_hotspot_question
-- Descripción: Agregar el tipo hotspot («Toca la imagen»)
-- Autor: Sistema
-- Fecha: 2026-11-19
-- =====================================================
-- El jugador toca la imagen principal de la pregunta (url_recurso). El área correcta es un
-- polígono en coordenadas relativas 0-1 más la proporción de la imagen (hotspot_area, JSONB;
-- reglas en public/js/core/hotspot-area.js). Los puntos máximos reutilizan max_points, como la
-- numérica; hotspot_tolerance es el % del ancho a partir del cual el toque da 0 puntos.
-- image_credit guarda autor y licencia de las imágenes de Wikimedia Commons (generador de IA).

BEGIN;

ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS hotspot_area JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS hotspot_tolerance SMALLINT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS image_credit TEXT DEFAULT NULL;

COMMENT ON COLUMN questions.hotspot_area IS
    'hotspot: polígono correcto {points:[{x,y}], aspect} en coordenadas relativas 0-1 de url_recurso.';
COMMENT ON COLUMN questions.hotspot_tolerance IS
    'hotspot: distancia al área (en % del ancho de la imagen) a la que el toque ya da 0 puntos.';
COMMENT ON COLUMN questions.image_credit IS
    'Autor y licencia de la imagen principal cuando viene de Wikimedia Commons.';

-- [TAG:CONSTRAINT] Borrar las restricciones anteriores solo si existen (idempotente)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_question_type_valid') THEN
        ALTER TABLE questions DROP CONSTRAINT chk_question_type_valid;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_hotspot_fields') THEN
        ALTER TABLE questions DROP CONSTRAINT chk_hotspot_fields;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_hotspot_tolerance_range') THEN
        ALTER TABLE questions DROP CONSTRAINT chk_hotspot_tolerance_range;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_image_credit_length') THEN
        ALTER TABLE questions DROP CONSTRAINT chk_image_credit_length;
    END IF;
END $$;

ALTER TABLE questions
    ADD CONSTRAINT chk_question_type_valid
    CHECK (question_type IN (
        'quiz', 'survey', 'order', 'numeric_approximation',
        'word_scramble', 'multiple_choice', 'matching', 'word_search', 'fill_blanks',
        'survey_multiple', 'hotspot'
    ));

ALTER TABLE questions
    ADD CONSTRAINT chk_hotspot_fields
    CHECK (question_type <> 'hotspot' OR (hotspot_area IS NOT NULL AND url_recurso IS NOT NULL));

ALTER TABLE questions
    ADD CONSTRAINT chk_hotspot_tolerance_range
    CHECK (hotspot_tolerance IS NULL OR hotspot_tolerance BETWEEN 1 AND 100);

ALTER TABLE questions
    ADD CONSTRAINT chk_image_credit_length
    CHECK (image_credit IS NULL OR char_length(image_credit) <= 300);

COMMIT;
