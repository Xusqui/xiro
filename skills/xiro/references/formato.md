# Formato del spec (entrada de `build`)

El spec es un JSON que se parece mucho al lienzo que guarda XiRo, con algunas ayudas: imágenes desde archivo, URL o SVG en línea; proporciones e ids automáticos; flechas con `from`/`to`. `build` lo valida todo con mensajes claros y genera el `.xiroslide`. **No escribas el `.xiroslide` a mano.**

## Estructura

```json
{
  "name": "Reglas del juego",
  "slides": [
    { "background": "#1e1b2e", "elements": [ ... ] },
    { "background": { "color": "#000000", "image": "fondo.jpg" }, "elements": [ ... ] }
  ]
}
```

- Para una sola diapositiva vale la forma corta: `{ "name", "background", "elements" }`, sin `slides`.
- `name` se usa para el nombre del archivo (`reglas-del-juego.xiroslide`). Si falta, se toma la primera línea de texto.
- Las claves que empiezan por `_` son comentarios y se ignoran en cualquier nivel, por ejemplo `"_nota": "..."`.
- Límites de XiRo: 100 diapositivas por archivo, 50 elementos por diapositiva, 2000 caracteres por texto y unos 64 KB de JSON por diapositiva (sin contar las imágenes).

## Lienzo

- 1920 × 1080 px lógicos. `x` e `y` marcan la esquina superior izquierda de la caja. Se redondean a enteros.
- Rangos: `x` de −1920 a 3840, `y` de −1080 a 2160, `w` de 20 a 3840 y `h` de 20 a 2160. **El mínimo es de 20 px por lado.**
- `rotation`: grados en el sentido de las agujas del reloj alrededor del centro de la caja. Se redondea y se normaliza a −180…180. Por defecto vale 0.
- El orden de `elements` es el orden de apilado: el primero queda al fondo.
- `id` (opcional): `el_` seguido de 4 a 16 minúsculas o cifras. Si falta, se genera uno estable.

### Estilo de cualquier elemento (junto a x, y, w, h; no dentro de `props`)

| clave | valores | por defecto |
|---|---|---|
| `opacity` | 0.05–1 (se redondea a centésimas) | 1 |
| `shadow` | `"soft"`, `"strong"`, `"glow"` o `{ "x": -100…100, "y": -100…100, "blur": 0…100, "color": "#rrggbbaa" }` | sin sombra |
| `groupId` | un nombre cualquiera (`"titulo"`): los elementos con el mismo nombre en la diapositiva forman un grupo en el editor | sin grupo |
| `locked` | true: no se mueve en el editor por accidente | false |

```json
{ "type": "path", "x": 1656, "y": 72, "w": 168, "h": 160, "shadow": "soft", "opacity": 0.9, "props": { "preset": "star", "fill": "#f9b518", "stroke": null } }
```

## background

- `"#rrggbb"`: solo color.
- `{ "color": "#rrggbb", "image": "ruta o URL" }` o `{ "color": …, "svg": "<svg …>…</svg>" }`: la imagen se pinta encima del color en modo cover, centrada.
- `"gradient": { "to": "#rrggbb", "angle": 0–359 }` dentro del objeto: degradado lineal del `color` del fondo a `to` (180 = de arriba abajo, 90 = de izquierda a derecha; por defecto 180). Para varias paradas o degradados radiales, un `svg` de fondo.
- Por defecto: `#1e1b2e`, sin imagen.

## Colores

`#rrggbb` o `#rrggbbaa` (alfa: `#00000099` es negro al 60 %). `#rgb` y `#rgba` se amplían solos. `null`, `"none"` o `"transparent"` significan «sin color» en los campos que lo admiten (`fill` y `stroke`).

## Elementos

### `text`

```json
{ "type": "text", "x": 80, "y": 72, "w": 1760, "h": 150,
  "props": { "text": "Título", "font": "sans", "size": 96, "bold": true, "color": "#ffffff",
             "align": "left", "valign": "top", "fill": null, "fit": "shrink" } }
```

