# Guía de diseño de diapositivas libres de XiRo

Léela antes de diseñar. Los números salen del render real de XiRo (medidos en Chrome con sus fuentes).

## 0. Dirección de arte: con intención, no por defecto (obligatorio)

Cada encargo merece su propia identidad visual. Lo que sigue manda sobre las recetas y paletas de esta guía: esas son técnicas para usar cuando el contenido las pide, nunca una plantilla.

**Antes de diseñar**, decide y apunta en `_estilo` del spec:
- de qué trata, para quién es, para qué sirve y qué tono pide (fiesta de barrio, clase de historia, gala, concurso infantil, empresa…);
- qué lenguaje visual cuenta mejor esa información;
- una dirección de arte coherente que salga del tema: tipografía, paleta y forma de componer. Dos encargos de temas distintos no deben parecer hechos con la misma plantilla. No fuerces todo a minimalista, editorial, corporativo o futurista.

**Tópicos de diapositiva hecha por IA.** No están prohibidos, pero nunca son el punto de partida; úsalos solo con una razón que salga del contenido:
- fondo crema, beige o hueso con acentos terracota o naranja apagado;
- titular serif enorme de revista con etiquetas diminutas en mayúsculas muy espaciadas;
- rejillas repetidas de tres o cuatro tarjetas redondeadas;
- esquinas redondeadas por todas partes, píldoras y contenedores flotantes;
- degradados violeta-azul genéricos, brillos y formas 3D artificiales;
- cristal esmerilado, neumorfismo y paneles translúcidos sin motivo;
- iconos decorativos dentro de círculos, sobre todo iconografía genérica;
- rayitas, puntitos, barras de acento y adornos geométricos arbitrarios;
- el mismo esquema a dos columnas con imagen a un lado y texto al otro;
- la lista de cinco viñetas de siempre;
- foto de banco de imágenes genérica que no es del tema;
- aspecto de panel de control cuando la información no lo pide;
- mucho espacio vacío para disimular que falta contenido.

**Tipografía.** Elige las fuentes por el tema, el público y el ambiente, con una jerarquía clara. No caigas siempre en la pareja de moda serif + sans. No agrandes titulares si no comunican más. Que se lea muy bien proyectado. La letra nunca es solo adorno.

**Variedad real.** Una serie no es la misma composición con distinto texto. Cada diapositiva tiene la composición que pide su información; combina según haga falta:
- foto a sangre o imagen protagonista;
- frase grande de impacto;
- datos y gráficos, diagramas e ilustraciones conceptuales;
- líneas de tiempo y procesos;
- comparaciones y tablas;
- composiciones asimétricas y texto bien estructurado;
- diapositivas mínimas cuando de verdad ganan.

Ningún elemento está para rellenar hueco. Mantén un sistema coherente (rejilla, paleta, letra), pero sin repetir la misma composición, colocación del título, proporción de imagen, adorno o combinación de colores de una diapositiva a otra.

**Material visual auténtico.** Mejor fotos reales del usuario, ilustraciones propias con sentido, diagramas y referencias que adorno genérico. Nunca inventes fotos, datos, gráficos ni pruebas científicas o clínicas: si el usuario no da los datos, no los dibujes como si fueran reales.

**Color con propósito.** No elijas por inercia beige, terracota, violeta, azul ni pasteles. La paleta sale del tema y sirve para jerarquizar, distinguir categorías, dar significado y dirigir la mirada. Pocos acentos, sin degradados ni efectos de color decorativos.

**El contenido manda.** No sacrifiques claridad, exactitud ni densidad de información por minimalismo. No partas en varias diapositivas información que va junta solo para ganar aire. No conviertas cada idea en tarjeta, icono, infografía o diagrama: usa la solución visual más simple que funcione.

**Revisión final obligatoria**, mirando toda la serie junta en los PNG antes de entregar:
1. ¿Parece una presentación genérica hecha por IA?
2. ¿He caído en tarjetas repetidas?
3. ¿Tiro de paletas y tipografía previsibles de IA?
4. ¿Hay adornos que no aportan nada?
5. ¿Las diapositivas tienen variedad de composición con sentido?
6. ¿La identidad visual encaja de verdad con el tema?
7. ¿Un diseñador de presentaciones con oficio lo vería pensado e intencionado?

Si la serie podría cambiarse por cualquiera de otras cien hechas por IA, rediséñala. No confundas estética de IA con buen diseño.

