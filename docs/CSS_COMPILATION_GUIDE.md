# 📋 GUÍA DE COMPILACIÓN CSS SEPARADOS

## ✅ Cambios Realizados

Se ha modularizado la estructura CSS en un archivo común y archivos específicos por sección:

### 📁 Archivos CREADOS:
1. ✅ `/css/input-common.css` → Compila a `/css/common.css`
2. ✅ `/css/input-admin.css` → Compila a `/css/output-admin.css`
3. ✅ `/css/input-player.css` → Compila a `/css/output-player.css`
4. ✅ `/css/input-presenter.css` → Compila a `/css/output-presenter.css`
5. ✅ `/css/input-index.css` → Compila a `/css/output-index.css`

### 📝 Archivos ACTUALIZADOS:
1. ✅ `package.json` - Nuevos comandos npm para compilar cada CSS
2. ✅ `admin.html` - Ahora carga `common.css` + `output-admin.css`
3. ✅ `jugador.html` - Ahora carga `common.css` + `output-player.css`
4. ✅ `presentador.html` - Ahora carga `common.css` + `output-presenter.css`
5. ✅ `index.html` (home) - Ahora carga `common.css` + `output-index.css`

### 🚫 SIN CAMBIOS (como se solicitó):
- `tv.html` - Sigue usando `tv.css` (no modificado)

---

## 🔧 PRÓXIMO PASO: COMPILAR LOS CSS

Ejecuta un de los siguientes comandos en el servidor `(/volume2/docker/xiro)`:

### Opción 1: Compilar TODO (Recomendado)
```bash
npm run build:css
```
Esto compila los archivos CSS en paralelo y genera:
- `common.css`
- `output-admin.css`
- `output-player.css`
- `output-presenter.css`
- `output-index.css`

### Opción 2: Compilar individual
```bash
npm run build:css:admin       # Solo panel admin
npm run build:css:player      # Solo jugador/home
npm run build:css:presenter   # Solo presentador
npm run build:css:common      # Base compartida
npm run build:css:index       # Solo página de inicio
```

### Opción 3: WATCH (desarrollo)
```bash
npm run watch:css             # Recompila automáticamente al cambiar archivos
```

---

## 📊 Estructura después de compilación

```
/app/public/css/
├── input-common.css ---→ [Tailwind] → common.css (cargado en admin/jugador/presentador/index)
├── input-admin.css ----→ [Tailwind] → output-admin.css (cargado en admin.html)
├── input-player.css ----→ [Tailwind] → output-player.css (cargado en jugador.html)
├── input-presenter.css →→ [Tailwind] → output-presenter.css (cargado en presentador.html)
├── input-index.css ----→ [Tailwind] → output-index.css (cargado en index.html)
├── tv.css (sin cambios)
├── jugador.css
├── drag-drop.css
└── fireworks.css
```

---

## ⚠️ IMPORTANTE

1. ✅ Los archivos `input-*.css` YA ESTÁN CREADOS
2. ✅ Los HTML YA ESTÁN ACTUALIZADOS
3. ✅ El `package.json` YA TIENE LOS NUEVOS COMANDOS
4. ⏳ **FALTA:** Ejecutar `npm run build:css` EN EL SERVIDOR para generar los `output-*.css`

---

## ✨ VENTAJAS DE ESTA ESTRUCTURA

- 🎯 Cada página carga **SOLO** el CSS que necesita
- 📉 Archivos más pequeños = Carga más rápida
- 🔒 Mejor encapsulación de estilos por sección
- 🛠️ Más fácil mantener y actualizar CSS específico

---

**Debes ejecutar `npm run build:css` en el servidor para que los archivos CSS se generen correctamente.**

¿Lo haces ahora o necesitas ayuda?
