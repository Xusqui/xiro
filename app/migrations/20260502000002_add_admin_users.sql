-- Add admin users table for username/password authentication
-- First registered user will become admin (handled in application logic)

CREATE TABLE IF NOT EXISTS admin_users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(16)  NOT NULL DEFAULT 'editor',
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_username_lower
    ON admin_users (LOWER(username));

CREATE INDEX IF NOT EXISTS idx_admin_users_role
    ON admin_users (role);

DO $$
BEGIN
    IF to_regclass('public.admin_users') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_admin_users_role') THEN
        ALTER TABLE admin_users
            ADD CONSTRAINT chk_admin_users_role
            CHECK (role IN ('admin', 'editor'));
    END IF;
END $$;