## 1. Dónde se ven

- **Pantalla grande** (presentador, TV, proyector): se lee desde el fondo de la sala.
- **Móvil del jugador**: la diapositiva entera se encoge a ~380 px de ancho (×0,2). Un texto de 48 px se ve como uno de 10 px. Por eso: letra grande, pocas palabras y mucho contraste.
- Una idea por diapositiva, con títulos breves (unas 8 palabras) y el texto justo. Si lo que va junto no se lee a ×0,2, reorganízalo (tabla, menos palabras, letra mayor) antes de partirlo; partir información que va unida solo para ganar aire está mal (sección 0).

## 2. Lienzo, rejilla y márgenes

- Lienzo de 1920 × 1080 px. Origen arriba a la izquierda.
- Márgenes: 96 px a los lados y 80 px arriba y abajo. La zona útil va de x 96 a 1824 y de y 80 a 1000. Solo la decoración puede salirse.
- Rejilla de 12 columnas de 122 px con 24 px de separación. La columna n (de 0 a 11) empieza en `x = 96 + 146·n`. k columnas miden `146·k − 24`.
  - Mitades: x 96 y 972, w 852.
  - Tercios: x 96, 680 y 1264, w 560.
  - Cuartos: x 96, 534, 972 y 1410, w 414.
- Separaciones en múltiplos de 8: 16 y 24 dentro de un grupo, 48–96 entre bloques.
- **Relleno de las cajas de texto: 16 px por cada lado.** Para que la letra empiece en x = 96, pon la caja en x = 80 y súmale 32 al ancho. Lo mismo arriba: la primera línea empieza 16 px por debajo de `y`.

## 3. Tipografía

### Las 8 fuentes

| `font` | Familia | Carácter | Ancho medio por carácter (minúsculas / MAYÚSCULAS, ×size) | Negrita y cursiva reales | Uso |
|---|---|---|---|---|---|
| `sans` | DM Sans | neutra, moderna | 0,46 / 0,56 (negrita 0,49 / 0,59) | sí / sí | por defecto: cuerpo y títulos sobrios |
| `display` | Bebas Neue | condensada, **solo mayúsculas** | 0,335 | no / no | títulos enormes, cifras, carteles |
| `condensed` | Oswald | condensada fuerte | 0,37 / 0,44 (negrita 0,41 / 0,49) | sí / no | antetítulos, etiquetas, marcadores |
| `rounded` | Nunito | amable, redondeada | 0,45 / 0,59 | sí / sí | público familiar, infantil |
| `serif` | Merriweather | clásica muy legible | 0,48 / 0,62 | sí / sí | textos largos, historia, literatura |
| `elegant` | Playfair Display | elegante, alto contraste | 0,45 / 0,58 | sí / sí | galas, bodas, citas |
| `hand` | Caveat | manuscrita | 0,34 / 0,46 | sí / no | notas y toques divertidos (≥ 56 px) |
| `mono` | JetBrains Mono | monoespaciada | 0,60 | sí / sí | código, marcadores, cronómetros |

Sin negrita real (`display`), `bold` engorda la letra a la fuerza y queda mal. Sin cursiva real, `italic` la inclina a la fuerza. El generador avisa en los dos casos.

### Calcular cajas

- Caracteres por línea ≈ `(w − 32) / (ancho × size)`.
- Alto necesario = `líneas × 1,2 × size + 32` (interlineado fijo de 1,2).
- Ejemplo: un título `sans` en negrita a 96 px en una caja de w = 1760 admite unos `1728 / (0,49 × 96) ≈ 36` caracteres por línea. Con 2 líneas necesita `2 × 115 + 32 = 262` px de alto.
- Las mayúsculas ocupan unos 0,7 × size. Dentro de la caja quedan unos `16 + 0,2·size` px vacíos por encima de la letra y unos `16 + 0,3·size` por debajo. En títulos `display` grandes eso son 60–80 px. Por eso se puede acercar el bloque siguiente o solapar un poco las cajas. La vista previa avisa solo si las líneas de verdad se montan.
- Número o etiqueta dentro de un círculo o píldora: la caja de texto necesita `1,2·size + 32` px de alto aunque la forma sea más pequeña. Haz la caja de texto más grande que la forma, con el mismo centro, y usa `align: center` y `valign: middle`. Ejemplo: círculo de 112 px en (144, 328) con un número de 80 px: caja de texto de 160 × 160 en (120, 304).

