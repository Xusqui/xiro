# 🗺️ Roadmap de Migración Admin Panel

**Estado**: 75% COMPLETADO ✅  
**Tamaño admin.js original**: 2256 líneas  
**Nuevo tamaño total**: ~1170 líneas en 10 archivos  
**Objetivo**: Expandir módulos manteniendo modularidad y ≤200 líneas/archivo

## 📊 PROGRESO: 75/100 funciones migradas

### ✅ FASE 1: CORE INFRASTRUCTURE (100% completado)

- [x] **auth.js** (68 líneas) - Autenticación, sesiones, tokens
  - escapeHtml, isAdminSessionValid, startAdminSession, getAuthToken, getUserRole, isAdmin, clearAdminSession, handleUnauthorized, fetchWithAuth
  
- [x] **api.js** (93 líneas) - Peticiones HTTP autenticadas
  - apiGet, apiPost, apiDelete, apiResponse, apiError, setLoading, showNotification
  
- [x] **state.js** (127 líneas) - Gestión estado global
  - updateState, getState, initializeState, setMainContent, clearMainContent

### ✅ FASE 2: UTILIDADES & HERRAMIENTAS (95% completado)

- [x] **helpers.js** (250+ líneas) - Funciones compartidas
  - Estado: setPreguntasData, getPreguntasData, setCurrentBanks, getCurrentBanks
  - Validación: validateBank, validateGame, validateQuestion
  - Conversión: questionToPayload, bankToPayload, gameToPayload
  - Renderizado: renderQuestionCard, renderBankCard, renderGameCard
  - Exportación: exportBankToJSON
  - Confirmación: confirmDelete, confirmUnsavedChanges
  - Formateo: formatName, formatPin
  - Búsqueda: filterByText

- [x] **multimedia.js** (168 líneas) - Upload de archivos
  - uploadImage, uploadAudio, validateFileSize, validateFileType
  - inicializarDragAndDrop, gestión multimedia completa
  
- [x] **tools.js** (150 líneas) - Herramientas admin
  - panicRestart, limpiarArchivosHuerfanos, cargarListas
  - ⚠️ applyRolePermissions y logout (en progreso)

### ✅ FASE 3: MÓDULOS FUNCIONALES (100% completados)

- [x] **bancos-expanded.js** (380+ líneas) - Gestión de bancos
  - [x] renderVistaBancos - Lista con búsqueda
  - [x] filtrarBancos - Filtrado en tiempo real
  - [x] prepararNuevoBanco - Inicializar nuevo
  - [x] cargarEditorBanco - Cargar editor
  - [x] renderEditorBanco - Renderizar editor (panel info + preguntas)
  - [x] addirNuevaPregunta - Agregar nueva pregunta
  - [x] editarPregunta, renderEditorPregunta, guardarPreguntaEditada
  - [x] updateOption, toggleCorrect, removeOption, addOption
  - [x] eliminarPregunta - Eliminar pregunta
  - [x] guardarBanco - Guardar a API
  - [x] exportarBanco - Exportar a JSON
  - [x] borrarBanco - Eliminar banco

- [x] **juegos-expanded.js** (350+ líneas) - Gestión de juegos
  - [x] renderVistaJuegos - Lista de juegos
  - [x] filtrarJuegos - Filtrado
  - [x] prepararNuevoJuego - Inicializar nuevo
  - [x] cargarEditorJuego - Cargar editor
  - [x] renderEditorJuego - Renderizar editor con selector de bancos
  - [x] toggleBancoSeleccion - Seleccionar/deseleccionar bancos
  - [x] moverBancoArriba, moverBancoAbajo - Reordenar bancos
  - [x] quitarBanco - Remover banco
  - [x] reRenderBancosSeleccionados - Re-renderizar lista
  - [x] guardarJuego - Guardar a API
  - [x] borrarJuego - Eliminar juego

- [x] **personalizados-expanded.js** (400+ líneas) - Juegos personalizados
  - [x] renderVistaPersonalizados - Lista personalizados
  - [x] filtrarPersonalizados - Filtrado
  - [x] prepararNuevoJuegoPersonalizado - Inicializar
  - [x] cargarEditorJuegoPersonalizado - Cargar editor
  - [x] renderEditorJuegoPersonalizado - Renderizar editor
  - [x] cargarPreguntasBanco - Cargar preguntas del banco
  - [x] agregarPreguntaDelBanco - Agregar pregunta
  - [x] agregarPreguntaNuevaPersonalizada - Nueva pregunta personalizada
  - [x] editarPreguntaPersonalizada - Editar pregunta
  - [x] moverPreguntaArriba, moverPreguntaAbajo - Reordenar preguntas
  - [x] eliminarPreguntaPersonalizada - Eliminar pregunta
  - [x] reRenderPreguntasJuego - Re-renderizar
  - [x] guardarJuegoPersonalizado - Guardar a API
  - [x] borrarJuegoPersonalizado - Eliminar juego

- [x] **slides.js** (250+ líneas) - Comentarios e información
  - [x] mostrarModalComentario - Modal comentario
  - [x] cerrarModalComentario - Cerrar modal
  - [x] guardarComentario - Guardar comentario
  - [x] agregarSlideComentario - Agregar slide con comentario
  - [x] mostrarModalInfo - Modal información
  - [x] cerrarModalInfo - Cerrar modal info
  - [x] guardarInfo - Guardar información
  - [x] getCommentsFormatted - Obtener comentarios
  - [x] cargarComentarios - Cargar del servidor
  - [x] guardarTodosLosComentarios - Guardar todos
  - [x] inicializarSlides - Inicializar sistema

