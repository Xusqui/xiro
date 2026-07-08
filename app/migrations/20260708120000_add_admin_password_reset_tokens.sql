-- =====================================================
-- Migración: 20260708120000_add_admin_password_reset_tokens
-- Descripción: Añade tabla para tokens de recuperación de contraseña
-- Autor: Sistema
-- Fecha: 2026-07-08
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_user_password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_password_reset_tokens_user_id ON admin_user_password_reset_tokens(user_id);
CREATE INDEX idx_admin_password_reset_tokens_hash ON admin_user_password_reset_tokens(token_hash);

-- Log de finalización
DO $$
BEGIN
    RAISE NOTICE '✅ Migración ejecutada exitosamente: admin_user_password_reset_tokens';
END $$;
