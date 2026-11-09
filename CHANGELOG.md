# Historial de versiones de XiRo!

## 3.11.x

### 3.11.1 — 11/9/2026 · `v3.11.1`
- **Actualizaciones:** el panel muestra las novedades antes de actualizar
  - Nuevo modal con las versiones entre la instalada y la nueva, y el historial anterior plegado.
  - Avisa de las partidas en curso y permite actualizar aunque GitHub no responda.
- **Changelog:** generar la entrada de cada versión a partir de los commits

### 3.11.0 — 2026-11-09 · `v3.11.0`
- **Portada:** XiRo parpadea cada 3-5 s y caza con la lengua una mosca que entra por abajo cada 15-20 s.
- **Calidad de código:**
  - Se dividen en módulos `admin.routes`, `validation`, `RedisSyncBus`, `pdf.service` y `GameEndManager`.
  - Todas las funciones del servidor tienen 50 líneas o menos, ESLint queda sin avisos y los exports públicos del servidor llevan JSDoc.
  - Se validan con Joi las rutas que faltaban y se normaliza el PIN de Trivial.
  - Se registran los fallos de Redis en el cierre de sesión, `TrivialGameState` y el autoguardado.
  - Los tokens de un solo uso del panel se unifican en `admin-token-flow`.
- **API:** `updateTrivialGame` responde 403/404 en los rechazos de propiedad (antes, 400). Se eliminan las rutas sin uso `GET /api/banks/list-files` y `POST /api/quizzes/save-all`.
- **PDF:** los WebP se incrustan con su MIME correcto y una sola conversión a base64.
- **Documentación:** nuevo `CHANGELOG.md` con el historial de versiones y sus novedades.

---

## 3.10.x

### 3.10.7 — 2026-11-04 · `v3.10.7`
- **Standalone:** nuevo botón para cerrar la partida. Se corrige que la sesión siguiera activa al abandonarla.

### 3.10.6 — 2026-11-03 · `v3.10.6`
- **Admin:** la opción «Jugadores en el ranking en partida» pasa a un sitio más apropiado del panel.

### 3.10.5 — 2026-11-03 · `v3.10.5`
- **Corrección:** no se podía cambiar el tiempo de reconexión; el panel mostraba un error.

### 3.10.4 — 2026-11-02 · `v3.10.4`
- **Admin:** la alineación de texto deja de usar listas desplegables y pasa a iconos para la alineación horizontal y vertical.

### 3.10.3 — 2026-11-02 · `v3.10.3`
- **Diapositivas animadas de instrucciones (primera fase):** nuevo tipo de diapositiva «how-to» que explica cada tipo de pregunta, con validador, migraciones de base de datos y locuciones de audio por idioma.
- **Portada:** rediseño de `index.html` tras añadir la casilla para introducir el `session_id`.
- **Corrección visual:** las tarjetas de la pantalla principal siempre salían en dos filas, fuera cual fuera el ancho.

### 3.10.2 — 2026-11-01 · `v3.10.2`
- **Reacciones:** las reacciones con emoji de los jugadores aparecen antes.
- **Corrección (presentador):** habían dejado de verse las pistas de las preguntas numéricas. Ahora, sin imagen, la pista va dentro de la tarjeta de la pregunta y, con imagen, en una franja bajo ella. Se elimina el overlay flotante, que tapaba el enunciado.

### 3.10.1 — 2026-11-01 · `v3.10.1`
- **Portada:** entrada directa a una partida por ID de sesión desde la tarjeta «Jugador» (formulario que lleva a `jugador.html?session=ID`), traducida a los 10 idiomas.

### 3.10.0 — 2026-11-01 · `v3.10.0`
- **Revisión visual completa:**
  - Presentador: títulos, temporizador, contador y botón de revelar sobre un velo oscuro, legibles sobre la selva.
  - Columna de jugadores adaptada a salas grandes (fichas en mosaico si no caben; probado con 100 jugadores).
  - Colores de rol en la tarjeta numérica, el error de carga de PIN y los filtros del lobby.
  - Cuenta atrás: se corrige la costura negra del «3».
  - Jugador: opciones como fichas planas. Admin con «voz de consola» y textos de marca revisados.
- **Portada:** tarjetas de rol sin desbordes, contraste AA y titular «Elige tu rol».

---

## 3.9.x

### 3.9.1-a — 2026-10-31 · `v3.9.1a`
- **Limpieza:** se borra código muerto.