| prop | valores | por defecto |
|---|---|---|
| `text` | texto plano; `\n` = salto de línea | `""` |
| `font` | `sans` `serif` `display` `mono` `rounded` `condensed` `elegant` `hand` | `sans` |
| `size` | 8–400 px | 64 |
| `bold` / `italic` | true / false | false |
| `color` | color (sin alfa = opaco) | `#ffffff` |
| `align` | `left` `center` `right` `justify` | `left` |
| `valign` | `top` `middle` `bottom` | `top` |
| `fill` | color de fondo de toda la caja, sin esquinas redondeadas, o `null` | `null` |
| `fit` | `shrink`: reduce la letra hasta que cabe; `wrap`: no la reduce y lo que no cabe se corta | `shrink` |
| `underline` | true: todo el cuadro subrayado | false |
| `list` | `bullet` `number` `alpha` `roman`: cada línea es un punto de la lista | sin lista |
| `runs` | tramos con formato propio (abajo); con `runs`, `text` sobra | — |
| `paras` | formato de cada línea (abajo) | — |

Así se pinta: relleno de 16 px, interlineado de 1,2 y saltos de línea respetados. Las palabras que no caben en el ancho se parten.

**Tramos (`runs`)**: la lista de trozos del texto, en orden; juntos forman el texto (los `\n` van dentro de los tramos). Cada tramo lleva `text` y, solo si cambia respecto al cuadro: `bold`, `italic`, `underline`, `strike` (tachado), `color`, `highlight` (color de resaltado), `font`, `size` (8–400) y `script` (`sup` o `sub`). Máximo 300 tramos. Lo que no cambia nada respecto al cuadro, XiRo lo quita.

```json
"props": { "runs": [ { "text": "Clasificación " }, { "text": "ronda 2", "color": "#f9b518" } ], "size": 96, "bold": true }
```

**Párrafos (`paras`)**: un objeto por línea del texto, en orden (`{}` o `null` = sin cambios). Claves: `align`, `list` (otra lista en esa línea, o `"none"` para sacarla de la lista del cuadro), `indent` (0–8 niveles de sangría: subpuntos), `lineHeight` (1, 1.15, 1.5, 2, 2.5 o 3), `spaceBefore` y `spaceAfter` (0–200 px) y `style` (`title`, `subtitle`, `quote`). Si no hay tantos como líneas, XiRo rellena o recorta (el generador avisa).

```json
"props": { "text": "Equipos de 2 a 5\nUn móvil por equipo\nResponde rápido", "list": "number",
           "paras": [ {}, { "indent": 1, "list": "alpha" }, { "spaceBefore": 24 } ] }
```
Sale «1. Equipos de 2 a 5 / a. Un móvil por equipo / 2. Responde rápido»: la numeración de cada nivel la pone XiRo.

### `shape` (o, como atajo, `"type": "rect" | "ellipse" | "line" | "arrow" | "path"`)

```json
{ "type": "rect", "x": 96, "y": 280, "w": 852, "h": 320, "props": { "fill": "#2b2640", "stroke": null, "radius": 32 } }
{ "type": "arrow", "from": [456, 620], "to": [552, 620], "props": { "stroke": "#ffffff", "strokeWidth": 6 } }
```

| prop | valores | por defecto |
|---|---|---|
| `shape` | `rect` `ellipse` `line` `arrow` `path` | `rect` |
| `fill` | color o `null` (solo cuenta en rect, ellipse y path) | rect, ellipse y path: **`#7c3aed`** (violeta); line y arrow: `null` |
| `stroke` | color o `null` | **`#ffffff`** |
| `strokeWidth` | 0–60 | rect y ellipse: **6**; line y arrow: 8 |
| `radius` | 0–540 (esquinas del rect) | 0 |
| `preset` | solo path: forma del catálogo de XiRo: `triangle` `right_triangle` `diamond` `parallelogram` `trapezoid` `pentagon` `hexagon` `octagon` `star` `plus` `chevron` `block_arrow` `curved_arrow` `heart` `speech` `cloud` | — |
| `d` | solo path, en vez de `preset`: trazado SVG (solo comandos `M L H V C S Q T A Z`, máx. 8000 caracteres) | — |
| `viewBox` | solo path, con `d`: `[ancho, alto]` del sistema de coordenadas del trazado; se estira a la caja | `[100, 100]` |

