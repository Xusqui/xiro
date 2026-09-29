-- Añade idioma de contenido (banco/juego/personalizado/trivial), obligatorio con backfill 'es'

BEGIN;

ALTER TABLE IF EXISTS question_banks
    ADD COLUMN IF NOT EXISTS language VARCHAR(5);

ALTER TABLE IF EXISTS games
    ADD COLUMN IF NOT EXISTS language VARCHAR(5);

ALTER TABLE IF EXISTS custom_games
    ADD COLUMN IF NOT EXISTS language VARCHAR(5);

ALTER TABLE IF EXISTS trivial_games
    ADD COLUMN IF NOT EXISTS language VARCHAR(5);

DO $$
BEGIN
    IF to_regclass('public.question_banks') IS NOT NULL THEN
        UPDATE question_banks SET language = 'es' WHERE language IS NULL;
    END IF;

    IF to_regclass('public.games') IS NOT NULL THEN
        UPDATE games SET language = 'es' WHERE language IS NULL;
    END IF;

    IF to_regclass('public.custom_games') IS NOT NULL THEN
        UPDATE custom_games SET language = 'es' WHERE language IS NULL;
    END IF;

    IF to_regclass('public.trivial_games') IS NOT NULL THEN
        UPDATE trivial_games SET language = 'es' WHERE language IS NULL;
    END IF;
END $$;

ALTER TABLE IF EXISTS question_banks
    ALTER COLUMN language SET DEFAULT 'es';
ALTER TABLE IF EXISTS question_banks
    ALTER COLUMN language SET NOT NULL;

ALTER TABLE IF EXISTS games
    ALTER COLUMN language SET DEFAULT 'es';
ALTER TABLE IF EXISTS games
    ALTER COLUMN language SET NOT NULL;

ALTER TABLE IF EXISTS custom_games
    ALTER COLUMN language SET DEFAULT 'es';
ALTER TABLE IF EXISTS custom_games
    ALTER COLUMN language SET NOT NULL;

ALTER TABLE IF EXISTS trivial_games
    ALTER COLUMN language SET DEFAULT 'es';
ALTER TABLE IF EXISTS trivial_games
    ALTER COLUMN language SET NOT NULL;

DO $$
BEGIN
    IF to_regclass('public.question_banks') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_question_banks_language') THEN
        ALTER TABLE question_banks
            ADD CONSTRAINT chk_question_banks_language
            CHECK (language IN ('es','en','fr','ca','eu','gl','de','pt','zh','ja'));
    END IF;

    IF to_regclass('public.games') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_games_language') THEN
        ALTER TABLE games
            ADD CONSTRAINT chk_games_language
            CHECK (language IN ('es','en','fr','ca','eu','gl','de','pt','zh','ja'));
    END IF;

    IF to_regclass('public.custom_games') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_custom_games_language') THEN
        ALTER TABLE custom_games
            ADD CONSTRAINT chk_custom_games_language
            CHECK (language IN ('es','en','fr','ca','eu','gl','de','pt','zh','ja'));
    END IF;

    IF to_regclass('public.trivial_games') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trivial_games_language') THEN
        ALTER TABLE trivial_games
            ADD CONSTRAINT chk_trivial_games_language
            CHECK (language IN ('es','en','fr','ca','eu','gl','de','pt','zh','ja'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_question_banks_language ON question_banks(language);
CREATE INDEX IF NOT EXISTS idx_games_language ON games(language);
CREATE INDEX IF NOT EXISTS idx_custom_games_language ON custom_games(language);
CREATE INDEX IF NOT EXISTS idx_trivial_games_language ON trivial_games(language);

COMMIT;
