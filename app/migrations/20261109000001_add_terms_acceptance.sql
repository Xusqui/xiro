-- Migración: 20261109000001_add_terms_acceptance.sql
-- Descripción: Guarda qué versión de los términos aceptó cada cuenta y cuándo.
--              NULL en las cuentas anteriores: las aceptan en su siguiente inicio de sesión.

ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20),
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

ALTER TABLE admin_user_registration_tokens
    ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20),
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