### 3.9.1 — 2026-10-30 · `v3.9.1`
- **Aproximación numérica:** una respuesta aproximada (dentro de la tolerancia) mantiene la racha.

### 3.9.0 — 2026-10-30 · `v3.9.0`
- **Avatares de jugador:** cada jugador elige un avatar al unirse (catálogo Fluent Emoji de 48; el admin decide cuáles se ofrecen en Configuración → Interfaz). Aparece en el lobby, el panel de jugadores, el Top 5, el podio (también en el 3D) y la TV. El servidor valida el avatar contra el conjunto activo.
- **Encuesta de respuesta única:** al revelar, el móvil muestra la gráfica de porcentajes con el voto propio marcado y el número de respuestas.

---

## 3.8.0 — 2026-10-30 · `v3.8.0`
- **Reacciones con emoji en directo:** los jugadores mandan emojis desde el móvil y suben flotando por una columna en el presentador y la TV. Son anónimas y efímeras (no se guardan ni puntúan).
  - Catálogo de 26 emojis y juego de 6 configurable en Configuración → Interfaz.
  - El presentador puede silenciarlas desde el menú ⋯, con la tecla **R** o desde el mando.
  - Una misma regla (`ReactionPolicy`) en servidor y cliente decide cuándo se pueden mandar, para no revelar información durante la pregunta.
- **Corrección (Completa la frase):** al repetir un juego en la misma pestaña, los huecos ya no heredan lo escrito en la partida anterior.

---

## 3.7.x

### 3.7.9 — 2026-10-29 · `v3.7.9`
- **Podio 3D:** los fuegos artificiales se dibujan detrás de los bloques, el título y las filas, sin tapar el fondo de la selva.

### 3.7.8-b — 2026-10-29 · `v3.7.8b`
- **Actualizaciones:** cambia la forma de buscar si hay una versión nueva.

### 3.7.8-a — 2026-10-29 · `v3.7.8a`
- Se retira la monitorización con Grafana/Prometheus, que se había colado por error (está prevista en la hoja de ruta para más adelante).

### 3.7.8 — 2026-10-29 · `v3.7.8`
- **Despliegue con proxy inverso propio (NAS):** nueva plantilla `docker-compose.deploy.nas.yml` sin Caddy, con el backend en `127.0.0.1:3000` (`APP_BIND` y `APP_PORT`). README con ejemplos para Synology DSM 7, QNAP, Nginx Proxy Manager y nginx.
- **Corrección Docker:** en `docker-compose.yml` el backend depende de `chrome`; con `up backend` los PDF fallaban (`ENOTFOUND chrome`).
- **Mantenimiento:** se borra el `server.js` de la primera versión, reglas ESLint más estrictas, refactorización y saneado de código.
- Las preguntas generadas por IA se muestran en otro orden (cambio estético).

### 3.7.7 — 2026-10-27 · `v3.7.7`
- **Corrección (IA):** las preguntas de tipo «Emparejar» no se generaban correctamente.

### 3.7.6 — 2026-10-27 · `v3.7.6`
- **Generador IA:** pantalla de espera animada. Se arregla la cancelación en `/generate`.

### 3.7.5 — 2026-10-26 · `v3.7.5`
- **Presentador:** el menú ⋯ y «Anterior» van en una fila con la misma altura y colores comunes («Siguiente» en blanco como acción principal). En el móvil, «Abandonar» ya no se sale del menú.

### 3.7.4 — 2026-10-25 · `v3.7.4`
- **Presentador:** los botones de control se escalan según la altura de la pantalla.

### 3.7.3 — 2026-10-25 · `v3.7.3`
- **Corrección (Trivial):** al terminar un Trivial se cierra la sesión del todo, para que «Volver» desde el podio no desconecte al presentador ni provoque «Error de conexión» en la siguiente partida.
- **Presentador:** el PIN se lee bien en el mensaje «PIN no válido». Nuevos tests de reconexión tras el fin de partida.

### 3.7.2 — 2026-10-25 · `v3.7.2`
- **Bancos:** aviso antes de borrar preguntas que usan los juegos personalizados (borrar igualmente / no borrar).

### 3.7.1 — 2026-10-25 · `v3.7.1`
- **Corrección:** al guardar un juego personalizado se descartan las preguntas borradas del banco, en lugar de romper la clave foránea.

