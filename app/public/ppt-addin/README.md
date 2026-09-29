# Xiro! — Add-in para PowerPoint

**Versión:** 3.0.0  
**Plataforma:** Office 365 Desktop (Mac y Windows) / PowerPoint Online  
**Requisitos de API:** PowerPointApi 1.4+, DocumentEvents 1.1+

---

## Qué hace

El add-in permite **controlar una partida de Xiro! directamente desde PowerPoint**, sin salir de la presentación. Cada diapositiva puede tener asignado un rol XIRO (Lobby, Pregunta, Podio), y al avanzar por las diapositivas durante la presentación se abre automáticamente el diálogo de juego correspondiente en pantalla completa.

### Flujo de uso

```
[Modo edición]  Configuras cada diapositiva con su rol
                    ↓
[Modo presentación]  PowerPoint en "Presentación con diapositivas"
                    ↓
[Slide 1 → Lobby]   Se abre el QR de unión + lista de jugadores
                    ↓
[Botón Iniciar]     Arranca la partida
                    ↓
[Slide 2 → Pregunta 1]  Se abre la pregunta, timer, revelar respuesta, ranking
                    ↓
[Slide N → Podio]   Se muestra el podio final + opción de insertar diapositiva
```

---

## Arquitectura

```
ppt-addin/
├── manifest.xml              # Manifiesto Office Add-in (ID, URLs, permisos)
├── taskpane.html             # Shell del panel lateral
├── taskpane.css              # Estilos del panel lateral (edit + present)
├── taskpane.js               # Bootstrap: detecta modo edición/presentación
│
├── shared/
│   ├── state.js              # Estado global mínimo del add-in
│   ├── api.js                # Llamadas REST al servidor (getPresenterPins, etc.)
│   ├── notes-parser.js       # Parse/serialize línea XIRO: en notas (legado)
│   ├── qr-renderer.js        # Renderiza QR con QRious
│   └── logger.js             # XiroLog — panel visual + envío a /api/addin-log
│
├── modules/
│   ├── session.js            # generateId(pin) → "PIN-XXXX"
│   ├── slide-watcher.js      # Detecta cambio de diapositiva → abre diálogo
│   └── slide-inserter.js     # Inserta diapositiva de podio en la presentación
│
├── taskpane-edit/            # Modo edición (ReadWrite)
│   ├── notes-writer.js       # Lee/escribe tags de diapositiva + marcador visual
│   ├── edit-panel.js         # Panel raíz del modo edición
│   ├── slide-type-selector.js # Dropdown de rol XIRO
│   ├── lobby-editor.js       # Formulario Lobby (juego, modo, equipos)
│   └── question-editor.js    # Formulario Pregunta (índice)
│
├── taskpane-present/         # Modo presentación (ReadOnly)
│   ├── session-keeper.js     # Persiste {sessionId, pin, socket} entre diálogos
│   └── status-bar.js         # Barra mínima: session ID + punto de conexión
│
└── dialog/                   # Diálogo fullscreen (se abre por diapositiva)
    ├── dialog.html           # Shell del diálogo
    ├── dialog.css            # Tema oscuro fullscreen
    ├── dialog.js             # Bootstrap: emite 'ready', espera 'init'
    ├── dialog-router.js      # Monta la vista correcta según meta.role
    └── views/
        ├── view-lobby.js     # QR + lista de jugadores + botón Iniciar
        ├── view-question.js  # Pregunta + timer + revelar
        ├── view-ranking.js   # Ranking intermedio tras revelar
        └── view-podium.js    # Podio final + insertar diapositiva
```

### Almacenamiento de metadata

La metadata XIRO se guarda en los **tags de la diapositiva** (PowerPointApi 1.3+), no en las notas del orador. Los tags persisten dentro del fichero `.pptx` y no requieren que el panel de notas esté abierto.

```
Tag key:   XIRO_META
Valor:     {"role":"lobby","pin":"DIATERMIA","gameId":14,"mode":"individual"}
           {"role":"question","index":2}
           {"role":"podium"}
```

Adicionalmente se inserta un **marcador visual** (text box) en la esquina superior derecha de cada diapositiva configurada:

| Rol       | Etiqueta             | Color     |
|-----------|---------------------|-----------|
| Lobby     | `XIRO: Lobby`       | Morado    |
| Pregunta  | `XIRO: Pregunta #N` | Azul      |
| Podio     | `XIRO: Podio`       | Ámbar     |

### Comunicación diálogo ↔ task pane

El diálogo está aislado en un iframe. La comunicación usa la Office Dialog API:

```
Task pane → Diálogo:   dlg.messageChild(JSON.stringify({ action, meta, session }))
Diálogo → Task pane:   Office.context.ui.messageParent(JSON.stringify({ event, data }))
```

Eventos relevantes:

| Evento (diálogo → task pane) | Significado |
|------------------------------|-------------|
| `ready`          | Diálogo cargado, listo para recibir `init` |
| `session-created`| Lobby completado, datos de sesión listos |
| `question-done`  | Pregunta terminada, índice actualizado |
| `insert-podium`  | Solicita insertar diapositiva de podio |
| `dialog-closed`  | Diálogo cerrado por el usuario |

---

## Instalación

### Mac (sideload local)