### Escala

| Papel | `size` | Fuentes |
|---|---|---|
| Cifra o portada gigante | 160–260 | display, condensed |
| Título | 88–128 (display: 140–200) | sans negrita, display, condensed, elegant |
| Antetítulo o etiqueta | 36–44 en MAYÚSCULAS | condensed negrita |
| Subtítulo | 52–64 | sans, rounded |
| Cuerpo o viñetas | 44–56 | sans, rounded, serif |
| Pie o nota | 32–40 (nunca menos de 28) | sans, condensed |

- Dos familias por diapositiva como mucho, por ejemplo display + sans o elegant + sans.
- El título mide al menos 1,8 veces el cuerpo.
- Una caja puede mezclar estilos con `runs` (tramos: negrita, color, tamaño, fuente, subrayado, tachado, resaltado, superíndice). Úsalo para destacar una palabra dentro de una frase; para bloques con papeles distintos (título y cuerpo), mejor cajas separadas, que se colocan con precisión.
- **Equilibra las líneas tú.** En títulos y textos de 2 o 3 líneas, pon `\n` donde corte con naturalidad («Equipos de 6\ncomo máximo») para que las líneas midan parecido y ninguna acabe con una palabra sola (viuda). La vista previa avisa de las viudas.
- `\n` hace un salto de línea. Las listas son nativas: `list` (`bullet`, `number`, `alpha`, `roman`) en el cuadro y, por línea, `paras` con `indent` (subniveles), `list` propia, `lineHeight`, `spaceBefore`/`spaceAfter` y `align`. Así la numeración multinivel (1., a., i.) la pone XiRo, sin escribir «• » a mano. Con `lineHeight` o espacios entre párrafos, el alto ya no es `líneas × 1,2 × size`: súmalos al calcular la caja y fíate de la vista previa.
- `fit: "shrink"` (el valor por defecto) reduce la letra hasta que el texto cabe. Dimensiona la caja para que no lo necesite y así toda la serie mantiene la misma escala. Si reduce, la vista previa avisa.
- Escribe bien el español: tildes, ñ, ¿?, ¡!, comillas «», raya —, ×, punto medio ·, puntos suspensivos ….
- Evita los emojis: en las teles antiguas pueden no verse. Usa iconos SVG (sección 7).

## 4. Color

- Los colores van como `#rrggbb` o `#rrggbbaa` (con alfa). Translúcidos útiles:
  - `#ffffff14` / `#ffffff1f`: tarjeta sutil sobre fondo oscuro.
  - `#00000099` / `#000000b3`: velo sobre una foto para que se lea el texto.
  - `#00000033`: insignia o sombra suave.
- Contraste mínimo de 4,5:1, o de 3:1 en letra grande (≥ 48 px, o ≥ 36 px en negrita). La vista previa lo mide sobre los píxeles reales, también sobre fotos y degradados.
- Las paletas oscuras lucen más proyectadas. Las claras van bien para textos largos en pantallas brillantes.

### Paletas comprobadas

Son puntos de partida con el contraste ya medido, no la opción por defecto. Si ninguna encaja con el tema, crea otra (y comprueba el contraste en la vista previa).

| Paleta | Fondo | Superficie | Texto | Secundario | Acento 1 | Acento 2 |
|---|---|---|---|---|---|---|
| XiRo noche (la del editor) | `#1e1b2e` | `#2b2640` | `#ffffff` | `#b9b3d1` | `#8ab817` | `#f9b518` |
| Ciruela | `#482045` | `#5f285b` | `#ffffff` | `#e4abde` | `#f9b518` | `#8ab817` |
| Jungla | `#172300` | `#283801` | `#ffffff` | `#c9e898` | `#f9b518` | `#e65453` |
| Océano | `#082f49` | `#0c4a6e` | `#ffffff` | `#bae6fd` | `#22d3ee` | `#f9b518` |
| Atardecer | `#2d132b` | `#482045` | `#fff7ed` | `#fdba74` | `#f9b518` | `#e65453` |
| Neón (fiesta) | `#0b0b14` | `#17172a` | `#ffffff` | `#a5a5c8` | `#22d3ee` | `#f472b6` |
| Pizarra clara | `#f8fafc` | `#ffffff` | `#0f172a` | `#475569` | `#94438e` | `#0891b2` |
| Papel | `#fdf6e3` | `#fffdf7` | `#3b2f2f` | `#6b5e57` | `#b45309` | `#94438e` |

