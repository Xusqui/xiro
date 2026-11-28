-- =====================================================
-- Migración: 20261127000001_add_word_cloud_question
-- Descripción: Agregar el tipo word_cloud («Nube de palabras»)
-- Autor: Sistema
-- Fecha: 2026-11-27
-- =====================================================
-- Encuesta sin respuesta correcta: cada jugador envía hasta max_words palabras de 20 caracteres
-- como máximo. max_words (1-5) vale 1 por defecto. Al terminar la partida se guardan solo las
-- palabras agrupadas con su recuento, sin autor (word_cloud_results); las ocultadas por el
-- presentador no se guardan.

BEGIN;

ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS max_words SMALLINT NOT NULL DEFAULT 1;

COMMENT ON COLUMN questions.max_words IS
    'word_cloud: máximo de palabras que puede enviar cada jugador (1-5).';

-- [TAG:CONSTRAINT] Borrar las restricciones anteriores solo si existen (idempotente)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_question_type_valid') THEN
        ALTER TABLE questions DROP CONSTRAINT chk_question_type_valid;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_max_words_range') THEN
        ALTER TABLE questions DROP CONSTRAINT chk_max_words_range;
    END IF;
END $$;

ALTER TABLE questions
    ADD CONSTRAINT chk_question_type_valid
    CHECK (question_type IN (
        'quiz', 'survey', 'order', 'numeric_approximation',
        'word_scramble', 'multiple_choice', 'matching', 'word_search', 'fill_blanks',
        'survey_multiple', 'hotspot', 'word_cloud'
    ));

ALTER TABLE questions
    ADD CONSTRAINT chk_max_words_range
    CHECK (max_words BETWEEN 1 AND 5);

CREATE TABLE IF NOT EXISTS word_cloud_results (
    id               BIGSERIAL PRIMARY KEY,
    game_session_id  INTEGER     NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    question_index   SMALLINT    NOT NULL,
    word             VARCHAR(20) NOT NULL,
    count            INTEGER     NOT NULL CHECK (count > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_word_cloud_results_word
    ON word_cloud_results (game_session_id, question_index, word);

COMMIT;
