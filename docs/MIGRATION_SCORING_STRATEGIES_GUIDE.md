# Guía de Migración - Estrategias de Puntuación

## 📋 Resumen

Esta migración agrega soporte completo para **estrategias de puntuación configurables** en Xiro! (Phase 17.2).

**Archivo**: `20260203192100_add_scoring_strategies.sql`

---

## ✅ Respuesta a tu pregunta

> **"¿Cómo es posible que pasen los tests si la base de datos no está preparada?"**

**Respuesta**: Los tests que creé son **tests unitarios** que NO requieren base de datos porque:

1. Usan **objetos mock/fake** para simular preguntas y juegos
2. Prueban **lógica pura** (cálculos matemáticos, validaciones)
3. NO hacen queries reales a PostgreSQL
4. Están en `domain/strategies/` (capa de dominio, sin dependencias de BD)

**Ejemplo de test sin BD**:
```javascript
// NO requiere BD - objeto fake
const question = {
    scoring_strategy: 'streak_bonus',
    scoring_params: { streakThreshold: 3 }
};

const game = {
    streak_threshold: 3,
    streak_bonus_percentage: 0.50
};

// Test de lógica pura
const strategy = strategyFactory.createFromQuestion(question, game);
const result = strategy.calculatePoints({ ... });
```

Sin embargo, para que funcione en **PRODUCCIÓN CON BD REAL**, necesitamos esta migración.

---

## 🎯 ¿Qué agrega esta migración?

### Tabla `questions` (2 columnas nuevas)

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `scoring_strategy` | VARCHAR(50) | `'time_based'` | Estrategia: time_based, streak_bonus, betting |
| `scoring_params` | JSONB | `NULL` | Parámetros JSON específicos |

**Constraint**: Solo permite valores: `'time_based'`, `'streak_bonus'`, `'betting'`

**Índice**: `idx_questions_scoring_strategy` para búsquedas rápidas

**Ejemplos de uso**:
```sql
-- Pregunta con sistema de apuestas
INSERT INTO questions (text, scoring_strategy, scoring_params) VALUES (
    '¿Cuál es la capital de Francia?',
    'betting',
    '{"minBetPercentage": 0.10, "allowNegativeScore": false}'
);

-- Pregunta con bonus de racha
INSERT INTO questions (text, scoring_strategy) VALUES (
    '¿2 + 2?',
    'streak_bonus'
);

-- Pregunta normal (usa default)
INSERT INTO questions (text) VALUES ('Pregunta estándar');
-- scoring_strategy = 'time_based' (automático)
```

---

### Tabla `games` (4 columnas nuevas)

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `streak_threshold` | INTEGER | `3` | Respuestas correctas para racha |
| `streak_bonus_percentage` | DECIMAL(3,2) | `0.50` | Bonus individual (+50%) |
| `team_streak_enabled` | BOOLEAN | `true` | Habilitar bonus de equipo |
| `team_streak_bonus_percentage` | DECIMAL(3,2) | `0.50` | Bonus adicional de equipo |

**Constraints**:
- `streak_threshold > 0`
- Porcentajes entre `0.00` y `2.00` (0% a 200%)

**Ejemplos de uso**:
```sql
-- Juego con rachas muy exigentes
INSERT INTO games (pin, streak_threshold, streak_bonus_percentage) VALUES (
    'ABC123',
    5,          -- 5 correctas para activar racha
    0.75        -- +75% de bonus
);

-- Juego sin bonus de equipo
INSERT INTO games (pin, team_streak_enabled) VALUES (
    'DEF456',
    false       -- Solo rachas individuales
);

-- Juego normal (usa defaults)
INSERT INTO games (pin) VALUES ('GHI789');
-- streak_threshold = 3, streak_bonus = 50%, team enabled
```

---

## 🚀 ¿Cómo ejecutar la migración?

### Opción 1: Automática (al iniciar servidor)
```bash
# Simplemente inicia el servidor
npm start

# La migración se ejecuta automáticamente si está pendiente
# Verás en logs:
# 🔍 Verificando migraciones pendientes...
# 📋 1 migración(es) pendiente(s)
# Ejecutando migración: 20260203000001_add_scoring_strategies.sql
# ✅ Migración ejecutada exitosamente
```

### Opción 2: Manual (CLI)
```bash
# Ver estado
node app/migrations/migrate.js status

# Ejecutar pendientes
node app/migrations/migrate.js up
```

### Opción 3: SQL directo
```bash
# Conectar a PostgreSQL
docker exec -it xiro_postgres psql -U postgres -d xiro_db

# Ejecutar migración
\i /app/migrations/20260203192100_add_scoring_strategies.sql
```

---

## 🔍 Verificación Post-Migración

### 1. Verificar columnas en `questions`
```sql
\d questions

-- Deberías ver:
-- scoring_strategy | character varying(50) | default 'time_based'
-- scoring_params   | jsonb                 |
```

### 2. Verificar columnas en `games`
```sql
\d games

-- Deberías ver:
-- streak_threshold              | integer         | default 3
-- streak_bonus_percentage       | numeric(3,2)    | default 0.50
-- team_streak_enabled           | boolean         | default true
-- team_streak_bonus_percentage  | numeric(3,2)    | default 0.50
```

### 3. Verificar constraints
```sql
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public';

-- Deberías ver:
-- chk_scoring_strategy_valid
-- chk_streak_threshold_positive
-- chk_streak_bonus_range
-- chk_team_streak_bonus_range
```

### 4. Verificar índice
```sql
\di idx_questions_scoring_strategy

-- Debería existir
```

---

## ✅ Backward Compatibility