- **Indica siempre `fill` y `stroke` en rect, ellipse y path.** Los valores por defecto (violeta con borde blanco) rara vez son lo que quieres. El generador avisa si faltan.
- El borde de rect y ellipse se dibuja hacia dentro. Una ellipse con w = h es un círculo. Para una píldora, usa radius = h / 2.
- `line` y `arrow` cruzan la caja por la mitad, de izquierda a derecha. La punta de la flecha va a la derecha y mide `min(w/2, max(3·strokeWidth, 24))` de largo.
- **`from: [x, y]` y `to: [x, y]`** (solo para line y arrow) sustituyen a x, y, w y rotation: el generador calcula la caja y el giro, y la punta queda en `to`. `h` es opcional y vale como mínimo 40.

### `image`

```json
{ "type": "image", "x": 1000, "y": 96, "w": 824, "props": { "src": "~/Desktop/foto.jpg", "fit": "cover", "radius": 32 } }
{ "type": "image", "x": 870, "y": 174, "w": 180, "props": { "svg": "<svg viewBox='0 0 24 24' ...>...</svg>" } }
```

| prop | valores | por defecto |
|---|---|---|
| `src` | ruta local (relativa al spec, absoluta o con `~/`) o URL http(s) | — |
| `svg` | código SVG en línea, en lugar de `src` | — |
| `embed` | `false` = no meter la imagen de una URL en el archivo, sino dejar la URL (XiRo la descarga al importar) | `true` |
| `fit` | `contain`: entera, puede dejar bandas; `cover`: llena la caja recortando | `contain` |
| `radius` | 0–540 | 0 |
| `ratio` | proporción ancho/alto (0,05–20); se calcula sola | la de la imagen |
| `lockRatio` | conservar la proporción al redimensionar en el editor | true |
| `alt` | texto alternativo (hasta 300 caracteres): ponlo si la imagen dice algo | — |
| `borderWidth` / `borderColor` | borde de la imagen: 0–40 px y su color | sin borde (color por defecto `#ffffff`) |

- Basta con `w` o con `h`: el otro lado sale de la proporción de la imagen. Si das los dos con `contain` y otra proporción, quedan bandas (el generador avisa).
- Formatos que admite XiRo: PNG, JPEG, GIF, WebP y SVG, de hasta 5 MB cada uno. En macOS (con `sips`), además, HEIC, TIFF, BMP y AVIF se convierten solos a JPEG o PNG, y las fotos de más de 3200 px o de más de 5 MB se reducen a 2560 px. En otros sistemas esas imágenes dan error y hay que convertirlas antes.
- Las imágenes van dentro del archivo en base64. Si dos elementos usan la misma, se guarda una sola vez. Con `embed: false`, el archivo lleva la URL y XiRo descarga la imagen al importarlo (desde la versión posterior a la 3.6.0; hasta la 3.6.0 la conserva enlazada y no se ve, porque su CSP solo enseña imágenes del propio servidor), así que su servidor tiene que llegar a esa web. Lo normal es dejar `embed` como está.
- XiRo también acepta en `src` una imagen escrita como `data:` (por ejemplo `data:image/svg+xml;utf8,<svg …>`, como las de una IA generalista): la guarda en `/uploads/` al importar. La skill no lo necesita, porque mete cada imagen en `assets`.
- Reglas del SVG: ver `diseno.md`, sección 7.

### `table`

```json
{ "type": "table", "x": 96, "y": 272, "w": 1728, "h": 640,
  "props": { "rows": [ ["Puesto", "Equipo", "Puntos"], [1, "Los Búhos", 8450], [2, "Cerebritos", 7920] ],
             "size": 48, "color": "#ffffff", "align": "center", "headerFill": "#8ab817", "fill": "#2b2640",
             "bandFill": "#352f4d", "borderColor": "#1e1b2e", "borderWidth": 4 } }
```

| prop | valores | por defecto |
|---|---|---|
| `rows` | filas de celdas (texto o número; `\n` = salto de línea): hasta 20 filas, 10 columnas y 200 caracteres por celda. Todas las filas con las mismas celdas (si no, XiRo rellena con vacías y el generador avisa) | — |
| `header` | la primera fila es la cabecera | true |
| `font` / `size` / `color` / `align` | letra (las 8 fuentes), 8–200 px, color, `left` `center` `right` | `sans`, 32, `#ffffff`, `left` |
| `fill` | fondo de las celdas, o `null` | `null` |
| `bandFill` | fondo de las filas pares del cuerpo (bandas), o `null` | `null` |
| `headerFill` | fondo de la cabecera, o `null` | **`#7c3aed`** (violeta) |
| `borderColor` / `borderWidth` | bordes de las celdas, 0–20 px | `#ffffff`, 2 |

