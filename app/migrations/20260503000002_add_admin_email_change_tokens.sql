-- Add pending email change flow for admin panel users

CREATE TABLE IF NOT EXISTS admin_user_email_change_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    old_email  VARCHAR(255) NOT NULL,
    new_email  VARCHAR(255) NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ  NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_email_change_tokens_user
    ON admin_user_email_change_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_admin_email_change_tokens_expires
    ON admin_user_email_change_tokens (expires_at);
