-- =====================================================
-- Migración: 20260214000004_add_numeric_tolerance_modes
-- Descripción: Agregar tolerancia configurable por pregunta numérica
-- Fecha: 2026-02-14
-- =====================================================

BEGIN;

ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS tolerance_mode VARCHAR(20),
    ADD COLUMN IF NOT EXISTS tolerance_value NUMERIC,
    ADD COLUMN IF NOT EXISTS tolerance_cap NUMERIC;

COMMENT ON COLUMN questions.tolerance_mode IS
    'Modo de tolerancia para numeric_approximation: absolute | percentage | hybrid';

COMMENT ON COLUMN questions.tolerance_value IS
    'Valor principal de tolerancia: porcentaje o valor absoluto según tolerance_mode';

COMMENT ON COLUMN questions.tolerance_cap IS
    'Tope opcional de tolerancia absoluta para percentage/hybrid';

UPDATE questions
SET tolerance_mode = COALESCE(tolerance_mode, 'hybrid'),
    tolerance_value = COALESCE(tolerance_value, 25),
    tolerance_cap = COALESCE(tolerance_cap, 1000)
WHERE question_type = 'numeric_approximation';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_numeric_tolerance_mode_valid'
    ) THEN
        ALTER TABLE questions
        DROP CONSTRAINT chk_numeric_tolerance_mode_valid;
    END IF;
END $$;

ALTER TABLE questions
    ADD CONSTRAINT chk_numeric_tolerance_mode_valid
    CHECK (
        tolerance_mode IS NULL OR
        tolerance_mode IN ('absolute', 'percentage', 'hybrid')
    );

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_numeric_approximation_fields'
    ) THEN
        ALTER TABLE questions
        DROP CONSTRAINT chk_numeric_approximation_fields;
    END IF;
END $$;

ALTER TABLE questions
    ADD CONSTRAINT chk_numeric_approximation_fields
    CHECK (
        (question_type != 'numeric_approximation') OR
        (
            correct_answer IS NOT NULL
            AND max_points IS NOT NULL
            AND max_points > 0
            AND tolerance_mode IS NOT NULL
            AND tolerance_value IS NOT NULL
            AND tolerance_value > 0
            AND (tolerance_cap IS NULL OR tolerance_cap > 0)
        )
    );

CREATE INDEX IF NOT EXISTS idx_questions_numeric_tolerance_mode
    ON questions(tolerance_mode)
    WHERE question_type = 'numeric_approximation';

COMMIT;