- Indica `headerFill` y `borderColor`: los valores por defecto (cabecera violeta y bordes blancos) rara vez son lo que quieres. El generador avisa si faltan.
- **Atajo `columns` + `rows`:** `"columns": ["Equipo", "Puntos"]` y `"rows"` solo con el cuerpo; el generador antepone la cabecera. Si omites `h`, lo calcula (`1,2 × size + 32` px por fila). El aviso de diseño de siempre te dice si la tabla se sale. Mira `examples/tabla-columnas.json`.
- La tabla reparte el alto entre las filas; calcula `h` con unas `1,2 × size + 32` px por fila como mínimo. En el móvil, el jugador puede ampliar la diapositiva para leerla.

### `role` y `layout` (temas)

Un tema de XiRo (paleta, fuentes y fondo) se aplica a las diapositivas del juego reescribiendo los elementos que llevan `role`. Un elemento sin `role` conserva su aspecto, pero si el tema nuevo lo deja ilegible (por ejemplo, texto blanco sobre un fondo claro) XiRo le cambia el color.

- **`role` del elemento:** `title`, `subtitle`, `body` y `caption` en textos; `accent` en formas; `image`, `table` y `chart` en esos tipos. Solo vale en los tipos que lo admiten; si no, el generador da error.
- **Qué lleva rol:** el título, el subtítulo, el cuerpo y el pie que van sobre el **fondo** de la diapositiva. **No pongas rol a un texto que va encima de una forma con relleno** (tarjetas, píldoras, nodos): el tema le cambiaría el color sobre un relleno que no cambia.
- **`layout` de la diapositiva** (junto a `background` y `elements`): patrón maestro `cover`, `title-content`, `two-columns`, `image-text`, `section` o `blank`. XiRo lo usa al cambiar de patrón.
- **Colocación automática:** con `layout`, un elemento con `role` **y sin caja** (`x`, `y`, `w`, `h`) se coloca solo en el hueco del patrón, por orden. El texto toma además el tamaño, la alineación y la alineación vertical del hueco, salvo los que indiques. Si das `x`/`y`/`w`/`h`, manda tu caja. Si faltan huecos (más cuerpos que huecos) el generador da error.

| `layout` | huecos (px; lienzo 1920×1080) |
|---|---|
| `cover` | `title` 160,340 · 1600×240 · 120 px centrado abajo; `subtitle` 160,600 · 1600×140 · 48 px |
| `title-content` | `title` 80,48 · 1760×140 · 72 px; `body` (o `table`/`chart`) 80,220 · 1760×780 · 44 px |
| `two-columns` | `title` igual; dos `body` 80,220 y 980,220 · 860×780 |
| `image-text` | `title` igual; `image` 80,220 · 860×780 (la imagen se ajusta a su proporción y se centra en el hueco); `body` 980,220 · 860×780 |
| `section` | `title` 160,380 · 1600×200 · 104 px centrado abajo; `subtitle` 160,600 · 1600×120 · 44 px |
| `blank` | ninguno |

- Mira `examples/tema.json`, `patron.json` y `patrones.json`.

### `chart` (y `hidden`)

Un gráfico no lleva números propios: lee los de una **tabla de la misma diapositiva**, que se enlaza por `id`. Pon `id` en la tabla de datos y apúntalo desde `source.tableId`; si no coincide, el generador da error (XiRo lo dejaría en «Sin datos»).

```json
{ "id": "el_datos", "type": "table", "hidden": true, "x": 80, "y": 200, "w": 1760, "h": 300,
  "props": { "rows": [ ["", "Móvil", "Pantalla"], ["2024", 120, 30], ["2025", 340, 80] ], "size": 32 } },
{ "type": "chart", "x": 80, "y": 200, "w": 1760, "h": 780,
  "props": { "source": { "tableId": "el_datos", "seriesIn": "columns" }, "kind": "column", "values": true, "size": 32, "color": "#ffffff" } }
```