- Sobre acentos claros (verde, ámbar, cian) el texto va oscuro, en el color del fondo, nunca blanco: el blanco da menos de 2,5:1.
- En Pizarra clara, el acento 2 (`#0891b2`) llega solo a 3,5:1: úsalo en letra grande o en formas.
- Marca XiRo: ciruela `#94438e`, berenjena `#684374`, verde camaleón `#8ab817`, ámbar `#f9b518`, cian `#0891b2`, coral `#e65453`. El editor usa `#1e1b2e` como fondo por defecto.
- Colores de las opciones de respuesta de XiRo, para diapositivas tipo pregunta:

| Opción | Color | Sombra 3D | Texto encima |
|---|---|---|---|
| Roja | `#dc2626` | `#7f1d1d` | blanco |
| Azul | `#2563eb` | `#1e40af` | blanco |
| Amarilla | `#eab308` | `#854d0e` | oscuro, `#1e1b2e` |
| Verde | `#16a34a` | `#14532d` | blanco (≥ 36 px en negrita) |
| Ciruela | `#94438e` | `#482045` | blanco |
| Rosa | `#ec4899` | `#831843` | blanco (≥ 48 px) |

  La «sombra 3D» de los botones de XiRo se hace con un rect del color de sombra 12 px más abajo, debajo del rect principal.
- Degradado del fondo nativo: `background.gradient` (`{ to, angle }`, del color del fondo a `to`). Para degradados con varias paradas o radiales, un SVG de fondo (sección 7). Úsalos solo si aportan algo (sección 0).

## 5. Composición

- **Jerarquía.** Un elemento manda: el título o la cifra. Todo lo demás lo acompaña.
- **Alineación.** Usa pocas líneas verticales: todo lo que va a la izquierda arranca en x = 96, es decir, cajas de texto en x = 80. En las series, el título va siempre en el mismo sitio.
- **Proximidad.** Título y subtítulo, a 16–24 px uno del otro. Entre bloques distintos, 48–96 px.
- **Aire.** El que necesite la lectura, ni más ni menos: no rellenes esquinas por rellenar, pero tampoco vacíes una diapositiva para disimular poco contenido.
- **Equilibrio.** Elige la composición por el contenido: asimétrica, centrada, a sangre, en rejilla… No repitas el texto a la izquierda e imagen a la derecha en toda la serie.
- **Decoración.** Solo si dice algo del tema. Formas grandes medio fuera del lienzo o giros suaves (−8° a 8°) pueden dar carácter, pero nunca como relleno. El texto nunca se sale.
- **Profundidad.** El orden del array es el orden de apilado: fondo, formas, imágenes y texto. `shadow` (`soft`, `strong`, `glow` o propia) y `opacity` existen en cualquier elemento; úsalos con mesura, no para «hacer moderno».
- **Tarjetas.** Solo cuando agrupar en cajas aclara algo. Rect con `fill` de superficie y `stroke: null`; el radius, a juego con la identidad (0 también vale). Relleno interior de 40–48 px.
- **Tablas.** Para datos que se comparan en filas y columnas, `table` mejor que muchas cajas sueltas. Letra de 36–56 px, cabecera con su color (`headerFill`) y bandas suaves (`bandFill`) solo si ayudan a seguir la fila.
- **Formas.** Además de rect, ellipse, line y arrow, hay formas libres (`path` con `d`) y un catálogo (`preset`: triangle, star, chevron, block_arrow, speech, cloud, heart…).
- **Imágenes.** Con `contain`, ajusta la caja a la proporción. A sangre (pegadas al borde, sin radius) cuando la imagen es protagonista. Borde (`borderWidth`/`borderColor`) y texto alternativo (`alt`) disponibles; pon `alt` siempre que la imagen diga algo.
- **Texto sobre foto.** Pon debajo del texto un rect con velo (`#000000a0`) del tamaño del bloque de texto o de media diapositiva, o coloca el texto sobre una zona lisa de la foto.

## 5b. Patrones maestros, tablas, gráficos y temas de XiRo

