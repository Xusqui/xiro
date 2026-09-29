# Guía de Migración del Admin Panel

**Estado**: Arquitectura modular creada ✅  
**Próximos pasos**: Migrar funcionalidad del `admin.js` antiguo

## 📂 Archivos Creados

```
app/public/js/admin/
├── core/
│   ├── auth.js              ✅ Funciones de login y sesión
│   ├── api.js               ✅ Peticiones autenticadas
│   └── state.js             ✅ Estado global
├── modules/
│   ├── bancos.js            ✅ CRUD de bancos (stub)
│   ├── juegos.js            ✅ CRUD de juegos (stub)
│   ├── personalizados.js    ✅ CRUD juegos personalizados (stub)
│   ├── multimedia.js        ✅ Upload de archivos (completo)
│   └── tools.js             ✅ Herramientas (completo)
├── admin-main.js            ✅ Inicializador
└── README.md                ✅ Documentación
```

## 🔄 Pasos de Migración

### Fase 1: Actualizar HTML (Crítico)

El archivo `admin.html` debe cargar los scripts en este orden:

```html
<!-- ANTES (viejo) -->
<script src="/js/admin.js"></script>

<!-- DESPUÉS (nuevo) -->
<script src="/js/admin/core/auth.js"></script>
<script src="/js/admin/core/api.js"></script>
<script src="/js/admin/core/state.js"></script>

<script src="/js/admin/modules/tools.js"></script>
<script src="/js/admin/modules/multimedia.js"></script>
<script src="/js/admin/modules/bancos.js"></script>
<script src="/js/admin/modules/juegos.js"></script>
<script src="/js/admin/modules/personalizados.js"></script>

<script src="/js/admin/admin-main.js"></script>
```

**Ver**: [admin.html líneas 125-145](../admin.html) para hacer el cambio

### Fase 2: Expandir Módulos (Por hacer)

Los módulos actuales son **stubs** que necesitan funcionalidad real del `admin.js` antiguo:

#### `bancos.js` - Faltan:
- [ ] Upload de preguntas (CSV/JSON)
- [ ] Editor de preguntas individual
- [ ] Preview de preguntas
- [ ] Importación masiva

#### `juegos.js` - Faltan:
- [ ] Selector visual de preguntas
- [ ] Ordenar preguntas
- [ ] Preset de mezclas
- [ ] Validar PIN único

#### `personalizados.js` - Faltan:
- [ ] Editor de reglas personalizadas
- [ ] Configuración de equipos
- [ ] Temas personalizados
- [ ] Temporizadores

### Fase 3: Backend (Por revisar)

Verificar que estos endpoints existan:

```
GET  /api/admin-banks
POST /api/admin-banks
PUT  /api/admin-banks/:id
DEL  /api/admin-banks/:id

GET  /api/admin-games
POST /api/admin-games
PUT  /api/admin-games/:id
DEL  /api/admin-games/:id

GET  /api/admin-custom-games
POST /api/admin-custom-games
PUT  /api/admin-custom-games/:id
DEL  /api/admin-custom-games/:id

POST /api/admin-upload-image
POST /api/admin-upload-audio
POST /api/admin-delete-file

POST /api/admin-panic
POST /api/admin-cleanup
GET  /api/admin-metrics
POST /api/admin-disconnect
```

**Ubicación**: `/app/routes/admin.routes.js` (334 líneas)

### Fase 4: Testing

```bash
# Tests unitarios
npm test -- admin.routes.test.js

# Tests de integración
npm run test:admin
```

## 🔧 Cómo Continuar

### Opción A: Completar Todo (Recomendado)

1. Expandir `bancos.js` con funcionalidad de upload
2. Expandir `juegos.js` con editor visual
3. Expandir `personalizados.js` con configuraciones
4. Verificar todos los endpoints del backend
5. Reemplazar viejo `admin.js`

### Opción B: Migración Gradual

1. Mantener `admin.js` antiguo temporalmente
2. Cargar módulos nuevos además del viejo
3. Migrar feature por feature
4. Cuando todo está listo, eliminar viejo

**Recomendación**: Opción A (más limpio)

## 📋 Checklist de Completitud

- [ ] Modificar `admin.html` para cargar nuevos scripts
- [ ] Expandir `bancos.js` con upload de preguntas
- [ ] Expandir `juegos.js` con editor de mezclas
- [ ] Expandir `personalizados.js` con configuraciones
- [ ] Verificar endpoints del backend en `admin.routes.js`
- [ ] Probar cada módulo en el navegador
- [ ] Eliminar viejo `admin.js`
- [ ] Ejecutar tests
- [ ] Deploy a producción

## 💡 Tips de Desarrollo

### Depuración

```javascript
// Ver estado global
console.log(adminState);

// Ver rol actual
console.log(getUserRole());

// Cambiar vista manualmente
switchView('bancos');
```

### Añadir funcionalidad rápida

Todos los módulos usan las mismas funciones base:
- `apiGet/Post/Put/Delete()` - Peticiones
- `setLoading()` - Mostrar spinner
- `showNotification()` - Alertas
- `updateState()` - Actualizar estado
- `injectHTML()` - Renderizar

### Debugging de peticiones

```javascript
// Interceptar todas las peticiones
const originalFetch = fetch;
window.fetch = function(...args) {
    console.log('API call:', args[0]);
    return originalFetch.apply(this, args);
};
```

## 📞 Soporte

Si necesitas ayuda con:
- **Estructura modular**: Ver `README.md`
- **APIs specificas**: Ver comentarios en cada archivo
- **Endpoints backend**: Ver `/app/routes/admin.routes.js`
- **Testing**: Ver `/app/routes/__tests__/admin.routes.test.js`
