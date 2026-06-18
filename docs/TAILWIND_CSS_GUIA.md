# 🎨 Guía Rápida: Compilar CSS de Tailwind

## Estado actual

El CSS está modularizado en **5 bundles** independientes (no un único `input.css`/`output.css`).
Para el detalle de qué bundle carga cada página, ver `docs/CSS_COMPILATION_GUIDE.md`.

## ✅ Comandos Correctos

### Regenerar todos los bundles (Producción - minificado)
```bash
npm run build:css
```

### Regenerar un bundle individual
```bash
npm run build:css:common      # input-common.css    → common.css
npm run build:css:admin       # input-admin.css      → output-admin.css
npm run build:css:player      # input-player.css     → output-player.css
npm run build:css:presenter   # input-presenter.css  → output-presenter.css
npm run build:css:index       # input-index.css      → output-index.css
```

### Modo Watch (Desarrollo - regenera automáticamente)
```bash
npm run watch:css             # todos los bundles en paralelo
npm run watch:css:admin       # solo un bundle, p. ej. admin
```

Estos comandos viven en el `package.json` de la **raíz del repo** (no en `app/package.json`)
y se ejecutan con `tailwindcss` (CLI v3) directamente, con
`BROWSERSLIST_IGNORE_OLD_DATA=1` para evitar el warning de browserslist desactualizado.

## 🚫 NO Usar

❌ **INCORRECTO:**
```bash
npx @tailwindcss/cli -i ./app/public/css/input-admin.css -o ./app/public/css/output-admin.css --minify
```

`@tailwindcss/cli` es Tailwind v4 (arquitectura distinta) y no es compatible con la
configuración actual del proyecto.

## 📦 Versiones

- **Tailwind CSS**: v3.4.19 (instalado en `node_modules` de la raíz)
- **Configuración**: `tailwind.config.js` (raíz del repo)

## 🔍 Verificación

Después de regenerar, comprueba que el bundle correspondiente:
- ✅ No esté vacío ni truncado
- ✅ Contenga las clases usadas en los HTML/JS de esa sección
- ✅ Incluya las clases del safelist (`_tailwind-safelist.html`)

Si un bundle pesa muy poco respecto a builds anteriores, sospecha del comando usado
(Tailwind v4 vs v3) o de que `content` en `tailwind.config.js` no esté escaneando los
archivos correctos.

## 📝 Notas Importantes

1. **Safelist — fuente única de verdad**: las clases dinámicas que se generan en
   JavaScript (template literals) se listan en `app/public/_tailwind-safelist.html`.
   `tailwind.config.js` define explícitamente `safelist: []` con el comentario
   *"No usar este array — fuente única de verdad: `_tailwind-safelist.html`"* — no
   añadas clases ahí, añádelas siempre al HTML del safelist.

2. **`content` en `tailwind.config.js`**: escanea `app/public/*.html` y
   `app/public/**/*.{html,js}` — cualquier HTML/JS nuevo bajo `public/` ya queda cubierto
   sin tocar la config.

3. **No edites los archivos compilados** (`common.css`, `output-*.css`) — edita el
   `input-*.css` correspondiente y recompila. Se sobrescriben en cada build (ver
   `CLAUDE.md`).

## 🛠️ Troubleshooting

### El CSS no se actualiza
```bash
# Elimina el bundle afectado y regenera
rm app/public/css/output-admin.css
npm run build:css:admin
```

### Las clases dinámicas no funcionan
1. Verifica que la clase esté en `app/public/_tailwind-safelist.html`
2. Regenera el bundle correspondiente

### Error de browserslist
```bash
npx update-browserslist-db@latest
```

## 🎨 Añadir Nuevas Clases Dinámicas

Si añades nuevas clases generadas dinámicamente en JavaScript:

1. Añádelas a `app/public/_tailwind-safelist.html`:
```html
<div class="bg-nuevo-color-600 hover:bg-nuevo-color-700"></div>
```

2. Regenera el bundle afectado (o todos):
```bash
npm run build:css
```

---

## Referencias

- `docs/CSS_COMPILATION_GUIDE.md` — qué bundle carga cada página y estructura de carpetas
- `CLAUDE.md` — comandos de CSS resumidos

## 🛠️ Troubleshooting

### El CSS no se actualiza
```bash
# Elimina el archivo y regenera
rm app/public/css/output.css
npm run build:css
```

### Las clases dinámicas no funcionan
1. Verifica que la clase esté en `_tailwind-safelist.html`
2. O agrégala al `safelist` en `tailwind.config.js`
3. Regenera el CSS

### Error de browserslist
```bash
npx update-browserslist-db@latest
```

## 🎨 Añadir Nuevas Clases Dinámicas

Si añades nuevas clases que se generan dinámicamente en JavaScript:

1. **Opción A**: Añadirlas a `_tailwind-safelist.html`
```html
<div class="bg-nuevo-color-600 hover:bg-nuevo-color-700"></div>
```

2. **Opción B**: Añadirlas al array `safelist` en `tailwind.config.js`
```javascript
safelist: [
    'bg-nuevo-color-600',
    'hover:bg-nuevo-color-700',
]
```

3. Regenerar el CSS:
```bash
npm run build:css
```

---

**Última actualización**: 18 de enero de 2026
