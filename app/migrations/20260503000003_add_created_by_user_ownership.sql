-- Ownership por usuario para recursos editables

ALTER TABLE IF EXISTS question_banks
    ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;

ALTER TABLE IF EXISTS games
    ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;

ALTER TABLE IF EXISTS custom_games
    ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;

ALTER TABLE IF EXISTS trivial_games
    ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;

ALTER TABLE IF EXISTS quizzes
    ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_question_banks_created_by_user_id
    ON question_banks (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_games_created_by_user_id
    ON games (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_custom_games_created_by_user_id
    ON custom_games (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_trivial_games_created_by_user_id
    ON trivial_games (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_quizzes_created_by_user_id
    ON quizzes (created_by_user_id);

DO $$
BEGIN
    IF to_regclass('public.question_banks') IS NOT NULL
       AND to_regclass('public.admin_users') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_question_banks_created_by_user') THEN
        ALTER TABLE question_banks
            ADD CONSTRAINT fk_question_banks_created_by_user
            FOREIGN KEY (created_by_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.games') IS NOT NULL
       AND to_regclass('public.admin_users') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_games_created_by_user') THEN
        ALTER TABLE games
            ADD CONSTRAINT fk_games_created_by_user
            FOREIGN KEY (created_by_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.custom_games') IS NOT NULL
       AND to_regclass('public.admin_users') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_custom_games_created_by_user') THEN
        ALTER TABLE custom_games
            ADD CONSTRAINT fk_custom_games_created_by_user
            FOREIGN KEY (created_by_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.trivial_games') IS NOT NULL
       AND to_regclass('public.admin_users') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_trivial_games_created_by_user') THEN
        ALTER TABLE trivial_games
            ADD CONSTRAINT fk_trivial_games_created_by_user
            FOREIGN KEY (created_by_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.quizzes') IS NOT NULL
       AND to_regclass('public.admin_users') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_quizzes_created_by_user') THEN
        ALTER TABLE quizzes
            ADD CONSTRAINT fk_quizzes_created_by_user
            FOREIGN KEY (created_by_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
DECLARE
    default_owner_id INTEGER;
BEGIN
    IF to_regclass('public.admin_users') IS NULL THEN
        RETURN;
    END IF;

    SELECT id
    INTO default_owner_id
    FROM admin_users
    ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, id ASC
    LIMIT 1;

    IF default_owner_id IS NULL THEN
        RETURN;
    END IF;

    IF to_regclass('public.question_banks') IS NOT NULL THEN
        UPDATE question_banks
        SET created_by_user_id = default_owner_id
        WHERE created_by_user_id IS NULL;
    END IF;

    IF to_regclass('public.games') IS NOT NULL THEN
        UPDATE games
        SET created_by_user_id = default_owner_id
        WHERE created_by_user_id IS NULL;
    END IF;

    IF to_regclass('public.custom_games') IS NOT NULL THEN
        UPDATE custom_games
        SET created_by_user_id = default_owner_id
        WHERE created_by_user_id IS NULL;
    END IF;

    IF to_regclass('public.trivial_games') IS NOT NULL THEN
        UPDATE trivial_games
        SET created_by_user_id = default_owner_id
        WHERE created_by_user_id IS NULL;
    END IF;

    IF to_regclass('public.quizzes') IS NOT NULL THEN
        UPDATE quizzes
        SET created_by_user_id = default_owner_id
        WHERE created_by_user_id IS NULL;
    END IF;
END $$;
