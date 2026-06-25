# Sistema de Migraciones de Base de Datos

Sistema integrado de migraciones para Xiro!, completamente integrado en el backend.

## 📁 Estructura

```
app/
├── migrations/
│   ├── migration-runner.js              # Motor de migraciones
│   ├── migrate.js                       # CLI de gestión
│   └── 20260118000001_add_multimedia_support.sql  # Migración multimedia
```

## 🚀 Ejecución Automática

Las migraciones se ejecutan **automáticamente** al iniciar el servidor:

```javascript
// En index.js
runPendingMigrations()
    .then(result => {
        if (result.executed > 0) {
            logger.info(`✅ ${result.executed} migración(es) ejecutada(s)`);
        }
    })
```

## 🛠️ Uso Manual (CLI)

### Ejecutar migraciones pendientes
```bash
node app/migrations/migrate.js up
```

### Ver estado de migraciones
```bash
node app/migrations/migrate.js status
```

### Crear nueva migración
```bash
node app/migrations/migrate.js create add_new_feature
```

Esto creará un archivo: `20260118123456_add_new_feature.sql`

## 📋 Tabla de Control

El sistema crea automáticamente una tabla `schema_migrations`:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL | ID autoincremental |
| version | VARCHAR(255) | Versión (timestamp) |
| name | VARCHAR(255) | Nombre descriptivo |
| executed_at | TIMESTAMP | Fecha de ejecución |
| execution_time_ms | INTEGER | Tiempo de ejecución |

## 🔢 Formato de Migraciones

Las migraciones siguen el formato: `{timestamp}_{nombre}.sql`

Ejemplo: `20260118000001_add_multimedia_support.sql`

### Plantilla de migración:

```sql
-- =====================================================
-- Migración: 20260118000001_nombre_descriptivo
-- Descripción: [Describe los cambios aquí]
-- Autor: Sistema
-- Fecha: 2026-01-18
-- =====================================================

-- Tu código SQL aquí
ALTER TABLE tabla ADD COLUMN nueva_columna VARCHAR(255);

-- Log de finalización
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Migración ejecutada exitosamente';
END $$;
```

## ✅ Características

- ✅ **Ejecución automática** al iniciar servidor
- ✅ **Transacciones** (COMMIT/ROLLBACK automático)
- ✅ **Control de versiones** (no ejecuta duplicados)
- ✅ **Logging completo** con tiempos de ejecución
- ✅ **CLI integrado** para gestión manual
- ✅ **Rollback automático** en caso de error
- ✅ **Ordenamiento cronológico** garantizado

## 📊 Logs

El sistema registra en los logs:

```
🔍 Verificando migraciones pendientes...
📋 1 migración(es) pendiente(s)
Ejecutando migración: 20260118000001_add_multimedia_support.sql
✅ Migración 20260118000001_add_multimedia_support.sql ejecutada exitosamente en 45ms
✅ 1 migración(es) ejecutada(s) exitosamente
```

## 🎯 Migraciones Disponibles

### 1. `20260118000001_add_multimedia_support.sql`
- ✅ Campo `tipo_contenido` (texto, imagen, audio)
- ✅ Campo `url_recurso` (URL del recurso)
- ✅ Índice de optimización
- ✅ Comentarios de documentación

### 2. `20260118000002_add_info_slide_type.sql`
- ✅ Soporte para slides informativos (sin respuesta)
- ✅ Tipo 'info' en question_type

### 3. `20260124000001_add_performance_indexes.sql`
- ✅ Índices de optimización para queries frecuentes

### 4. `20260130000001_add_visible_to_presenter.sql`
- ✅ Control de visibilidad de juegos/bancos para presentador

### 5. `20260202000001_add_composite_indexes.sql`
- ✅ Índices compuestos para queries con múltiples condiciones

### 6. `20260203192100_add_scoring_strategies.sql` ⭐ **NUEVA**
**Phase 17.2 - Estrategias de Puntuación**

**Tabla `questions`:**
- ✅ `scoring_strategy` VARCHAR(50): time_based | streak_bonus | betting
- ✅ `scoring_params` JSONB: Parámetros específicos de estrategia
- ✅ Índice para búsqueda por estrategia
- ✅ Constraint de validación

**Tabla `games`:**
- ✅ `streak_threshold` INTEGER: Umbral para activar racha (default: 3)
- ✅ `streak_bonus_percentage` DECIMAL: Bonus individual (default: 0.50 = +50%)
- ✅ `team_streak_enabled` BOOLEAN: Habilitar bonus de equipo
- ✅ `team_streak_bonus_percentage` DECIMAL: Bonus de equipo (default: 0.50 = +50%)
- ✅ Constraints de validación

**Características:**
- ✅ Backward compatible (todas las columnas con DEFAULT)
- ✅ Validación de valores permitidos
- ✅ Verificación automática post-migración
- ✅ Sin necesidad de UPDATE de datos existentes

### 7. `20260209000001_add_order_index.sql`
- ✅ Columna `order_index` en `options` para preguntas tipo "order"
- ✅ Indice `idx_options_question_order` para orden y consultas

## 🔒 Seguridad

- ✅ Cada migración se ejecuta en una **transacción**
- ✅ **Rollback automático** si falla
- ✅ **No se ejecutan migraciones duplicadas**
- ✅ **Validación de integridad** antes de ejecutar

## 📦 Integración con npm

Puedes agregar scripts en `package.json`:

```json
{
  "scripts": {
    "migrate": "node migrations/migrate.js up",
    "migrate:status": "node migrations/migrate.js status",
    "migrate:create": "node migrations/migrate.js create"
  }
}
```

Uso:
```bash
npm run migrate
npm run migrate:status
npm run migrate:create add_new_table
```

## 🚨 Troubleshooting

### Migración falló
```bash
# Ver logs del servidor
docker logs xiro-app

# Ejecutar manualmente
node app/migrations/migrate.js up
```

### Verificar estado
```bash
node app/migrations/migrate.js status
```

### Base de datos bloqueada
```sql
-- Conectar a PostgreSQL
psql -U postgres -d xiro_db

-- Ver migraciones ejecutadas
SELECT * FROM schema_migrations ORDER BY executed_at DESC;
```

---

**Sistema de producción listo** ✅
