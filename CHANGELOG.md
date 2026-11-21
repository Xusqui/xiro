# Historial de versiones de XiRo!

## 3.14.x

### 3.14.16 — 2026-11-21 · `v3.14.16`
- **Actualizador:** acepta una versión igual o posterior a la pedida
  - waitForBackend exigía la versión exacta y, si :latest había avanzado mientras tanto, esperaba hasta agotar el tiempo y acababa en rollback con la versión nueva funcionando. isAtLeast en updater/version.js; backendReady la usa.

### 3.14.14 — 2026-11-21 · `v3.14.14`
- Secretos generados en el primer arranque (volumen xiro_secrets)
  - Servicio secrets que crea DB_PASSWORD, REDIS_PASSWORD, JWT_SECRET y UPDATER_TOKEN con app/scripts/generate-secrets.js. Adopta los valores del .env existente y nunca rota. Postgres, Redis, backend, backup y updater los leen con *_FILE. ecosystem.config.js carga config/env.js antes de copiar los secretos a PM2. UPDATER_TOKEN_FILE en env.js. README, .env.example y docs/SECRETS.md actualizados.

### 3.14.13 — 2026-11-21 · `v3.14.13`
- **Bug:** Faltaba una clave en todos los idiomas salvo en Español: admin.login.error_rate_limit_15m

### 3.14.12 — 2026-11-21 · `v3.14.12`
- Temporizador del jugador sincronizado con el presentador, chincheta SVG y envío automático en «Toca la imagen»
  - Temporizador informativo en el móvil: píldora con anillo a la izquierda de la barra del apodo (la derecha es del logo personalizado), solo en pantallas de pregunta y oculta al responder. El presentador es la fuente de verdad: publica «muestro N desde el instante T» en hora del servidor (presenter-timer-sync) al empezar, cada 5 s, al pausar y al reanudar; presentador y móvil miden su desfase con clock-sync. El servidor valida la marca (solo el presentador, Joi, pregunta actual, límite por socket) y la reenvía como timer-sync. No decide el cierre de la pregunta. Docs en docs/PLAYER_TIMER.md; etiqueta accesible en los 10 idiomas.
  - «Toca la imagen»: el toque propio es una chincheta roja en SVG (images/hotspot-pin.svg) con la punta en el punto tocado. Al agotarse el tiempo se envía la chincheta puesta, en partida (blocked-answer + lateAnswer en el servidor) y en solitario (temporizador local).
  - Solitario: muestra la intro de partida (logo y cuenta atrás) en lugar de «Preparando tu partida».

### 3.14.11 — 2026-11-20 · `v3.14.11`
- **Editor:** usar una imagen o un audio por ruta o URL, sin subirlo otra vez
  - Junto a cada botón de subir (Toca la imagen, contenido multimedia, imagen del
  - enunciado, opciones y portadas) hay un campo «ruta o URL».
  - Una ruta de /uploads se usa tal cual si el fichero existe y su contenido es del tipo y tamaño que admite ese sitio. Así el mismo mapa sirve para muchas preguntas.
  - Una URL de otra web se descarga una vez (solo IP públicas, plazo y tamaño máximo) y se guarda con el hash del contenido como nombre, porque la CSP solo enseña imágenes del propio servidor.
  - Nunca SVG. El audio se reconoce por sus bytes (MP3, WAV, OGG, WebM).
  - Textos en los 10 idiomas.
- Arrastrar y soltar en todas las subidas del admin
  - Nuevo helper attachFileDrop (con modo delegado por selector para bloques
  - repintados con innerHTML), forwardDropToInput y setInputFiles en
  - drag-drop-upload.js. Ahora también se puede soltar el archivo en: portada
  - del juego, imagen del enunciado, imagen de opción, documento e imágenes del
  - diálogo de IA de diapositivas, imagen de diapositiva libre e importar
  - .xiroslide (selector y biblioteca). Respeta el accept de cada selector.
  - La imagen del enunciado y la portada enseñan una zona visible de arrastrar
  - (la misma .drop-zone.xq-dropzone del contenido multimedia) y bajo las
  - opciones hay una línea de ayuda nueva (admin.q.option_image_drop, en los
  - 10 idiomas).
- **Bug admin:** Sin salto de scroll en Safari, fondo de selva y CSP sin unsafe-inline en scripts
  - Al repintar una tarjeta se conserva su altura hasta que los campos se reajustan: Safari (sin field-sizing) acortaba el documento y recortaba el scroll. La lista de preguntas lleva una banda de selva con las palmeras de la portada y la pregunta abierte, borde de su tipo y una palmera lima como separador. scriptSrc ya no adminte unsafe-inline: los scripts inline van por hash.