### 3.7.0 — 2026-10-25 · `v3.7.0`
- **Imágenes en las diapositivas libres:** la importación descarga las URL y lee `data:`. La IA usa imágenes adjuntas, URL y fotos de Wikimedia Commons.
- **Mascota:** el camaleón se dibuja en proporción a la pantalla en la portada y en el presentador.
- **Editor de diapositivas:** se elimina la zona «SAVE», que estaba mal situada.

---

## 3.0 – 3.6

### 3.6.0 — 2026-10-24 · `v3.6.0`
- **Juegos personalizados: navegar adelante y atrás.** Botón «Anterior» y tecla ← en el presentador, el mando y la TV. Lo ya mostrado se revisa sin volver a jugarse: votos, solución, justificación y ranking actual. Cada jugador ve su resultado (o el de su equipo).

### 3.5.0 — 2026-10-24 · `v3.5.0`
- **Podio 3D**, que se activa o desactiva desde el panel de administración.
- **Trivial (jugador):** el dado pasa a la cabecera tras tirar y las casillas caben sin scroll (hasta 7 en un iPhone SE).
- **Trivial:** contorno negro en las letras de las casillas alcanzables, para leerlas sobre fondos claros.

### 3.4.0 — 2026-10-23 · `v3.4.0`
- **Diapositivas personalizadas con IA:** generación de diapositivas libres (texto, diagramas, rejillas, preguntas, iconos) mediante inteligencia artificial.

### 3.3.0 — 2026-10-23 · `v3.3.0`
- **Diapositivas libres portables (`.xiroslide`):** exportar e importar entre instalaciones (JSON con las imágenes en base64) y biblioteca de diapositivas. Los SVG con scripts o enlaces externos se rechazan.
- **Admin:** Configuración → Servidor pasa a navegación vertical, agrupada en cuatro bloques (Juego, Pantalla y sonido, Conexiones, Sistema), accesible por teclado.
- **Corrección (caché):** `pinCache` y `questionBankCache` se invalidan en todos los workers a través de Redis. El botón «limpiar caché» vacía todos los workers.
- **Base de datos:** mejoras y optimización de la conexión.

### 3.2.0 — 2026-10-21 · `v3.2.0`
- **Nuevo tipo de pregunta: Encuesta de selección múltiple**, con porcentajes por opción. También disponible en el generador IA.

### 3.1.1 — 2026-10-20 · `v3.1.1`
- **Admin:** encabezado más compacto y botones de radio para elegir el tipo de pregunta.

### 3.1.0 — 2026-10-20 · `v3.1.0`
- **Diapositiva libre:** el editor adopta un aspecto de consola clara y todos sus textos pasan a i18n (10 idiomas).

### 3.0.0 — 2026-10-20 · `v3.0.0`
- **Nueva diapositiva libre (`canvas`):** lienzo 16:9 con texto, figuras, imagen y vídeo.
  - Editor visual: mover, redimensionar, girar, orden de capas, deshacer y rehacer, barra de formato de texto (8 fuentes) y doble clic para editar.
  - Se reproduce igual en el presentador, la TV, el jugador, el modo sin presentador y el PDF. El vídeo solo se reproduce en el presentador y la TV.
  - Los tipos antiguos (información, texto, imagen, texto + imagen, vídeo) siguen funcionando y se pueden convertir sin pérdida.
- **Corrección (admin):** cambiar de idioma con un editor abierto ya no lo cierra ni pierde los cambios.

---

## 2.3 – 2.8

### 2.8.0 — 2026-10-18 · `v2.8.0`
- **Diapositiva de vídeo** (YouTube, Vimeo, Dailymotion o archivo propio), que solo se reproduce en el presentador y se precarga.

### 2.7.0 — 2026-10-18 · `v2.7.0`
- **Sistema de actualización automática** (contenedor `updater` y aviso o panel de actualización en el admin).
- **Corrección (sopa de letras):** ya no se acepta una palabra contenida dentro de otra. El tablero es opaco en el jugador y en standalone.

### 2.6.5 — 2026-10-18 · `v2.6.5`
- **Licencias:** los fallos transitorios de la validación remota ya no se guardan en caché 24 h.

### 2.6.4 — 2026-10-17 · `v2.6.4`
- **Pie de diapositiva opcional** (hasta 300 caracteres) en las diapositivas Actividad, Info, Texto, Imagen y Texto+Imagen. Se ve en el presentador, el jugador, la TV, standalone y el PDF.
- **Corrección:** las imágenes pequeñas de las diapositivas se amplían al espacio disponible en el presentador y en standalone.

