-- =====================================================
-- Migración: 20260118000001_add_multimedia_support
-- Descripción: Agregar soporte multimedia a preguntas
-- Autor: Sistema
-- Fecha: 2026-01-18
-- =====================================================

-- Agregar campos multimedia a la tabla questions
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS tipo_contenido VARCHAR(10) DEFAULT 'texto' 
    CHECK (tipo_contenido IN ('texto', 'imagen', 'audio')),
ADD COLUMN IF NOT EXISTS url_recurso TEXT DEFAULT NULL;

-- Crear índice para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_questions_tipo_contenido 
ON questions(tipo_contenido);

-- Documentación de columnas
COMMENT ON COLUMN questions.tipo_contenido IS 
    'Tipo de contenido multimedia: texto (default), imagen o audio';
COMMENT ON COLUMN questions.url_recurso IS 
    'URL relativa del recurso multimedia almacenado en /uploads/';

-- Actualizar preguntas existentes (asegurar valor por defecto)
UPDATE questions 
SET tipo_contenido = 'texto'
WHERE tipo_contenido IS NULL;

-- Log de finalización
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Soporte multimedia agregado exitosamente';
    RAISE NOTICE '   - Campo tipo_contenido: VARCHAR(10) CHECK (texto|imagen|audio)';
    RAISE NOTICE '   - Campo url_recurso: TEXT';
    RAISE NOTICE '   - Índice idx_questions_tipo_contenido creado';
END $$;
