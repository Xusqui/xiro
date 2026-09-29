-- =====================================================
-- Migración: 20260621064242_add_admin_user_celetion_tokens
-- Descripción: Añade tabla para tokens de confirmación de borrado de usuario
-- Autor: Sistema
-- Fecha: 2026-06-21
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_user_deletion_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_deletion_tokens_user_id ON admin_user_deletion_tokens(user_id);
CREATE INDEX idx_admin_deletion_tokens_hash ON admin_user_deletion_tokens(token_hash);

-- Log de finalización
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Migración ejecutada exitosamente: admin_user_deletion_tokens';
END $$;