### 2.6.3 — 2026-10-17 · `v2.6.3`
- **i18n:** al jugador se le pide un apodo en lugar de su nombre.

### 2.6.2 — 2026-10-17 · `v2.6.2`
- **Conversión a Markdown para la generación con IA:** conversor propio para PDF, DOCX, ODT, ODP, PPTX, EPUB, RTF, HTML, MD y TXT, que elimina cabeceras, pies, índices, notas y bibliografía. El documento se trocea por secciones entre lotes (`AI_CHUNK_CHARS`), lo que reduce en torno a un 72 % el texto enviado a la IA.
- **Correcciones:** las rachas de la simulación de puntuación máxima dejan de registrarse en el log, y se ignora el aviso de «finalizado» en sesiones ya terminadas.

### 2.6.1 — 2026-10-16 · `v2.6.1`
- **Música:** cambios en la interfaz musical.

### 2.6.0 — 2026-10-13 · `v2.6.0`
- **Nuevo tipo de pregunta: Completa la frase / Rellena los huecos.** De 1 a 3 huecos por frase, puntuación por palabra acertada más un bonus de tiempo, hasta 3 pistas por hueco y modo equipos. Disponible en todas las vistas, el PDF, la importación/exportación JSON, la IA, el Trivial y los bots.
- **Generador IA:** soporte para Sopa de letras y Emparejar.

### 2.5.1 — 2026-10-11 · `v2.5.1`
- **Presentador:** el menú queda siempre por encima de la mascota.
- **Jugador (sopa de letras):** pistas en un máximo de dos filas y enunciado y botón más compactos, con celdas más grandes en el móvil.

### 2.5.0 — 2026-10-11
- **Música reactiva configurable:** sistema completo de música que reacciona a la partida, configurable desde el admin.
- **Admin:** se evitan los falsos avisos de «cambios sin guardar».

### 2.4.1 — 2026-10-10 · `v2.4.1`
- **Intro animada antes de cada partida:** cortinilla, logo letra a letra y cuenta atrás 3-2-1-0 en el presentador, la TV y los móviles, con sonido en el presentador. Versión simplificada para TV antiguas (webOS 3.5). No resta bonus de tiempo y se puede desactivar en Admin → Interfaz.
- **Logo** redibujado, con la R mayúscula del mismo grosor que la X.

### 2.4.0 — 2026-10-10 · `v2.4.0`
- **Nuevo tipo de pregunta: Sopa de letras / Encuentra las palabras.**
- **Nuevas imágenes de la mascota.**
- **Instalación:** los datos de la IA persisten entre reinicios.

### 2.3.0 — 2026-10-09 · `v2.3.0`
- **Presentador:** nueva visualización de las preguntas de tipo «Emparejar».

---

## 2.1 – 2.2

### 2.2.11 — 2026-10-09 · `v2.2.11`
- **IA: Ollama como tercer proveedor** (servidor local u Ollama Cloud), con URL, API key opcional y modelos instalados desde el panel. El proveedor de respaldo es el siguiente que esté configurado.
- **Barra de guardado común** en las 10 pestañas de Configuración y en los editores de bancos, mezclas, personalizados y Trivial: «Todo guardado» / «Cambios sin guardar», «Descartar» y «Guardar». Avisa si se cambia de pestaña o se sale con cambios pendientes.
- **Admin:** los toggle switches neón se sustituyen por un checkbox animado.
- **Mando a distancia:** la partida se elige por `session_id` en lugar de por PIN, para no controlar la partida equivocada cuando dos lobbies comparten PIN.
- **Correcciones:** el presentador remoto podía iniciar una partida sin jugadores; fallaba el botón de volver del visor de resultados.
- La tarjeta standalone cambia de posición en la portada.

### 2.2.10 — 2026-10-08 · `v2.2.10`
- **Despliegue:** se fija `CHROME_WS_ENDPOINT` en `docker-compose.deploy.yml`.

### 2.2.9 — 2026-10-07 · `v2.2.9`
- **Jugador:** todas las opciones de una pregunta usan la misma caja (mayúsculas o minúsculas).

### 2.2.8 — 2026-10-06 · `v2.2.8`
- **Prompts:** las numéricas piden respuesta entera y tolerancias mayores que 0, y los anagramas tienen de 7 a 10 letras (antes la subida fallaba con decimales).
- El prompt de subida usa por defecto el tipo `quiz` en lugar de `multiple`.
- Se borran del repositorio los ficheros `.json` de datos de bancos de preguntas.