| prop | valores | por defecto |
|---|---|---|
| `source` | `{ tableId, seriesIn }`. Con `columns`, la primera fila da los nombres de las series (la celda de la esquina se ignora) y la primera columna las categorías; con `rows`, al revés | — (obligatorio) |
| `kind` | `column`, `bar`, `line`, `area`, `pie`, `doughnut` | `column` |
| `stacked` | apilado; solo en `column`, `bar` y `area` | false |
| `seriesColors` | colores por serie (por categoría en `pie` y `doughnut`); `null` = automático; hasta 8 | `[]` |
| `legend` / `values` / `grid` | leyenda (sola con 2 o más series, siempre en `pie`/`doughnut`), números sobre las marcas, cuadrícula (no en `pie`/`doughnut`) | true / false / true |
| `font` / `size` / `color` | letra, 12–120 px y color de todos los textos del gráfico | `sans`, 32, `#ffffff` |
| `alt` | texto alternativo (hasta 300); si falta, XiRo lo describe con los datos | — |

- **Atajo `data`:** en vez de escribir la tabla, pon en el gráfico `"data": { "categories": ["Colegios", "Empresas"], "series": [ { "name": "Cuota", "values": [55, 30] } ] }` dentro de `props` (sin `source`). El generador crea la tabla oculta `el_dat<n>` y enlaza el gráfico. Usa `null` para un hueco. Da error si hay menos de 2 categorías, si una serie tiene más valores que categorías o si no tiene ningún número; no pongas `data` y `source` a la vez. Mira `examples/grafico-datos.json`.
- **Datos:** hasta 24 categorías y 8 series. Los números pueden llevar coma o punto decimal; un solo separador seguido de exactamente 3 cifras (`1.234`) es de miles. Se quitan `€ $ £ %` y los espacios; lo demás es un hueco. Sin ningún número, el gráfico enseña «Sin datos».
- **Colores:** sin `seriesColors` se usa la paleta de XiRo (8 colores en orden fijo; tonos oscuros si `color` es claro). Sobre fondo blanco, tres quedan por debajo de 3:1: pon `values: true` o elige colores propios.
- **`hidden: true`** vale en cualquier elemento: ninguna pantalla ni el PDF lo pintan. Es lo normal en la tabla de datos de un gráfico (el móvil la recibe igualmente, porque la necesita). Si la tabla se queda visible, ponla en otro sitio del lienzo o junto al gráfico a propósito.
- Dibuja el gráfico en toda su caja: la leyenda y los ejes van dentro. No lo montes encima de otros elementos visibles.

### `video`

```json
{ "type": "video", "x": 160, "y": 90, "w": 1600, "h": 900, "props": { "url": "https://youtu.be/…", "autoplay": true } }
```

- `url`: YouTube (watch, youtu.be, shorts, embed, live), Vimeo, Dailymotion, o un archivo `.mp4`, `.m4v`, `.webm`, `.ogg`, `.ogv` o `.mov` por http(s). Los vídeos subidos a otro XiRo (`/uploads/…`) no viajan entre instalaciones.
- `autoplay`: false por defecto.
- En el editor y en la vista previa se ve una caja negra con el dominio. En el presentador se reproduce.

## Archivo `.xiroslide` (lo genera `build`)

Es un JSON de una línea:

```json
{ "format": "xiro-slide", "formatVersion": 7,
  "generator": { "app": "XiRo", "version": null, "tool": "xiro-skill" },
  "exportedAt": "2026-10-23T12:00:00.000Z",
  "slides": [ { "slide_type": "canvas", "slide_canvas": { "version": 1, "background": { "color": "#1e1b2e", "image": "asset:a1" }, "elements": [ … ] } } ],
  "assets": [ { "id": "a1", "mime": "image/svg+xml", "name": "imagen.svg", "data": "<base64>" } ] }
```

- Las imágenes del lienzo apuntan a `asset:aN`. Al importar, XiRo guarda cada una en `/uploads/slide-<hash>.<ext>` (si el contenido se repite, no se duplica) y cambia la referencia.
- Los mismos bytes sirven para «Importar archivo» y para «Pegar» (portapapeles). Límites: 25 MB por archivo; para pegar se recomienda que no pase de 5 MB.
- `build` comprueba el resultado con la importación de XiRo (sus propios módulos, copiados en la skill): sobre, imágenes por su contenido (también `data:` y de otras webs), guardia de SVG, normalización y esquema del lienzo. Si algo no entra limpio, da error en vez de generar el archivo. Un XiRo anterior a la versión que trae formatVersion 5 rechaza el archivo con `SLIDE_PACKAGE_TOO_NEW`.
