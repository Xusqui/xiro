# 📋 Guía de Compilación CSS

## Estructura

El CSS de Tailwind está modularizado en un bundle común (`common.css`) más un bundle
específico por sección de la app. Cada página HTML carga `common.css` + su bundle
específico (y, además, sus propios CSS no-Tailwind sueltos, p. ej. `admin.css`,
`jugador-base.css`, `presenter.css`...).

| Input (Tailwind) | Output | Cargado en |
|---|---|---|
| `input-common.css` | `common.css` | admin.html, jugador.html, presentador.html, index.html, standalone.html |
| `input-admin.css` | `output-admin.css` | admin.html |
| `input-player.css` | `output-player.css` | jugador.html |
| `input-presenter.css` | `output-presenter.css` | presentador.html |
| `input-index.css` | `output-index.css` | index.html |

### Sin Tailwind (sin cambios)
- `tv.html` usa únicamente `tv.css` — no pasa por el pipeline de Tailwind.
- `standalone.html` carga `common.css` (para la cuadrícula de juegos del lobby, que sí usa
  utilidades Tailwind) **más** `output-standalone.css`, que a pesar del nombre **no** se
  genera con Tailwind — es CSS artesanal editado directamente, sin `input-standalone.css`
  ni entrada en `package.json`. Ahí vive toda la estética de partida en curso (pantalla
  completa estilo `jugador.html`, tarjetas cristal 3D, colores de revelado). Se edita
  directamente y no requiere ningún `npm run build:css*`.

## 🔧 Compilar los CSS

Comandos disponibles desde la raíz del repo (ver también `docs/TAILWIND_CSS_GUIA.md`
para detalle de troubleshooting y safelist):

### Compilar TODO (Recomendado tras editar cualquier `input-*.css`)
```bash
npm run build:css
```
Genera en paralelo: `common.css`, `output-admin.css`, `output-player.css`,
`output-presenter.css`, `output-index.css`.

### Compilar un bundle individual
```bash
npm run build:css:common
npm run build:css:admin
npm run build:css:player
npm run build:css:presenter
npm run build:css:index
```

### Watch (desarrollo)
```bash
npm run watch:css             # todos los bundles en paralelo
```

## 📊 Estructura de archivos

```
app/public/css/
├── input-common.css ---→ [Tailwind] → common.css
├── input-admin.css ----→ [Tailwind] → output-admin.css
├── input-player.css ---→ [Tailwind] → output-player.css
├── input-presenter.css → [Tailwind] → output-presenter.css
├── input-index.css ----→ [Tailwind] → output-index.css
├── tv.css (sin Tailwind)
├── output-standalone.css (sin Tailwind, pese al nombre — se edita directamente)
└── ... CSS sueltos por página (admin.css, jugador-base.css, presenter.css, etc.)
```

## ⚠️ Importante

- **Nunca edites los archivos compilados** (`common.css`, `output-*.css`) — se
  sobrescriben en cada `npm run build:css`. Edita siempre el `input-*.css` correspondiente.
  **Excepción**: `output-standalone.css` no tiene `input-*.css` ni pipeline Tailwind — es
  la única excepción a esta regla y se edita directamente.
- Tras editar cualquier `input-*.css` o añadir nuevas clases Tailwind en HTML/JS, hay
  que recompilar — no hay watch activo en producción.
- Las clases generadas dinámicamente en JS deben estar en
  `app/public/_tailwind-safelist.html` para que Tailwind las incluya (ver
  `docs/TAILWIND_CSS_GUIA.md`).

## ✨ Ventajas de esta estructura

- 🎯 Cada página carga **solo** el CSS Tailwind que necesita
- 📉 Bundles más pequeños = carga más rápida
- 🔒 Mejor encapsulación de estilos por sección
- 🛠️ Más fácil mantener y depurar CSS específico de cada página

---

## Referencias

- `docs/TAILWIND_CSS_GUIA.md` — comandos detallados, troubleshooting, gestión del safelist
- `tailwind.config.js` (raíz del repo) — `content` y safelist
- `app/public/_tailwind-safelist.html` — fuente única de verdad para clases dinámicas