### 2.2.7 — 2026-10-06 · `v2.2.7`
- **IA:** las preguntas se generan en el idioma del banco, con prompts más claros (tolerancia híbrida explicada y documento antes de las instrucciones).

### 2.2.6 — 2026-10-05 · `v2.2.6`
- **IA: Gemini como segundo proveedor**, elegible desde el panel, con respaldo automático (si un lote falla o devuelve un 429, se repite con el otro proveedor). `docs/AI_SETUP.md` sustituye a `GROQ_SETUP.md`.
- **Corrección (IA, numéricas):** `maxPoints` deja de ser obligatorio y se respeta una tolerancia de 0.

### 2.2.5 — 2026-10-05 · `v2.2.5`
- **Jugador (numérica):** el ejemplo del campo («Ej: 123456») es más pequeño para que quepa en el móvil.

### 2.2.4 — 2026-10-05 · `v2.2.4`
- **Versión visible:** el pie de las páginas muestra la versión en ejecución (endpoint `GET /api/version`).

### 2.2.3 — 2026-10-05 · `v2.2.3`
- **Contacto:** se registra cada envío del formulario de contacto (identificador y respuesta del servidor SMTP) para poder rastrear correos que no llegan.

### 2.2.2 — 2026-10-05 · `v2.2.2`
- **Admin (configuración):** al volver a una pestaña tras guardar se ve el valor nuevo, no el anterior.

### 2.2.1 — 2026-10-05 · `v2.2.1`
- **Configuración:** si no se puede escribir `runtime-overrides.json` (típico en Docker por permisos), el panel muestra el error y revierte el cambio, en vez de decir «guardado» y perderlo al recargar.

### 2.2.0 — 2026-10-04 · `v2.2.0`
- **Nueva página de Inicio en el admin:** partidas en curso, últimas partidas y estado de la licencia.
- **Equipos:** la puntuación de equipo es la media de sus jugadores, ajustada cuando los equipos tienen distinto tamaño. Sincronización de miembros entre workers.
- **Inicio de partida:** errores claros (PIN no válido, partida ya en marcha, sin jugadores, equipo vacío, juego sin preguntas).
- **Lobby:** indicaciones para entrar sin escanear el QR.
- **Historial:** confirmación escribiendo «BORRAR» para eliminar partidas.
- Nuevas ilustraciones de la mascota para cada modo de juego y páginas de error rediseñadas.

### 2.1.8 — 2026-10-03 · `v2.1.8`
- **Reconexión del presentador configurable** (`PRESENTER_RECONNECTION_TIMEOUT`): minutos que se mantiene la partida si se desconecta la pantalla del presentador.
- **Jugador:** aviso «Respuesta no aceptada» cuando el juego ya no admite respuestas.
- **TV:** filtro y tipo «Juegos Trivial» en el lobby.
- **Visor de resultados:** columna de equipo y panel de miembros y aciertos.
- Se elimina el Tailwind de la raíz del proyecto y se reorganiza la guía CSS (`docs/CSS_GUIDE.md`). Ajustes en timers, equipos y sincronización por Redis.

### 2.1.7 — 2026-09-30 · `v2.1.7`
- **Buscador de juegos por PIN o título** (mínimo 3 caracteres) en los lobbies del presentador, standalone y TV.

### 2.1.6 — 2026-09-30
- README más legible.

### 2.1.5 — 2026-09-29
- **Documentación de despliegue con imágenes publicadas:** dos formas de instalar (`docker-compose.deploy.yml` con Caddy, o desde el código fuente).
- Los scripts de gestión leen el puerto de Postgres de `.env` y el despliegue conserva la API key de Groq entre actualizaciones.
- Instrucciones mejoradas.

### 2.1.4 — 2026-09-29
- **Bots:** líder humano en el sistema de bots («Xiro»).
- Las instalaciones pasan a estar licenciadas por defecto.

### 2.1.3 — 2026-09-28
- **Presentador:** se avanza de diapositiva con la flecha y con Intro.

### 2.1.2 — 2026-09-28
- **Corrección:** el parámetro `teams` se codificaba dos veces en la URL del presentador.

