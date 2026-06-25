-- =====================================================
-- Migracion: 20260209000001_add_order_index
-- Descripcion: Agregar order_index a options para preguntas tipo "order"
-- Autor: Sistema
-- Fecha: 2026-02-09
-- =====================================================

ALTER TABLE options
    ADD COLUMN IF NOT EXISTS order_index INTEGER;

COMMENT ON COLUMN options.order_index IS 'Posicion correcta para preguntas tipo order (0..n-1)';

CREATE INDEX IF NOT EXISTS idx_options_question_order
    ON options(question_id, order_index);

DO $$
BEGIN
    RAISE NOTICE '✅ Migracion add_order_index ejecutada exitosamente';
END $$;