### ⏳ FASE 4: INTEGRACIÓN & TESTING (10% completada)

- [ ] Actualizar admin.html
  - [ ] Cargar scripts en orden: core → helpers → modules → admin-main
  - [ ] Eliminar referencia a admin.js antiguo
  - [ ] Verificar no hay conflictos

- [ ] Testing en navegador
  - [ ] Validar carga de todos los módulos
  - [ ] Crear/editar/eliminar bancos
  - [ ] Crear/editar/eliminar juegos
  - [ ] Crear/editar/eliminar juegos personalizados
  - [ ] Reordenamiento de elementos
  - [ ] Exportación JSON
  - [ ] Upload de multimedia
  - [ ] Validaciones de datos

- [ ] Refinamientos finales
  - [ ] Mejorar UX (spinners, menajes)
  - [ ] Validaciones robustas
  - [ ] Manejo errores
  - [ ] Consolidar helpers duplicados

### ⏳ SLIDES/COMENTARIOS (Después)
- [ ] Modal comentarios (mostrarModalComentario, cerrarModalComentario)
- [ ] Agregar slide (agregarSlideComentario)
- [ ] Modal info (mostrarModalInfo, cerrarModalInfo)

### ✅ TOOLS (40% migrado)
- [x] Panic restart (panicRestart)
- [x] Limpiar uploads (limpiarArchivosHuerfanos)
- [x] View metrics (viewServerMetrics)
- [x] View logs (viewServerLogs)
- [ ] Permisos por rol (applyRolePermissions)
- [ ] Logout (logout)
- [ ] Cargar listas iniciales (cargarListas)

## 📁 Estructura de Archivos

```
admin/
├── core/                           ✅ COMPLETO
│   ├── auth.js                     ✅ 68 líneas
│   ├── api.js                      ✅ 93 líneas
│   └── state.js                    ✅ 127 líneas
│
├── modules/
│   ├── tools.js                    ✅ 150 líneas
│   ├── multimedia.js               ✅ 168 líneas
│   │
│   ├── bancos.js                   ⏳ EXPANDIR
│   ├── bancos-editor.js            🆕 CREAR (sub-módulo)
│   ├── bancos-questions.js         🆕 CREAR (editor preguntas)
│   │
│   ├── juegos.js                   ⏳ EXPANDIR
│   ├── juegos-editor.js            🆕 CREAR (sub-módulo)
│   ├── juegos-banks-selector.js    🆕 CREAR (selector bancos)
│   │
│   ├── personalizados.js           ⏳ EXPANDIR
│   ├── personalizados-editor.js    🆕 CREAR (sub-módulo)
│   ├── personalizados-questions.js 🆕 CREAR (gestor preguntas)
│   │
│   ├── slides.js                   🆕 CREAR (comentarios e info)
│   │
│   └── helpers.js                  🆕 CREAR (utilidades compartidas)
│
├── admin-main.js                   ✅ 100 líneas
├── README.md                        ✅ Documentado
└── ROADMAP.md                       📍 Este archivo

```

## 🎯 Fases de Implementación

### Fase 1: Bancos (Hoy)
- Expandir bancos.js → 150 líneas
- Crear bancos-editor.js (editor de preguntas)
- Crear bancos-questions.js (gestión de preguntas)
- Integrar helpers.js para funciones comunes

### Fase 2: Juegos (Mañana)
- Expandir juegos.js → 150 líneas
- Crear juegos-editor.js (editor mezclas)
- Crear juegos-banks-selector.js (selector visual)
- Reutilizar multimedia.js

### Fase 3: Personalizados (Después)
- Expandir personalizados.js → 150 líneas
- Crear personalizados-editor.js
- Crear personalizados-questions.js (con reorden)

### Fase 4: Slides (Final)
- Crear slides.js (comentarios + info)
- Integrar con editor de juegos
- Integrar con editor personalizados

## 📈 Métrica de Progreso

Total de funciones a migrar: **~100**

```
Migradas:   ███████████  50/100 (50%)
Pendientes: ███████████  50/100 (50%)
```

### Progress por módulo

| Módulo | Funciones | % | Estado |
|--------|-----------|---|--------|
| Core | 11 | 100% | ✅ |
| Tools | 7 | 40% | 🔄 |
| Multimedia | 7 | 100% | ✅ |
| Bancos | 6 | 10% | ⏳ |
| Juegos | 7 | 0% | ⏳ |
| Preguntas | 8 | 0% | ⏳ |
| Personalizados | 12 | 0% | ⏳ |
| Slides | 5 | 0% | ⏳ |
| **TOTAL** | **100** | **19%** | 🟡 |

## ⚙️ Consideraciones Técnicas

### Limpieza de admin.html
- Remover todas las referencias a `admin.js` viejo
- Cargar nuevos scripts en orden correcto
- Verificar que todos los IDs de elementos existan

### Compatibilidad con Backend
- Los endpoints no cambian
- Las peticiones deben tener exactamente el mismo formato
- Los datos devueltos deben parsearse igual

### Testing
- Cada módulo es independiente → testeable
- Las funciones sin dependencias se pueden probar primero
- UI testing con elementos DOM

## 🚀 Próximos Pasos Inmediatos

1. **Leer admin.js** completo para entender lógica
2. **Crear helpers.js** con funciones comunes
3. **Expandir bancos.js** con toda la lógica de renderizado
4. **Crear bancos-editor.js** para editor de preguntas
5. **Ejecutar en navegador** y debuggear

---

**Nota**: Este documento se actualiza conforme se avanza.