```bash
mkdir -p ~/Library/Containers/com.microsoft.PowerPoint/Data/Documents/wef
cp /ruta/al/manifest.xml \
   ~/Library/Containers/com.microsoft.PowerPoint/Data/Documents/wef/xiro-presenter.xml
```

Cierra PowerPoint completamente y vuelve a abrirlo. El botón **Xiro!** aparecerá en la pestaña **Inicio**.

### Windows (sideload local)

1. Abre PowerPoint → **Archivo → Opciones → Centro de confianza → Configuración del Centro de confianza → Catálogos de aplicaciones de confianza**.
2. Añade la URL del catálogo o usa un directorio compartido local con `manifest.xml`.
3. Reinicia PowerPoint → **Insertar → Mis complementos → Xiro!**

### Despliegue organizacional (Microsoft 365 Admin Center)

1. Ve a **admin.microsoft.com → Configuración → Aplicaciones integradas**.
2. Sube `manifest.xml` o proporciona la URL: `https://xiro.pro/ppt-addin/manifest.xml`.
3. Asigna a los usuarios o grupos correspondientes.

---

## Uso — Modo edición

1. Abre una presentación en PowerPoint en modo **Edición** (no Presentación).
2. Haz clic en **Xiro!** en la cinta → se abre el panel lateral.
3. El panel muestra **Modo: EDITAR**.
4. Selecciona una diapositiva. El panel muestra su rol actual.
5. Usa el desplegable para asignar un rol:
   - **Lobby**: elige el juego y el modo (individual/equipos). Pulsa *Guardar*.
   - **Pregunta**: indica el índice (0 = primera pregunta). Pulsa *Guardar*.
   - **Podio**: no requiere configuración extra. Pulsa *Marcar como podio*.
6. Al guardar, aparece un marcador de color en la esquina superior derecha de la diapositiva.
7. Para quitar el rol, selecciona *— Sin rol XIRO —* en el desplegable.

> **Tip:** Estructura recomendada de la presentación:
> ```
> Diap. 1  →  Lobby (unirse con QR)
> Diap. 2  →  Pregunta 1  (index: 0)
> Diap. 3  →  Pregunta 2  (index: 1)
> ...
> Diap. N  →  Podio final
> ```

---

## Uso — Modo presentación

1. Inicia la presentación con **F5** o el botón de presentación de PowerPoint.
2. El panel de Xiro! pasa a **Modo: PRESENTAR** (solo visible para el presentador).
3. **Diapositiva Lobby**: se abre automáticamente el diálogo de sala de espera con el código QR. Los participantes van a `xiro.pro/join` y escriben el código. Cuando estén todos, pulsa **▶ Iniciar partida**.
4. **Diapositiva Pregunta**: al llegar a esta diapositiva se abre el diálogo con la pregunta en pantalla completa. El timer corre localmente. Cuando quieras revelar la respuesta, pulsa **Revelar respuesta** → se muestra el ranking intermedio → pulsa **Continuar presentación** para cerrar el diálogo.
5. **Diapositiva Podio**: se carga el podio final desde el servidor. Puedes pulsar **Insertar diapositiva** para añadir una diapositiva con el ranking al final de la presentación.

---

## Sistema de logs de depuración

El add-in incluye un panel de debug en el propio panel lateral (barra inferior desplegable) y envía los logs al servidor:

```
POST /api/addin-log
Body: { level, module, message, data }
```

Los mensajes aparecen en los logs de Winston del backend con el prefijo `[addin]`:

```
[info]  [addin] Office.initialize   { source: 'ppt-addin', module: 'taskpane' }
[debug] [addin] writeXiroMeta OK    { source: 'ppt-addin', module: 'notes-writer' }
```

Para activar o desactivar el panel visual, llama a `XiroLog.mountPanel(container)` en la consola del navegador embebido.

---

## Variables de entorno / configuración

El add-in no usa variables de entorno propias. Se comunica con el servidor Xiro a través de:

- **REST**: `GET /api/presenter-pins` — obtiene la lista de juegos disponibles con sus PINs.
- **Socket.IO**: conexión en `/socket.io/` con `transports: ['websocket']`.
- **Logs**: `POST /api/addin-log`.

La URL base se infiere del origen del documento (`window.location.origin`), por lo que funciona tanto en `https://xiro.pro` como en `localhost`.

---

## Permisos requeridos

| Permiso | Motivo |
|---------|--------|
| `ReadWriteDocument` | Leer/escribir tags de diapositivas y añadir shapes (marcadores) |
| `DocumentEvents`    | Detectar cambio de diapositiva seleccionada |
| `PowerPointApi 1.4` | `addTextBox`, `shapes.load`, `tags.add` |

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| El botón Xiro! no aparece | Manifest no cargado | Cierra PowerPoint completamente y reabre |
| El panel muestra "Error al leer diapositiva" | API de PowerPoint no disponible | Comprueba que estás en PowerPoint ≥ 2019 o M365 |
| No aparece el marcador en la diapositiva | `addTextBox` requiere API 1.4 | Actualiza Office |
| El diálogo no se abre en presentación | Política de ventanas emergentes | Asegúrate de que el dominio `xiro.pro` está en AppDomains del manifest |
| Los logs no llegan al servidor | Red o CORS | Comprueba que el servidor está corriendo y que `xiro.pro` es accesible |
