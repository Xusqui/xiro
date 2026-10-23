-- =====================================================
-- Migración: 20261023000001_add_canvas_slide_library
-- Descripción: Biblioteca de diapositivas libres reutilizables en cualquier juego personalizado
-- Autor: Sistema
-- Fecha: 2026-10-23
-- =====================================================
-- Cada fila guarda un lienzo con nombre (el mismo JSON que custom_game_questions.slide_canvas).
-- La propiedad sigue el modelo de los juegos: un editor solo renombra o borra lo que creó;
-- un administrador, todo.

BEGIN;

CREATE TABLE IF NOT EXISTS canvas_slide_library (
    id                 SERIAL       PRIMARY KEY,
    name               VARCHAR(120) NOT NULL,
    slide_canvas       JSONB        NOT NULL,
    created_by_role    VARCHAR(16),
    created_by_user_id INTEGER,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canvas_slide_library_updated_at
    ON canvas_slide_library (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_canvas_slide_library_created_by_user_id
    ON canvas_slide_library (created_by_user_id);

COMMENT ON TABLE canvas_slide_library IS 'Biblioteca de diapositivas libres reutilizables entre juegos personalizados';
COMMENT ON COLUMN canvas_slide_library.slide_canvas IS 'Composición JSON (versión 1) de la diapositiva libre, igual que custom_game_questions.slide_canvas';

COMMIT;