### 3.14.10 — 2026-11-20 · `v3.14.10`
- **Bug «Toca la imagen»:** área desplazada y salto de scroll en el editor
  - El área se guardaba desplazada a la izquierda: la sección del editor es una rejilla y estiraba el recuadro de la imagen más allá de la imagen (en pantallas anchas), y los clics se medían sobre el recuadro. Ahora se miden sobre la imagen y el recuadro no se estira (justify-self: start), así que lo dibujado coincide con lo que se ve en la partida.
  - Cada vértice repintaba la tarjeta entera; la imagen se recargaba y la página subía arriba del todo. Ahora solo se actualizan el dibujo, el contador y los botones.

### 3.14.9 — 2026-11-20 · `v3.14.9`
- Registro central de tipos de pregunta y tests de contrato
  - Catálogo único de tipos (public/js/core/question-types.js): encuesta, puntos aleatorios, Trivial, forma de la respuesta, campo de detalle y solución.
  - Servidor: manejadores por tipo (application/question-types/) para validar, evaluar, plazo tras el cierre y rachas; el flujo submit-answer deja de usar banderas is*Question y pregunta al manejador.
  - Dominio: QuestionSolution (texto de la solución) y PlayerResultDetails (detalle en answer-result), antes duplicados en varios sitios.
  - Revelado: RevealPresenterPayload y RevealTypePayloads por tipo de solución y mapa por tipo.
  - Trivial: preparación de la pregunta compartida (TrivialQuestionNormalizer).
  - Clientes: despachador de pantallas del jugador y mapa del modo standalone.
  - IA: prompts por tipo en ai-generator/prompt-builders.js.
  - Eliminada la constante QUESTION_TYPES de game-constants (errónea y sin uso).
  - answerIndex es null en todos los tipos que no responden con una opción; la reserva de equipos envía también multipleChoiceDetails.
- Nuevo tipo de pregunta «Toca la imagen» (hotspot)
  - El jugador toca la imagen principal de la pregunta y puntúa por cercanía a un
  - área poligonal marcada por el creador: dentro, puntos máximos + 20 de bonus;
  - fuera, caída lineal hasta 0 en el margen (5 % del ancho por defecto).
  - Catálogo, migración (hotspot_area, hotspot_tolerance, image_credit), Joi y servicios de BD; puntuación, rachas, archivo, revelado con toques en Redis.
  - Editor del admin: dibujo del polígono, puntos, margen y crédito; JSON de bancos con la imagen incrustada (POST /api/upload/embedded-image, bytes comprobados); banco sin área se abre en el editor.
  - IA: enunciado + búsqueda; imagen de Wikimedia Commons (mapas y diagramas).
  - Móvil, modo individual, presentador y TV (núcleo compartido hotspot-view); PDF, visor de resultados, manual del jugador, bots y textos en 10 idiomas.

### 3.14.8 — 2026-11-18 · `v3.14.8`
- **Bug:** Al iniciar una partida en el modo TV, se quedaba colgado porque requestFullscreen() devuelve undefined en navegadores de TV antiguos. Ahora Pantalla completa y audio van en try/catch.

### 3.14.7 — 2026-11-18 · `v3.14.7`
- Instrucciones howto animadas y con voz para los 10 tipos de pregunta
  - Añade las instrucciones animadas (howto) de quiz, word_search, multiple_choice, order, matching, numeric_approximation, word_scramble, fill_blanks, survey y survey_multiple, con locución en 10 idiomas (8 clips por tema e idioma) y efectos de sonido, incluida una fanfarria al inicio. Los clips se regeneran con una frase de relleno que se recorta para que no se pierda la última sílaba, y se validan por transcripción. Reescribe los textos de Sopa de letras. En order, la locución termina en la primera frase del cierre. El audio espera a que el AudioContext esté activo antes de arrancar la animación.

### 3.14.6-a — 2026-11-16 · `v3.14.6a`
- **Portada:** tarjetas Standalone y TV ocultas hasta que los ajustes las muestran
  - Nacen con [hidden] e index-init.js las muestra según /api/ui-settings,
  - en vez de pintarse y ocultarse después (evita el parpadeo al cargar).
  - La rejilla cuenta las visibles con [hidden] en lugar de [style*=none].