**Patrones (`layout`).** Úsalos cuando la diapositiva sea una estructura corriente (portada, título y contenido, dos columnas, imagen y texto, sección). Ponen cada cosa donde la espera el editor de XiRo, así que luego el usuario puede cambiar de tema o de patrón sin que se descoloque nada. Para una composición propia (la mayoría de las veces en una serie con identidad, sección 0), usa `blank` o no pongas `layout` y da tus cajas. Mezclar: patrón en las diapositivas de estructura y composición libre en las que cuentan algo.

**Roles.** Pon `role` solo en título, subtítulo, cuerpo y pie sobre el fondo, y en imagen, tabla y gráfico. Nunca en texto sobre tarjetas, píldoras o nodos con relleno. Un `role` es una promesa: «si cambian el tema, recolóreame». Sin rol, XiRo solo corrige lo que quede ilegible.

**Tablas.**
- 2–4 columnas: `size` 36; 5–6: 32; 7–10: 28. Menos de 28 no se lee en una sala.
- Alto de fila = `1,2 × size + 32`. 8 filas de 36 px ya son ~600 px: más de 8–9 filas, divide en dos diapositivas o resume.
- Cabecera con `headerFill` propio y texto de contraste ≥ 4,5:1; `borderColor` de la paleta (no el blanco por defecto); `bandFill` solo si ayuda a seguir la fila.
- Números alineados a la derecha (`align`), texto a la izquierda; una sola alineación por tabla, así que si mezclas elige la de los números y deja el texto corto.
- Una tabla no es un gráfico: si el mensaje es «cuánto más», dibuja el gráfico.

**Gráficos** (reglas de la skill `dataviz`).
- Elige el tipo por el trabajo: comparar categorías → `column`/`bar` (`bar` si los nombres son largos); evolución en el tiempo → `line` o `area`; partes de un todo → `pie`/`doughnut` con ≤ 5 sectores que sumen 100 %; si hay un solo número, es una cifra, no un gráfico.
- Una serie: sin leyenda (el título dice qué es). Dos o más: leyenda siempre, no solo color. `values: true` con ≤ 6 categorías; con más, sin números y con cuadrícula suave.
- Los colores siguen el orden fijo de la paleta (no los repitas ni los mezcles por gusto); el color sigue a la entidad, no a su posición. Con `seriesColors` propios, que cada uno llegue a 3:1 sobre el fondo. Sobre fondo claro, los acentos amarillos o verdes claros fallan: elige los oscuros de un tema claro.
- Sin dos ejes ni decoración 3D. El gráfico ocupa su caja entera (leyenda y ejes dentro) y nada va encima.
- Prefiere `data` (atajo) a escribir la tabla oculta, salvo que la tabla deba verse.

**Temas de serie de XiRo** (los que verá el usuario en «Tema»). Úsalos de punto de partida cuando no haya otra identidad: cada uno da fondo, texto, apagado, 6 acentos y pareja de fuentes.

| id | fondo | texto | apagado | acentos | título / cuerpo |
|---|---|---|---|---|---|
| `noche` | #1e1b2e | #ffffff | #b9b3d1 | #8ab817 #3987e5 #e65453 #9085e9 #f9b518 #199e70 | sans / sans |
| `claro` | #ffffff | #1f3a5f | #5b6670 | #1f3a5f #d9614c #2a9d8f #b7791f #6c5ce7 #6c757d | serif / sans |
| `ciruela` | #482045 | #ffffff | #e4abde | #f9b518 #22d3ee #e65453 #b7a6ff #8ab817 #e4abde | rounded / rounded |
| `oceano` | #082f49 | #ffffff | #bae6fd | #22d3ee #f9b518 #10b981 #fb923c #a78bfa #f87171 | condensed / sans |
| `jungla` | #172300 | #ffffff | #c9e898 | #8ab817 #22d3ee #f9b518 #e65453 #c9e898 #fb923c | rounded / sans |
| `papel` | #eceff1 | #14181c | #4a545c | #b3261e #1d3557 #2e7d32 #6a1b9a #b45309 #4a545c | elegant / serif |
| `grafito` | #17191c | #f2f3f4 | #a9b0b7 | #e8b04a #c58fbf #b9c76a #8fa7d6 #e07a5f #6fb3a8 | display / sans |
| `menta` | #eaf6f2 | #0f3d3a | #3f6b66 | #0f766e #c2410c #7e22ce #a16207 #1d4ed8 #be185d | sans / rounded |
| `escuela` | #1f3a32 | #f4f1e8 | #b7cbbf | #f2c94c #7fc8e8 #ffffff #f08a7a #c9e46f #d7b8f3 | hand / rounded |
| `solar` | #ffd23f | #111111 | #3a3300 | #111111 #c2185b #0b5fa5 #7a3e00 #6a2ca0 #1b7f3b | condensed / rounded |