### 2.1.1 — 2026-09-27 (commit «Versión 2.1.0»)
Gran versión de calidad, seguridad y refactorización:
- **Seguridad:** escapado de los textos de usuario en el admin, el presentador, el jugador, la TV y standalone. Protección contra inyección en CSV (fórmulas), PDF (*path traversal*) y SQL.
- **Refactorización:** el revelado de la TV y del presentador, los editores del admin, la exportación de resultados, los handlers de socket y el Trivial de la TV se dividen en módulos. ESLint queda sin avisos.
- **Nueva función:** el jugador ve el desglose de «Emparejar» y la respuesta correcta de cada tipo al revelar.
- **Correcciones:**
  - «Tiempo agotado» tapaba la respuesta correcta.
  - El jugador reenviaba el orden o emparejamiento de la pregunta anterior.
  - Las respuestas de ordenar o emparejar se rechazaban tras pausar el tiempo.
  - El mando revelaba la pregunta siguiente antes de mostrarse.
  - Anagrama con imagen, reconexión y botones Finalizar/Abortar del Trivial en la TV.
  - Modales de la TV en blanco.
  - No se podía guardar la configuración de Groq en Docker.
  - Los módulos JS se cargaban dos veces.
  - No se pueden eliminar desde el admin archivos que están en uso.
- Prompt para crear el `.json` de preguntas traducido (i18n) y mejorado.

---

## 2.0.x

### 2.0.8 — 2026-09-23
- **Visor de resultados:** desglose de las preguntas de cada jugador.

### 2.0.7 — 2026-09-23
- **Corrección:** problemas de hash de assets con el middleware.

### 2.0.6 — 2026-09-22
- Nueva presentación de los puntos aleatorios e instrucciones para crear el `.json`.
- **Corrección:** cálculo del hash de assets.

### 2.0.4 — 2026-09-22
- **Admin:** cambios en el panel y **recarga automática de assets** (versionado).
- **Corrección:** el dado del jugador siempre aparece centrado.
- Se borran archivos NFS.

### 2.0.2 — 2026-09-21
- **Partidas con puntuación aleatoria:** nuevo modo en el que cada pregunta puede valer una cantidad de puntos aleatoria.
- Cambios estéticos en el panel de administración de juegos. Nuevo texto en las preguntas tipo quiz. Funciones simplificadas.

---

## 1.1 – 1.4

### 1.4.7 — 2026-09-18
- **Admin:** botones para mostrar u ocultar todos los juegos a la vez.

### 1.4.5 — 2026-09-18
- **Correcciones:** mejoras y arreglos en el sistema de reconexión.

### 1.4.3 — 2026-09-18
- **Corrección:** se podía iniciar una partida por equipos con equipos sin jugadores.
- Mejoras de seguridad. `.dockerignore` versionado para que no entren en la imagen Docker archivos internos que no deben publicarse.
- Pequeñas mejoras y errores corregidos.

### 1.4.1 — 2026-09-17
- **Personalización:** subir y borrar logos de terceros.

### 1.4.0 — 2026-09-17
- **Corrección:** el jugador no veía bien la respuesta correcta en las preguntas de respuesta múltiple.

### 1.3.4 — 2026-09-13
- **Admin:** mejor visualización en dispositivos móviles.

### 1.3.3 — 2026-08-29
- **Logo personalizado y personalización de la interfaz.**
- **Corrección:** error al crear el toggle switch.

### 1.3.2 — 2026-08-28
- Traducciones completas de «Editar y crear Trivia».
- **Corrección:** error al importar bancos con `language`.

### 1.3.0 — 2026-08-28
- **Imagen en las tarjetas de los juegos.**

### 1.2.8 — 2026-08-28
- **Idioma de los juegos:** cada juego tiene un idioma asignado.

### 1.2.7 — 2026-08-28
- **Interruptor del fondo animado** y nuevos estilos de toggle switch. Ajustes en la animación del fondo.

### 1.2.6 — 2026-08-27
- **Login:** mostrar u ocultar la contraseña. Mejoras en las hojas de palmera del fondo.

### 1.2.5 — 2026-08-26
- Animaciones del fondo mejoradas.

### 1.2.4 — 2026-08-26
- **Nuevos bancos de preguntas de ejemplo** («El rey pescador», «Tomates verdes fritos»).
- **Fondo animado:** hojas que se mueven.
- Auditoría visual de las páginas estáticas.

### 1.2.3 — 2026-08-24
- **Standalone:** puntuación máxima obtenida y nuevo logo «Xiro Standalone».
- Cambios visuales en el panel de administración.