### 3.14.6 — 2026-11-15 · `v3.14.6`
- **Diapositivas libres:** Gráficos vinculados a tablas
  - Nuevo elemento gráfico (columnas, barras, líneas, área, sectores, anillo y apilados) que lee sus datos de una tabla de la misma diapositiva, que puede estar oculta. Se pinta en SVG con el mismo código en editor, presentador, TV, móviles y PDF. El formato .xiroslide pasa a la versión 6 y el servidor rechaza gráficos que apunten a una tabla que no existe.
  - Al copiar un gráfico viaja su tabla; al pegar o duplicar, las copias se reenlazan con la tabla copiada o se quedan sin vínculo. Borrar una tabla que alimenta gráficos pide confirmación (en los 10 idiomas) y se deshace en un paso. A los móviles no llegan los elementos ocultos, salvo las tablas que alimentan un gráfico visible.
- **Diapositivas libres:** Gráficos en el editor, «Sin datos» traducido y diseños de IA tabla y gráfico
  - Editor: panel del gráfico, botón «Gráfico», crear desde tabla, editar datos y ocultar tabla
  - Pulido de diseño: tipo sin etiqueta duplicada, borde interior en segmentos pulsados, miniatura de sectores
  - «Sin datos» traducido en móvil (y su zoom), presentador, TV, standalone y PDF, con claves en 10 idiomas
  - IA: diseños «tabla» y «gráfico» (el gráfico sale con su tabla de datos oculta vinculada)
- **Diapositivas libres:** temas y patrones (fase F)
  - Modelo: role en los elementos y layout en el lienzo; .xiroslide formatVersion 7
  - 10 temas de serie con contraste y daltonismo validados; applyTheme y 6 patrones maestros
  - Servidor: temas propios (canvas_slide_themes) y slide_theme en los juegos personalizados
  - Editor: tarjeta y diálogo «Tema» con vista previa real, Aplicar a todo el juego y Deshacer
  - Botones .xsce-btn desactivados con la opacidad común del editor
  - Textos en 10 idiomas
- **Diapositivas libres:** temas por diapositiva, legibilidad, IA con roles y tema (fase F)
  - Cambio de tema legible: lo que no tiene rol se ajusta si deja de leerse (4.5:1; líneas 3:1)
  - Tema dentro de la diapositiva (panel, un paso de deshacer) y del juego en la barra «Añadir contenido»
  - Diálogo con título propio por alcance, rótulo de qué tema se muestra y botón desactivado coherente
  - IA: roles y patrón en lo que genera, y el tema del juego sobre lo generado
  - Textos del tema en 10 idiomas
- Mezclar bancos pasa a llamarse Fusionar bancos
- Skill /xiro de Claude Code en el repo, con instalador y documentación
  - skills/xiro: copia canónica de la skill que genera .xiroslide
  - skills/install.sh: instala en ~/.claude/skills/xiro (copia, --link, --check)
  - docs/XIRO_SKILL.md: instalar, usar y mantener al día
  - . gitignore: excepción para el joi vendorizado de la skill
  - Esta Skill sirve para crear diapositivas en formato .xiroslide para importar a un juego personalizado de Xiro.

### 3.14.5-b — 2026-11-14 · `v3.14.5b`
- **Diapositivas libres:** Tab y niveles en listas, numeración multinivel y pegar con formato
- **Administración:** PANIC espera a que el servidor vuelva y muestra el tiempo transcurrido
- **Diapositivas libres:** Revisar la barra de formato del texto
  - Al escribir, la barra muestra el formato de la selección, con estado mixto si solo una parte lo tiene. Queda en una fila desde 1280 px, con el espaciado en un panel y los tipos de numeración en un menú. Resaltado sin amarillo falso, rotulador con el último color y botón «Sin resaltado». Pulsado y desactivado más claros, aviso visible sin texto seleccionado. Las barras se recorren con flechas como barra de herramientas, con foco visible, «px» en el tamaño y muestras de 32 px.

### 3.14.5-a — 2026-11-14 · `v3.14.5a`
- Borrar complemento desfasado de Chrome
- **Logs:** Registrar los 4xx como warn de una línea en vez de error con traza
  - Los rechazos esperados (401 sin token, 403, 404, validación) salían como
  - «Error no capturado» con la traza completa y sin la ruta pedida, y parecían
  - averías. Ahora son un warn con método, ruta (sin query string) y code.
  - Los 5xx y los errores de PostgreSQL siguen como error con traza.
