-- =====================================================
-- MIGRACIÓN: Agregar campo visible_to_presenter
-- Fecha: 30-01-2026
-- Descripción: Permite controlar qué elementos son visibles 
--              para el presentador desde el panel de administración
-- =====================================================

-- Agregar columna a question_banks
ALTER TABLE question_banks 
ADD COLUMN IF NOT EXISTS visible_to_presenter BOOLEAN DEFAULT true;

COMMENT ON COLUMN question_banks.visible_to_presenter IS 
    'Controla si el banco es visible para el presentador (configurado desde admin)';

-- Agregar columna a games
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS visible_to_presenter BOOLEAN DEFAULT true;

COMMENT ON COLUMN games.visible_to_presenter IS 
    'Controla si el juego es visible para el presentador (configurado desde admin)';

-- Agregar columna a custom_games
ALTER TABLE custom_games 
ADD COLUMN IF NOT EXISTS visible_to_presenter BOOLEAN DEFAULT true;

COMMENT ON COLUMN custom_games.visible_to_presenter IS 
    'Controla si el juego personalizado es visible para el presentador (configurado desde admin)';

-- Crear índices para mejorar el rendimiento en queries de presentador
CREATE INDEX IF NOT EXISTS idx_question_banks_visible 
    ON question_banks(visible_to_presenter) 
    WHERE visible_to_presenter = true;

CREATE INDEX IF NOT EXISTS idx_games_visible 
    ON games(visible_to_presenter) 
    WHERE visible_to_presenter = true;

CREATE INDEX IF NOT EXISTS idx_custom_games_visible 
    ON custom_games(visible_to_presenter) 
    WHERE visible_to_presenter = true;

COMMENT ON INDEX idx_question_banks_visible IS 
    'Optimiza queries para obtener solo bancos visibles al presentador';

COMMENT ON INDEX idx_games_visible IS 
    'Optimiza queries para obtener solo juegos visibles al presentador';

COMMENT ON INDEX idx_custom_games_visible IS 
    'Optimiza queries para obtener solo juegos personalizados visibles al presentador';
