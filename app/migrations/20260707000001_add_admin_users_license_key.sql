-- =====================================================
-- Migración: 20260707000001_add_admin_users_license_key
-- Descripción: Licencia individual por usuario.
--              Guarda la clave de licencia (auth.xiro.pro) asociada
--              al usuario y la fecha del último cambio, para poder
--              desbloquear sus juegos por encima del límite freemium.
-- Autor: Sistema
-- Fecha: 2026-07-07
-- =====================================================

ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS license_key TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS license_updated_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN admin_users.license_key IS
    'Clave de licencia individual del usuario (emitida por el servicio de licencias). '
    'Cadena vacía = sin licencia.';

COMMENT ON COLUMN admin_users.license_updated_at IS
    'Momento del último cambio de license_key (para invalidar cachés de validación).';

-- Log de finalización
DO $$
BEGIN
    RAISE NOTICE '✅ Columnas license_key y license_updated_at añadidas a admin_users';
END $$;