- **Resultados:** Mostrar en el visor el porcentaje de votos de cada respuesta
  - Cada pregunta del visor muestra un bloque «Votos por respuesta» con el porcentaje y los votos de cada respuesta elegida. En selección múltiple cuenta cada opción marcada. No sale en ordenar, parejas, sopa de letras ni completa la frase.
  - Las encuestas ya no salen como falladas: en vez de «0%» en rojo y «Aciertos 0/N» llevan la etiqueta «Encuesta», y no cuentan en el % de aciertos.
  - Actualiza el hash CSP del script inline de xiro-results-viewer.html.
- **Diapositivas libres:** editor ampliado y texto tipo Word
  - Fases A-D del plan del editor: estilo y sombra configurables, formas libres, alineación y selección múltiple, tablas que se escriben en el lienzo, visor del móvil en horizontal y diálogo de imagen o vídeo con la dirección actual.
  - Texto tipo Word (C1-C2): fuente y tamaño por palabra, tachado, superíndice y subíndice, resaltado, alineación por párrafo (también justificada), cuatro tipos de lista con sangría, interlineado, espacio antes y después y estilos de párrafo. Formato .xiroslide 5 con párrafos, validado con Joi (CanvasTextSchema). Barra de formato dividida en marcado, acciones y estado; el panel derecho solo conserva lo del cuadro.
  - Formato del generador IA (prompt.js, prompt-builder.js) según el formateador.

### 3.14.4 — 2026-11-12 · `v3.14.4`
- **Visual:** Poner la animación de XiRo en todas las páginas dentro de public/legal/

### 3.14.3 — 2026-11-11 · `v3.14.3`
- **AI:** Mayor endurecimiento de las reglas de IA para Evitar repetir respuestas además de las preguntas:
  - Los lotes reciben las preguntas y respuestas ya aceptadas (antes se leía question_text en vez de questionText y la lista nunca llegaba al prompt).
  - Nueva sección «Respuestas ya usadas» y regla de respuesta distinta en quiz, multiple_choice, word_scramble y numeric_approximation.
  - El filtro descarta preguntas cuya respuesta correcta equivale a otra ya aceptada (iguales o con todas sus palabras contenidas), aunque el enunciado cambie.
  - Tras una repetida se piden 2 candidatas de más por lote; hasta el triple de lotes previstos, deteniéndose tras 3 lotes extra sin preguntas nuevas.

### 3.14.2 — 2026-11-11 · `v3.14.2`
- **AI:** Prompt para la IA reforzado para cometer menos errores y emitirlo en formado markdown

### 3.14.1 — 2026-11-10 · `v3.14.1`
- Pedir al prompt que genera las preguntas mediante IA, que no repita preguntas

### 3.14.0 — 2026-11-10 · `v3.14.0`
- Editor de preguntas de los bancos: tarjetas plegables, validación por pregunta y paleta de tipos
  - Ninguna pregunta se descarta en silencio al guardar: la validación dice qué pregunta y qué campo fallan, marca la tarjeta, la despliega y lleva el foco al campo, con «Ir a la pregunta N» en la barra de guardado.
  - validateBody añade fields (ruta y mensaje de cada fallo) a la respuesta 400; el editor lo usa para señalar también las preguntas que rechaza el servidor.
  - Tarjeta reordenada: tipo, enunciado, respuestas y «Más opciones» plegable (tiempo, imagen y multimedia). El tipo elegido ocupa una línea con «Cambiar tipo»; «Cómo funciona» va cerrado.
  - Respuesta correcta con un control «Correcta» visible y con texto. «Ordena» en una columna; en selección múltiple, la puntuación va tras las opciones y se ve la justificación.
  - Bancos grandes: tarjetas plegables con resumen, plegar o desplegar todas, subir, bajar y duplicar; «Añadir al principio» inserta arriba; más de 5 preguntas se abren plegadas. Estado vacío con el camaleón.
  - Borrar una pregunta con contenido pide confirmación. El diálogo de confirmación es accesible (alertdialog) y empieza en «Cancelar».
  - Accesibilidad: nombres accesibles en todos los controles, etiquetas asociadas, foco al añadir opciones, imagen de opción alcanzable por teclado, campos de 16 px en móvil.
  - Paleta de tipos única para el selector, el chip, la sección, las etiquetas de los juegos personalizados y el generador IA. La numérica (verde azulado) y Completa la frase (pizarra) dejan los colores de los roles TV y Standalone.
  - Textos del editor traducidos en los 10 idiomas (121 claves nuevas). La lista de bancos muestra cuántas preguntas tiene cada uno.
  - Los cambios dentro de una pregunta repintan solo su tarjeta. Nuevos módulos question-editor-* y bank-question-list / bank-editor-save; nuevas hojas admin-question-editor.css y admin-question-answers.css.

