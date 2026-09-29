# Estructura CSS Modularizada

Este proyecto ahora tiene un CSS común y archivos específicos por sección, compilados dinámicamente desde Tailwind CSS.

## Archivos CSS

| Archivo | Entrada | Salida | Usado por |
|---------|---------|--------|-----------|
| `input-common.css` | `/css/input-common.css` | `/css/common.css` | `admin.html`, `jugador.html`, `presentador.html`, `index.html` (Base compartida) |
| `input-admin.css` | `/css/input-admin.css` | `/css/output-admin.css` | `admin.html` (Panel de administración) |
| `input-player.css` | `/css/input-player.css` | `/css/output-player.css` | `jugador.html` (Jugadores) |
| `input-presenter.css` | `/css/input-presenter.css` | `/css/output-presenter.css` | `presentador.html` (Presentador/Lobby) |
| `input-index.css` | `/css/input-index.css` | `/css/output-index.css` | `index.html` (Inicio) |
| `tv.css` | Manual | `tv.css` | `tv.html` (Modo TV - no compilado desde Tailwind) |

## Comandos de Compilación

### Compilar TODOS los CSS
```bash
npm run build:css
```

### Compilar CSS individual
```bash
npm run build:css:admin      # Admin panel
npm run build:css:player     # Player
npm run build:css:presenter  # Presenter/Lobby
npm run build:css:common     # Base compartida
npm run build:css:index      # Home
```

### Watch/desarrollo (compilación automática)
```bash
npm run watch:css            # Watch todos los archivos
npm run watch:css:common     # Watch common
npm run watch:css:admin      # Watch solo admin
npm run watch:css:player     # Watch solo player
npm run watch:css:presenter  # Watch solo presenter
npm run watch:css:index      # Watch solo index
```

## Cómo funciona

1. `input-common.css` incluye directivas de Tailwind y estilos compartidos:
   - `@tailwind base;` - Reset y estilos base
   - `@tailwind components;` - Componentes personalizados
   - `@tailwind utilities;` - Utilidades de Tailwind

2. Tailwind usa el `tailwind.config.js` para buscar clases en `./app/public/**/*.{html,js}`

3. Se genera `common.css` (base compartida) y un `output-*.css` optimizado para cada sección

## Ventajas

- ✅ Base compartida con estilos comunes
- ✅ Cada sección carga solo su CSS específico
- ✅ Faster load times (archivos más pequeños)
- ✅ Mejor mantenimiento (CSS específico por sección)
- ✅ Reducción de desorden visual (clases solo relevantes)

## Notas

- El `tailwind.config.js` permanece sin cambios y se usa para TODAS las compilaciones
- Los archivos CSS se minifican automáticamente en producción
- Los estilos compartidos viven en `input-common.css`
- Los estilos específicos están en la sección `@layer components` de cada `input-*.css`

---

**Última actualización:** 8 de febrero de 2026