XiRo avisa en el diálogo «Tema» de los acentos que no llegan a 3:1 sobre el fondo del tema: no les pongas texto. Ojo: `papel`, `claro` y `menta` son fondos claros; `papel` roza el tópico crema de la sección 0 si lo usas por defecto. Elige el tema por el tema del juego, no por costumbre.

**Formas.** Las 16 del catálogo (`preset`) ya están: triangle, right_triangle, diamond, parallelogram, trapezoid, pentagon, hexagon, octagon, star, plus, chevron, block_arrow, curved_arrow, heart, speech, cloud. Para otra, `path` con `d`.

## 6. Recetas

En `examples/` hay specs completos y probados. Enseñan **técnicas** (cómo se hace un anillo SVG, una tabla, una lista multinivel, una flecha): tómalas, pero no copies su aspecto. Varios usan tarjetas, círculos con número o barras de acento, tópicos de la sección 0, y ninguno es la plantilla de nada.

| Archivo | Qué enseña |
|---|---|
| `portada.json` | Portada: fondo SVG con degradado lineal y radial, título display en 2 líneas, antetítulo, píldora de fecha, círculo con «?» girado y anillo |
| `reglas.json` | Título con subrayado (`line`) y cuatro pasos en tarjetas 2×2: círculo de color con número (caja de texto mayor que el círculo) y texto centrado en vertical |
| `pregunta.json` | Pregunta con cuatro opciones en los colores de XiRo, con sombra 3D, insignia de letra e icono SVG de reloj |
| `diagrama.json` | Flujo horizontal: cuatro tarjetas con icono SVG de trazo en círculo y flechas `from`/`to` |
| `cifra.json` | Cifra gigante dentro de un anillo de progreso SVG (`stroke-dasharray`) y texto a la derecha |
| `descanso.json` | Pausa centrada: fondo SVG con patrón de puntos, icono en círculo, título display y píldora |
| `tabla.json` | Tabla con cabecera y bandas, título con una palabra destacada (`runs`), degradado de fondo nativo, forma del catálogo con sombra |
| `tema.json` | Roles y `layout` en una diapositiva |
| `patron.json`, `patrones.json` | Patrones maestros: elementos con `role` y sin caja |
| `tabla-columnas.json` | Tabla con `columns` + `rows` y alto automático |
| `grafico.json`, `grafico-datos.json` | Gráfico con tabla oculta; gráfico con `data` |
| `lista.json` | Lista numerada multinivel (`list` + `paras` con `indent`), palabras destacadas con `runs`, imagen con borde y `alt` |

Otras composiciones, con coordenadas de partida (mézclalas y cámbialas; ninguna debe repetirse en toda una serie):

- **Título + lista.** Título en (80, 72), w 1760, 96 px en negrita. Lista nativa en (80, 280), w 1100, 48 px (`list` y `paras`). Si hay una imagen o ilustración que de verdad aporte, a la derecha en x 1240–1824; si no, la lista puede ocupar todo el ancho.
- **Comparación A vs B.** Dos tarjetas de 852 × 620 en x 96 y 972, y = 300, cada una con su título de 64 px y su lista de 44 px. Un círculo de 140 px centrado en (960, 610) con «VS» en display.
- **Línea de tiempo.** Una `line` horizontal en y 600 de x 160 a 1760. Círculos de 48 px repartidos sobre ella. Encima de cada círculo, el año (display, 72 px); debajo, el texto (40 px), alternando arriba y abajo si no cabe.
- **Imagen + texto.** Imagen `cover` de 960 × 1080 a sangre en x 960, o con margen en (1000, 96) a 824 × 888 con radius 32. Texto en la columna izquierda, x 80, w 840.
- **Foto a sangre con titular.** Imagen de fondo (`background.image`) o imagen de 1920 × 1080. Rect `#000000a0` en la mitad izquierda (o en la franja inferior de y 640 a 1080) y titular blanco encima.
- **Cita.** Unas comillas « en `elegant` de 300 px en color de acento, en (80, 40). La cita en `elegant` cursiva de 72 px en (160, 280), w 1600. El autor en `condensed` de 40 px en mayúsculas debajo.
- **Ranking o podio.** Tres rects de 360 de ancho en x 384 (2.º, 400 de alto), 780 (1.º, 520 de alto) y 1176 (3.º, 320 de alto), todos con la base en y 960. Encima, número en display de 140 px y nombre en sans de 48 px en negrita. Colores: oro `#fbbf24`, plata `#e2e8f0` y bronce `#d08a4f`, con texto oscuro `#1c1917`.