---

## 3.13.x

### 3.13.1 — 2026-11-10 · `v3.13.1`
- **Páginas legales:** lectura, accesibilidad y enlaces según el idioma
  - Los enlaces legales del pie llevan al texto en el idioma de la interfaz: español para es, ca, eu y gl, inglés para el resto, con una nota cuando no coincide (claves common.legal.text_in_english y text_in_spanish en los 10 idiomas).
  - Nuevo css/legal.css: medida de lectura de unos 70 caracteres, índice de documentos en fichas con la actual marcada y objetivos táctiles de 44 px en móvil.
  - Títulos que no se salen de la tarjeta con el texto ampliado al 200 % y anillo de foco del logo visible sobre la jungla.
  - El correo del titular es un enlace mailto (solo si es una dirección válida).
  - El salto al contenido lleva al título. Se retiran el canvas sin uso y los estilos en línea.

### 3.13.0 — 2026-11-09 · `v3.13.0`
- **Legal y accesibilidad:** textos legales, consentimientos y sin recursos de terceros
  - Aviso legal, privacidad, cookies, términos, reembolsos y accesibilidad en español e inglés (/legal/). Los datos del titular se editan en Configuración → Datos legales.
  - Consentimiento en contacto, registro e inicio de sesión, con versión y fecha guardadas (migración 20261109000001).
  - Se retira Umami. Fuentes, iconos y QR se sirven desde el propio servidor. La telemetría pasa a ser opcional.
  - Los vídeos de YouTube, Vimeo y Dailymotion solo cargan tras un toque del presentador.
  - La compra de licencias del panel queda desactivada salvo LICENSE_CHECKOUT_ENABLED=true.
  - La exportación completa de resultados pasa a ser solo para administradores, con un podio público mínimo para el complemento de PowerPoint.
  - Purga diaria de tokens caducados y caducidad de las rachas en Redis.
  - Accesibilidad: texto alternativo, saltos al contenido, etiquetas, contraste y movimiento reducido.
  - Página de créditos, afirmaciones corregidas, modo tablero como Trivial XiRo! y titular de la portada en Poiret One.

---

## 3.12.x

### 3.12.0 — 2026-11-09 · `v3.12.0`
- **Admin:** el panel se puede usar desde el móvil
  - Por debajo de 1024 px la barra lateral pasa a menú deslizante y una barra superior muestra la pantalla actual.
  - La portada muestra primero las partidas en curso, con botón «Controlar», y un atajo lleva a Juegos en curso desde cualquier pantalla (solo administradores).
  - Listas, Configuración, Usuario y editor de preguntas a una columna; el historial pasa a tarjetas en teléfono.
  - Objetivos táctiles de 44 px y campos a 16 px para que iOS no amplíe la página.
  - Repetir la pestaña Preguntas con un editor abierto ya no pierde los cambios sin guardar.
- Dejar de versionar eslint-public-globals.json: es generado y ya estaba en .gitignore

---

## 3.11.x

### 3.11.4 — 2026-11-09 · `v3.11.4`
- **Admin:** buscador por nombre o PIN en bancos, mezclas, personalizados y Trivial

### 3.11.3 — 2026-11-09 · `v3.11.3`
- **Admin:** las fechas siguen el idioma seleccionado
  - «Última comprobación», la caducidad de la licencia y el alta de usuarios ya no salen siempre en formato español.
  - Se sustituye el `es-ES` fijo por el idioma activo del panel.
- **Login:** se puede usar en pantallas bajas y con lector de pantalla
  - La tarjeta se desplaza cuando no cabe: en móvil apaisado o con el teclado abierto no se llegaba al botón.
  - Los errores y avisos se anuncian, los campos tienen nombre y el foco no se pierde al cambiar de formulario.
  - El selector de idioma queda siempre debajo y los envíos repetidos se ignoran.

### 3.11.2 — 2026-11-09 · `v3.11.2`
- **Changelog:** la fecha de cada versión ya no depende del idioma del sistema

### 3.11.1 — 2026-11-09 · `v3.11.1`
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