**IMPORTANTE**: Esta migración es 100% compatible con código existente:

1. ✅ **Todas las columnas tienen DEFAULT**
   - No requiere UPDATE de datos existentes
   - Preguntas/juegos actuales funcionan sin cambios

2. ✅ **Comportamiento por defecto = sistema actual**
   - `scoring_strategy = 'time_based'` (sistema actual)
   - Mismo cálculo de puntos que antes

3. ✅ **No rompe queries existentes**
   - Columnas nuevas son opcionales
   - SELECT/INSERT antiguos siguen funcionando

4. ✅ **Código legacy sigue funcionando**
   - ScoringService mantiene métodos deprecated
   - processAnswer() acepta parámetros antiguos

**Ejemplo de compatibilidad**:
```javascript
// CÓDIGO ANTIGUO (sigue funcionando)
const result = ScoringService.processAnswer({
    question,
    answerIndex,
    gameStartTime,
    currentTime
});
// ✅ Funciona - usa time_based por defecto

// CÓDIGO NUEVO (con estrategias)
const result = ScoringService.processAnswer({
    question,
    answerIndex,
    gameStartTime,
    currentTime,
    game,           // NUEVO
    playerState,    // NUEVO
    teamState,      // NUEVO
    betState        // NUEVO
});
// ✅ Funciona - usa estrategia de question.scoring_strategy
```

---

## 📊 Impacto en Producción

### Tiempo de ejecución
- **Estimado**: < 1 segundo
- **Operación**: ALTER TABLE (agrega columnas con DEFAULT)
- **Bloqueo**: Mínimo (no requiere reescritura de tabla)

### Espacio en disco
- **Adicional**: ~200 bytes por pregunta + ~400 bytes por juego
- **Para 1000 preguntas + 100 juegos**: ~240 KB adicionales

### Índice
- **Espacio**: ~100 KB para 1000 preguntas
- **Impacto**: Mejora búsquedas por estrategia

---

## 🎮 Cómo usar las nuevas estrategias

### 1. Crear pregunta con apuestas
```sql
INSERT INTO questions (
    question_bank_id,
    text,
    question_type,
    scoring_strategy,
    scoring_params,
    options
) VALUES (
    1,
    '¿Quién pintó la Mona Lisa?',
    'quiz',
    'betting',
    '{"minBetPercentage": 0.10, "maxBetAbsolute": 1000, "allowNegativeScore": false}',
    '[{"text": "Leonardo da Vinci", "isCorrect": true}, {"text": "Picasso", "isCorrect": false}]'
);
```

### 2. Configurar juego con rachas personalizadas
```sql
UPDATE games 
SET 
    streak_threshold = 4,              -- 4 correctas para racha
    streak_bonus_percentage = 0.60,    -- +60% bonus
    team_streak_bonus_percentage = 0.40 -- +40% extra si todo el equipo
WHERE pin = 'ABC123';
```

### 3. Desde código (JavaScript)
```javascript
// ScoringService detecta automáticamente la estrategia
const result = ScoringService.processAnswer({
    question: {
        scoring_strategy: 'streak_bonus',
        // ... otros campos
    },
    game: {
        streak_threshold: 3,
        streak_bonus_percentage: 0.50
    },
    playerState: {
        currentStreak: 3  // Jugador en racha
    },
    teamState: {
        inStreak: true    // Todo el equipo en racha
    },
    // ...
});

// result.details contiene:
// {
//     strategy: 'streak_bonus',
//     basePoints: 40,
//     streakBonus: 40,  // 40 * 0.50 (individual) + 40 * 0.50 (equipo)
//     totalPoints: 80
// }
```

---

## 🔄 Rollback (si es necesario)

Si necesitas revertir la migración:

```sql
BEGIN;

-- Eliminar constraints
ALTER TABLE questions DROP CONSTRAINT IF EXISTS chk_scoring_strategy_valid;
ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_streak_threshold_positive;
ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_streak_bonus_range;
ALTER TABLE games DROP CONSTRAINT IF EXISTS chk_team_streak_bonus_range;

-- Eliminar índice
DROP INDEX IF EXISTS idx_questions_scoring_strategy;

-- Eliminar columnas de questions
ALTER TABLE questions DROP COLUMN IF EXISTS scoring_strategy;
ALTER TABLE questions DROP COLUMN IF EXISTS scoring_params;

-- Eliminar columnas de games
ALTER TABLE games DROP COLUMN IF EXISTS streak_threshold;
ALTER TABLE games DROP COLUMN IF EXISTS streak_bonus_percentage;
ALTER TABLE games DROP COLUMN IF EXISTS team_streak_enabled;
ALTER TABLE games DROP COLUMN IF EXISTS team_streak_bonus_percentage;

COMMIT;
```

---

## 📚 Documentación Relacionada

- **Código**: `domain/strategies/scoring/`
- **Tests**: `domain/strategies/scoring/__tests__/`
- **Resumen Día 4**: `docs/PHASE_17_2_DIA_4_SUMMARY.md`
- **Roadmap**: `REFACTORING_ROADMAP.md`

---

## ✅ Checklist de Implementación

- [x] Tests unitarios (128 tests pasando)
- [x] Código de estrategias (ScoringStrategy, Factory, Service)
- [x] Migración de BD creada
- [ ] **Migración ejecutada en BD** ← **PENDIENTE**
- [ ] Verificación post-migración
- [ ] UI para apuestas (jugador.html)
- [ ] Socket events (submit-bet, all-bets-placed)
- [ ] Admin panel (configurar estrategias)

---

**Siguiente paso**: Ejecutar la migración con `npm start` o `node app/migrations/migrate.js up`
