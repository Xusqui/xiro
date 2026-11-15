-- =====================================================
-- Migración: 20261115000001_add_canvas_slide_themes
-- Descripción: Temas propios de las diapositivas libres (compartidos como la biblioteca) y tema de cada juego
-- Autor: Sistema
-- Fecha: 2026-11-15
-- =====================================================
-- canvas_slide_themes guarda el tema completo en JSON (paleta, fuentes, degradado). La propiedad sigue el modelo
-- de la biblioteca: un editor solo renombra o borra lo que creó; un administrador, todo.
-- custom_games.slide_theme guarda el tema aplicado al juego (el tema entero, no una referencia, para que el
-- juego no dependa de la biblioteca); NULL = sin tema.

BEGIN;

CREATE TABLE IF NOT EXISTS canvas_slide_themes (
    id                 SERIAL       PRIMARY KEY,
    name               VARCHAR(120) NOT NULL,
    theme              JSONB        NOT NULL,
    created_by_role    VARCHAR(16),
    created_by_user_id INTEGER,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canvas_slide_themes_updated_at
    ON canvas_slide_themes (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_canvas_slide_themes_created_by_user_id
    ON canvas_slide_themes (created_by_user_id);

ALTER TABLE custom_games
    ADD COLUMN IF NOT EXISTS slide_theme JSONB;

COMMENT ON TABLE canvas_slide_themes IS 'Temas propios de las diapositivas libres, compartidos entre juegos personalizados';
COMMENT ON COLUMN custom_games.slide_theme IS 'Tema (paleta, fuentes, degradado) aplicado a las diapositivas libres del juego; NULL = sin tema';

COMMIT;
