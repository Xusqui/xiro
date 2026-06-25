-- =====================================================
-- MIGRACIÓN: Asignar PINs automáticos a bancos sin PIN
-- Fecha: 07-03-2026
-- Descripción: Asigna automáticamente PINs de 6 dígitos 
--              a todos los bancos que no tienen PIN.
--              Esto asegura que todos los bancos marcados como
--              "visible_to_presenter" aparezcan en el presentador.
-- =====================================================

-- Función para generar PIN único de 6 dígitos
CREATE OR REPLACE FUNCTION generate_unique_bank_pin() RETURNS TEXT AS $$
DECLARE
    new_pin TEXT;
    pin_exists BOOLEAN;
BEGIN
    LOOP
        -- Generar PIN de 6 dígitos (100000-999999)
        new_pin := LPAD((FLOOR(RANDOM() * 900000) + 100000)::TEXT, 6, '0');
        
        -- Verificar si el PIN ya existe en alguna tabla
        SELECT EXISTS (
            SELECT 1 FROM question_banks WHERE pin = new_pin
            UNION ALL
            SELECT 1 FROM games WHERE pin = new_pin
            UNION ALL
            SELECT 1 FROM custom_games WHERE pin = new_pin
            UNION ALL
            SELECT 1 FROM trivial_games WHERE pin = new_pin
        ) INTO pin_exists;
        
        -- Si no existe, salir del loop
        IF NOT pin_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN new_pin;
END;
$$ LANGUAGE plpgsql;

-- Actualizar bancos sin PIN
DO $$
DECLARE
    bank_record RECORD;
    new_pin TEXT;
BEGIN
    -- Iterar sobre todos los bancos sin PIN
    FOR bank_record IN 
        SELECT id, name FROM question_banks WHERE pin IS NULL OR pin = ''
    LOOP
        -- Generar PIN único
        new_pin := generate_unique_bank_pin();
        
        -- Actualizar el banco
        UPDATE question_banks 
        SET pin = new_pin 
        WHERE id = bank_record.id;
        
        -- Log del cambio
        RAISE NOTICE 'Banco ID % (%) asignado PIN: %', 
            bank_record.id, bank_record.name, new_pin;
    END LOOP;
    
    -- Mensaje final
    RAISE NOTICE 'Migración completada: Todos los bancos ahora tienen PIN';
END $$;

-- Eliminar la función temporal (opcional, por si se quiere reutilizar)
-- DROP FUNCTION IF EXISTS generate_unique_bank_pin();

COMMENT ON COLUMN question_banks.pin IS 
    'PIN único del banco (obligatorio - se genera automáticamente si no se proporciona)';
