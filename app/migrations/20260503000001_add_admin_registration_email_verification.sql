-- Add email and verification support for admin panel users

ALTER TABLE IF EXISTS admin_users
    ADD COLUMN IF NOT EXISTS email VARCHAR(255);

ALTER TABLE IF EXISTS admin_users
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT true;

UPDATE admin_users
SET email = LOWER(CONCAT(username, '@local.invalid'))
WHERE email IS NULL OR TRIM(email) = '';

ALTER TABLE IF EXISTS admin_users
    ALTER COLUMN email SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email_lower
    ON admin_users (LOWER(email));

CREATE TABLE IF NOT EXISTS admin_user_registration_tokens (
    id            SERIAL PRIMARY KEY,
    token_hash    VARCHAR(128) NOT NULL UNIQUE,
    username      VARCHAR(64)  NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    expires_at    TIMESTAMPTZ  NOT NULL,
    used_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_reg_tokens_expires
    ON admin_user_registration_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_reg_tokens_lookup
    ON admin_user_registration_tokens (LOWER(username), LOWER(email));