### 1.2.1 — 2026-08-23
- **Tarjeta de TV** que se puede mostrar solo en dispositivos antiguos.
- Mejoras visuales.

### 1.2.0 — 2026-08-22
- **Mejoras visuales y coherencia entre páginas.**
- **Standalone:** se pide el nombre en el modo en solitario.

### 1.1.5 — 2026-08-10
- **Corrección:** tiempo de partida en las estadísticas del juego. Mejoras en el modo standalone.

### 1.1.4 — 2026-08-05
- Las tarjetas de los juegos muestran el número correcto de preguntas.

### 1.1.2 — 2026-08-03
- Cambios en la estética de `standalone.html`.

### 1.1.1 — 2026-07-19
- Mejoras en la documentación del administrador.

### 1.1.0 — 2026-07-19
- **Licencia ligada a una sola máquina:** huella de instancia, *lease* y validación remota de la licencia.

---

## 1.0.x

### 1.0.24 — 2026-07-13
- Imagen Docker actualizada.

### 1.0.23 — 2026-07-13
- **Mezcla de preguntas:** cambios en el modo que combina preguntas de varios bancos.

### 1.0.22 — 2026-07-11
- Node actualizado. Nueva presentación de los nombres de jugadores en el lobby. Documentación actualizada.

### 1.0.20 — 2026-07-10
- Mejoras en el sistema standalone. La portada (`index.html`) pasa a 5 tarjetas.

### 1.0.18 — 2026-07-09
- **Modo standalone:** jugar sin presentador.

### 1.0.17 — 2026-07-08
- Traducciones mejoradas en el sistema i18n.

### 1.0.16 — 2026-07-08
- **Corrección:** las contraseñas no se guardaban en `runtime-overrides.json`. Imagen actualizada.

### 1.0.15 — 2026-07-08
- **Sistema de pago por uso** (licencias por usuario y control de capacidad de las sesiones).
- **Recuperación de contraseñas.**

### 1.0.14 — 2026-07-06
- **Corrección:** botones de la vista de TV.

### 1.0.13 — 2026-07-05
- Aviso cuando se hace una instalación nueva de XiRo.

### 1.0.12 — 2026-07-05
- Paquete Docker actualizado. Corrección de un icono.

### 1.0.11 — 2026-07-04
- `tv.html` no cargaba con el sistema i18n; se desactiva de momento en esa vista.

### 1.0.10 — 2026-07-04
- **Nuevo banco de preguntas de ejemplo:** juego de Montilla.
- `docker-compose.deploy.yml` para desplegar en un servidor externo y cambios en la imagen pública de Docker Hub.
- **Correcciones:** problemas de conexión; las tarjetas de respuesta de selección múltiple no se veían bien en el jugador.

### 1.0.8 — 2026-06-27
- **Correcciones (Emparejar):** las preguntas no eran responsivas en el jugador y fallaba la reconexión del jugador.
- Imagen Docker actualizada.

### 1.0.7 — 2026-06-27
- Versión del contenedor Docker actualizada.

### 1.0.0 – 1.0.6 — 2026-06-25 / 2026-06-26
Primera versión pública de XiRo! (el número osciló entre 1.0.0, 1.0.5, 1.0.2 y 1.0.6 mientras se ajustaba la imagen Docker).
- **Commit inicial:** plataforma autoalojada de quiz en tiempo real.
  - Socket.IO con varios workers (adaptador Redis y PM2 en clúster), PostgreSQL y Redis.
  - 6 tipos de pregunta y 4 modos de juego: Banco de preguntas, Mezcla, Personalizado y Trivial.
  - Modo equipos, rachas con bonus progresivo y reconexión transparente de jugadores y presentador.
  - Vistas de presentador, jugador y TV, y mando a distancia desde el móvil.
  - Generador de preguntas con IA (Groq), exportación a PDF (Puppeteer + Chromium) e importación/exportación JSON de bancos.
  - Panel de administración con cuentas admin/editor, interfaz multilingüe (ES/EN), complemento para PowerPoint, copias de seguridad y restauración.
- **Corrección:** el tiempo de expiración estaba fijo en el código y el panel de control no tenía efecto.
- **Docker:** Chromium pasa a un contenedor aparte, imagen reducida y optimizada, y se corrige un error que impedía por completo el despliegue en Docker (1.0.6).
