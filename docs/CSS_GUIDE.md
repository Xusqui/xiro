# Guía de CSS

Todo el CSS de Xiro! se escribe a mano. No hay paso de compilación, ni
`npm run`, ni ficheros de entrada que generen otros: lo que hay en
`app/public/css/` es exactamente lo que sirve el navegador.

## Qué carga cada página

| Página | Hojas de estilo |
|---|---|
| `admin.html` | `common.css`, `output-admin.css`, `drag-drop.css`, `tokens.css`, `admin.css`, `checkbox.css` (checkbox animado del admin), `config-savebar.css` (barra de guardado común de Configuración), `admin-ai-config.css` (pestaña IA de Configuración) |
| `jugador.html` | `common.css`, `output-player.css`, `jugador-base.css`, `jugador-quiz.css`, `jugador-effects.css`, `dice3d.css` |
| `presentador.html` | `common.css`, `output-presenter.css`, `presenter.css`, `presenter-lobby-*.css`, `fireworks.css`, `neon.css`, `index-style.css` |
| `index.html`, `contact.html`, `instrucciones.html`, manuales | `common.css`, `output-index.css`, `index-style.css` (+ `about.css` en `about.html`, `tokens.css` en los manuales) |
| `standalone.html` | `common.css`, `index-style.css`, `output-standalone.css` |
| `tv.html` | solo `tv.css` (pensado para navegadores de TV antiguos) |
| `health.html` | `tokens.css`, `health.css` |
| `xiro-results-viewer.html` | `tokens.css`, `xiro-result-viewer.css` |
| `error/*.html` | `common.css` |

## Los ficheros

- **`common.css`**: reset base y clases utilitarias de una sola propiedad
  (`bg-plum-600`, `p-4`, `rounded-2xl`, `hover:bg-camaleon-700`…). El HTML y el
  JS del proyecto usan estas clases directamente. Está minificado; las clases
  nuevas se añaden en la sección final **"Mantenido a mano"**, legible.
- **`output-admin.css`, `output-player.css`, `output-presenter.css`,
  `output-index.css`, `output-standalone.css`**: estilos propios de cada
  sección. El prefijo `output-` es histórico; son ficheros normales que se
  editan directamente.
- **`tokens.css`**: variables de diseño (colores de marca, escalas
  `plum`/`aubergine`/`camaleon` de 50 a 950, tipografía, radios, espaciado).
  Fuente de verdad junto con `DESIGN.md`.
- **El resto** (`admin.css`, `jugador-*.css`, `presenter*.css`, `tv.css`…):
  estilos de componente por página.

## Añadir una clase utilitaria

Antes de usar una clase en HTML o JS, comprueba que existe:

```bash
grep -c '\.bg-plum-300{' app/public/css/common.css
```

Si devuelve `0`, añádela al final de `common.css`, en la sección "Mantenido a
mano". Usa los valores de `tokens.css`; no inventes colores.

```css
.bg-plum-300{background-color:#e4abde}
.text-aubergine-800{color:#52335b}
.border-camaleon-600{border-color:#557400}
```

### Variantes

El nombre de la clase lleva el prefijo de la variante, y en el selector hay que
escapar `:` y `/` con `\`:

```css
/* hover: y focus: */
.hover\:bg-plum-700:hover{background-color:#793475}
.focus\:border-plum-500:focus{border-color:#b05baa}

/* group-hover: (el padre lleva la clase "group") */
.group:hover .group-hover\:text-plum-600{color:#94438e}

/* opacidad con barra: bg-plum-600/20 */
.bg-plum-600\/20{background-color:rgb(148 67 142/.2)}

/* responsive: md: = 768px, lg: = 1024px */
@media (min-width:768px){.md\:text-3xl{font-size:1.875rem;line-height:2.25rem}}
```

Orden: las variantes `hover:`/`focus:` van **después** de la clase base del
mismo color, para que ganen en la cascada. Las responsive van dentro de su
`@media`, después de las clases base.

### Clases construidas en JS

Si un fichero JS compone el nombre (`` `bg-${color}-100` ``), todas las
combinaciones posibles tienen que existir en `common.css`. Es preferible tener
en el JS un mapa con los nombres completos y literales, como
`_CUSTOM_CARD_COLORS` en `js/admin/modules/custom-question-cards.js`, para
poder buscarlos con `grep`.

## Paleta

- **Marca**: `plum` (ciruela) y `aubergine` (berenjena). No uses los morados o
  índigos genéricos (`purple`, `violet`, `indigo`) como color de marca; solo
  existen para colores de categoría (equipo "Morado", fichas del Trivial).
- **Acción principal del admin**: `camaleon-600` con hover `camaleon-700`.
- **Colores por rol** (jugador, presentador, TV, solitario, admin): ver
  `DESIGN.md` y `tokens.css`.

## Caché

No hace falta tocar la versión de los ficheros. El middleware
`app/middlewares/assetVersioning.js` añade `?v=<hash del contenido>` a cada
`href` de CSS al servir el HTML, así que un cambio en un CSS invalida la caché
del navegador automáticamente.
