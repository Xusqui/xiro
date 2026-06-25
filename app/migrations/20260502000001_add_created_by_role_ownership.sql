-- Añade propiedad por rol para restringir edición/borrado de recursos de Admin por parte de Editors

BEGIN;

ALTER TABLE IF EXISTS question_banks
    ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(16);

ALTER TABLE IF EXISTS games
    ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(16);

ALTER TABLE IF EXISTS custom_games
    ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(16);

ALTER TABLE IF EXISTS trivial_games
    ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(16);

ALTER TABLE IF EXISTS quizzes
    ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(16);

DO $$
BEGIN
    IF to_regclass('public.question_banks') IS NOT NULL THEN
        UPDATE question_banks
        SET created_by_role = 'admin'
        WHERE created_by_role IS NULL OR created_by_role = '';
    END IF;

    IF to_regclass('public.games') IS NOT NULL THEN
        UPDATE games
        SET created_by_role = 'admin'
        WHERE created_by_role IS NULL OR created_by_role = '';
    END IF;

    IF to_regclass('public.custom_games') IS NOT NULL THEN
        UPDATE custom_games
        SET created_by_role = 'admin'
        WHERE created_by_role IS NULL OR created_by_role = '';
    END IF;

    IF to_regclass('public.trivial_games') IS NOT NULL THEN
        UPDATE trivial_games
        SET created_by_role = 'admin'
        WHERE created_by_role IS NULL OR created_by_role = '';
    END IF;

    IF to_regclass('public.quizzes') IS NOT NULL THEN
        UPDATE quizzes
        SET created_by_role = 'admin'
        WHERE created_by_role IS NULL OR created_by_role = '';
    END IF;
END $$;

ALTER TABLE IF EXISTS question_banks
    ALTER COLUMN created_by_role SET DEFAULT 'admin';
ALTER TABLE IF EXISTS question_banks
    ALTER COLUMN created_by_role SET NOT NULL;

ALTER TABLE IF EXISTS games
    ALTER COLUMN created_by_role SET DEFAULT 'admin';
ALTER TABLE IF EXISTS games
    ALTER COLUMN created_by_role SET NOT NULL;

ALTER TABLE IF EXISTS custom_games
    ALTER COLUMN created_by_role SET DEFAULT 'admin';
ALTER TABLE IF EXISTS custom_games
    ALTER COLUMN created_by_role SET NOT NULL;

ALTER TABLE IF EXISTS trivial_games
    ALTER COLUMN created_by_role SET DEFAULT 'admin';
ALTER TABLE IF EXISTS trivial_games
    ALTER COLUMN created_by_role SET NOT NULL;

ALTER TABLE IF EXISTS quizzes
    ALTER COLUMN created_by_role SET DEFAULT 'admin';
ALTER TABLE IF EXISTS quizzes
    ALTER COLUMN created_by_role SET NOT NULL;

DO $$
BEGIN
    IF to_regclass('public.question_banks') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_question_banks_creator_role') THEN
        ALTER TABLE question_banks
            ADD CONSTRAINT chk_question_banks_creator_role
            CHECK (created_by_role IN ('admin', 'editor'));
    END IF;

    IF to_regclass('public.games') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_games_creator_role') THEN
        ALTER TABLE games
            ADD CONSTRAINT chk_games_creator_role
            CHECK (created_by_role IN ('admin', 'editor'));
    END IF;

    IF to_regclass('public.custom_games') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_custom_games_creator_role') THEN
        ALTER TABLE custom_games
            ADD CONSTRAINT chk_custom_games_creator_role
            CHECK (created_by_role IN ('admin', 'editor'));
    END IF;

    IF to_regclass('public.trivial_games') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trivial_games_creator_role') THEN
        ALTER TABLE trivial_games
            ADD CONSTRAINT chk_trivial_games_creator_role
            CHECK (created_by_role IN ('admin', 'editor'));
    END IF;

    IF to_regclass('public.quizzes') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_quizzes_creator_role') THEN
        ALTER TABLE quizzes
            ADD CONSTRAINT chk_quizzes_creator_role
            CHECK (created_by_role IN ('admin', 'editor'));
    END IF;
END $$;

COMMIT;