## 7. SVG: iconos, ilustraciones, gráficos y fondos

Úsalo para degradados y fondos con formas (blobs, ondas, patrones de puntos o rayas), iconos de trazo, ilustraciones planas sencillas, gráficos (barras, anillos, tartas), banderas y mapas esquemáticos.

**Reglas de XiRo.** Si no se cumplen, rechaza el SVG y el generador da error con el motivo:
- Nada de `<script>`, atributos `on…=`, `<foreignObject>`, `<iframe>`, `<embed>`, `<object>`, `<!DOCTYPE>` con entidades, `<?xml-stylesheet?>` ni `@import`.
- `url()` solo como `url(#id)`, exacto, sin comillas ni espacios: `fill="url(#g)"` vale; `fill="url('#g')"` no.
- `href` solo hacia `#id` o hacia `data:image/png|jpeg|gif|webp;base64,…`. Nada de enlaces ni de imágenes externas.
- Ojo con textos que contengan « on…=». La guardia de XiRo los toma por un manejador de eventos.

**Buenas prácticas:**
- Pon siempre `viewBox`. El generador añade `xmlns`, `width` y `height`.
- **No metas texto dentro del SVG.** En XiRo el SVG se pinta como `<img>`, sin acceso a las fuentes de la diapositiva: el texto saldría con otra letra. Pon el texto encima con elementos `text`.
- Para un fondo, usa `viewBox='0 0 1920 1080'`: el fondo se pinta en modo cover, así que con esa proporción encaja exacto.
- Para que un SVG llene su caja, dale al `viewBox` la misma proporción que la caja (o usa `fit: "cover"`). Si omites `h` o `w`, el generador lo calcula con la proporción del SVG.
- Iconos: estilo de trazo en `viewBox='0 0 24 24'`, con `fill='none' stroke='…' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'`. A 72–120 px. El círculo de color detrás es opcional y es uno de los tópicos de la sección 0: úsalo solo si aporta. Dentro del JSON, usa comillas simples en los atributos.
- Anillo de progreso: un círculo de fondo con `stroke-opacity` y otro con `stroke-dasharray='{p·2πr} {2πr}'` y `transform='rotate(-90 cx cy)'` (ver `cifra.json`).
- Patrón de puntos: genera los `<circle>` con un bucle. Unos 600 círculos ocupan unos 25 KB (ver `descanso.json`).
- Que pese poco (menos de 100 KB) y que tenga formas sencillas. Para fotos, usa archivos de verdad.

## 8. Errores frecuentes

- Olvidar `"stroke": null` en `rect` o `ellipse`: XiRo les pone un borde blanco de 6 px. Olvidar `"fill"`: salen violetas (`#7c3aed`).
- Barras finas: w y h miden como mínimo 20 px. Para una línea fina, usa `line` con `strokeWidth`, o un rect de 20 px.
- Texto blanco por defecto sobre fondo claro: pon `color`.
- `bold` con `display`.
- Cajas de texto justas: la letra se reduce (aviso de «la letra baja…»). Calcula el alto con la fórmula de la sección 3.
- Palabras largas en cajas estrechas: se parten a mitad de palabra (aviso de «se parte la palabra…»).
- Una palabra sola en la última línea (aviso de «queda … sola»): parte las líneas con `\n` o ajusta el ancho.
- Flechas: usa `from` y `to` en vez de calcular el giro. El giro se redondea a grados enteros: en diagonales largas, el extremo puede desviarse unos píxeles.
- Más de 50 elementos: divide la diapositiva en dos.
- Imágenes de internet: usa solo las que te dé el usuario, por archivo o URL. No busques ni descargues fotos por tu cuenta; si hace falta una imagen, dibuja un SVG con sentido, no un icono genérico.
- Repetir la misma composición en toda la serie, o tirar de tarjetas, círculos con icono y barras de acento por costumbre (sección 0).
