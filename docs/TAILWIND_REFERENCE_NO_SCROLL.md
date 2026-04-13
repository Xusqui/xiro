# 📖 Guía de Referencia Rápida: Clases Tailwind Mobile-First No-Scroll

## 🎯 Clases Esenciales para No-Scroll Layout

### 1️⃣ Contenedor Principal

| Clase | Propósito | Alternativa | Por qué esta |
|-------|-----------|-------------|--------------|
| `h-dvh` | Altura 100dvh (viewport dinámico) | `h-screen` (100vh) | Excluye barra URL en móviles |
| `h-screen` | Altura 100vh (fallback) | `h-full` | Si dvh no disponible |
| `w-screen` | Ancho 100vw | `w-full` | Garantiza ancho completo |
| `flex` | Activa flexbox | `grid` | Mejor para layout vertical |
| `flex-col` | Dirección vertical | `flex-row` | Stack vertical de elementos |
| `overflow-hidden` | **SIN SCROLL** | `overflow-auto` | **CRÍTICO** para no-scroll |

**Ejemplo Completo:**
```html
<div class="h-dvh w-screen flex flex-col overflow-hidden">
  <!-- Contenido aquí -->
</div>
```

---

### 2️⃣ Distribución de Espacio (Flexbox)

| Clase | Propósito | Comportamiento | Uso |
|-------|-----------|----------------|-----|
| `shrink-0` | No se comprime | Mantiene tamaño fijo | Header, pregunta |
| `flex-1` | Toma espacio restante | Crece para llenar | Grid de respuestas |
| `flex-none` | Tamaño fijo | No crece ni se comprime | Elementos estáticos |
| `grow` | Solo crece | Puede crecer, no encoge | Áreas flexibles |

**Ejemplo:**
```html
<div class="flex flex-col h-dvh">
  <div class="shrink-0">Header (fijo)</div>
  <div class="shrink-0 max-h-[25vh]">Pregunta (limitada)</div>
  <div class="flex-1">Respuestas (resto del espacio)</div>
</div>
```

---

### 3️⃣ Límites de Altura (Crítico)

| Clase | Altura | Uso | Efecto |
|-------|--------|-----|--------|
| `max-h-[25vh]` | Máximo 25% viewport | Pregunta | Limita crecimiento |
| `max-h-[30vh]` | Máximo 30% viewport | Pregunta larga | Más espacio |
| `max-h-[20vh]` | Máximo 20% viewport | Pregunta corta | Menos espacio |
| `min-h-[10vh]` | Mínimo 10% viewport | Evitar colapso | Altura mínima |
| `h-[25vh]` | Exacto 25% viewport | Fijo | No flexible |

**Recomendación:** Usar `max-h` con `overflow-y-auto` para scroll interno.

```html
<div class="max-h-[25vh] overflow-y-auto">
  Pregunta que puede ser larga pero nunca sobrepasa 25vh
</div>
```

---

### 4️⃣ Grid Layout (Respuestas 2×2)

| Clase | Propósito | Alternativa | Por qué esta |
|-------|-----------|-------------|--------------|
| `grid` | Activa grid layout | `flex` | Mejor para cuadrícula |
| `grid-cols-2` | 2 columnas | `grid-cols-1` | Layout 2×2 |
| `auto-rows-fr` | Filas iguales | `grid-rows-2` | Distribución equitativa |
| `gap-2` | Espacio entre celdas | `gap-4` | 0.5rem de separación |

**Ejemplo Completo:**
```html
<div class="grid grid-cols-2 auto-rows-fr gap-2 flex-1">
  <button>Respuesta 1</button>
  <button>Respuesta 2</button>
  <button>Respuesta 3</button>
  <button>Respuesta 4</button>
</div>
```

---

### 5️⃣ Truncado de Texto (Evitar Overflow)

| Clase | Líneas | Efecto | Uso |
|-------|--------|--------|-----|
| `line-clamp-1` | 1 línea | `"Texto largo..."` | Títulos |
| `line-clamp-2` | 2 líneas | `"Texto largo\nque..."` | Subtítulos |
| `line-clamp-3` | 3 líneas | `"Texto largo\nque sigue\ny..."` | Descripciones |
| `line-clamp-4` | 4 líneas | `"Texto muy\nlargo que\nsigue y\nsigue..."` | **Respuestas** |
| `truncate` | 1 línea (inline) | `"Texto..."` | Texto en línea |

**Ejemplo:**
```html
<span class="line-clamp-4 leading-tight">
  Respuesta muy larga que se trunca después de 4 líneas...
</span>
```

---

### 6️⃣ Tamaños de Fuente Responsive (Mobile-First)

| Clase | Móvil | Desktop (sm) | Desktop (md) | Uso |
|-------|-------|--------------|--------------|-----|
| `text-xs` | 12px | - | - | Texto mínimo |
| `text-sm` | 14px | - | - | Texto pequeño |
| `text-base` | 16px | - | - | Texto normal |
| `text-lg` | 18px | - | - | Texto grande |
| `text-xl` | 20px | - | - | Títulos |
| `text-2xl` | 24px | - | - | Títulos grandes |
| `text-3xl` | 30px | - | - | Títulos muy grandes |

**Mobile-First con Breakpoints:**
```html
<!-- Pequeño en móvil, grande en desktop -->
<h2 class="text-base sm:text-lg md:text-xl">
  Título responsive
</h2>

<!-- Muy grande en móvil, enorme en desktop -->
<h1 class="text-2xl sm:text-3xl md:text-4xl">
  Título principal
</h1>
```

**Breakpoints Tailwind:**
- `sm:` → 640px+
- `md:` → 768px+
- `lg:` → 1024px+
- `xl:` → 1280px+

---

### 7️⃣ Overflow y Scroll

| Clase | Comportamiento | Uso | Efecto |
|-------|----------------|-----|--------|
| `overflow-hidden` | **Sin scroll** | Contenedor raíz | **CRÍTICO** |
| `overflow-auto` | Scroll si necesario | Áreas con contenido variable | Scroll solo si sobrepasa |
| `overflow-y-auto` | Scroll vertical | Pregunta larga | Scroll interno |
| `overflow-x-hidden` | Sin scroll horizontal | Contenido ancho | Evita scroll lateral |

**Regla de Oro:**
```html
<!-- Contenedor raíz: NUNCA scroll -->
<div class="overflow-hidden">
  
  <!-- Áreas internas: scroll si necesario -->
  <div class="overflow-y-auto max-h-[25vh]">
    Pregunta con scroll interno
  </div>
  
</div>
```

---

### 8️⃣ Alineación y Centrado

| Clase | Eje | Efecto | Uso |
|-------|-----|--------|-----|
| `items-center` | Vertical | Centra verticalmente | Contenedores flex |
| `justify-center` | Horizontal | Centra horizontalmente | Contenedores flex |
| `text-center` | Texto | Centra texto | Elementos de texto |
| `items-start` | Vertical | Alinea arriba | Contenido al inicio |
| `items-end` | Vertical | Alinea abajo | Contenido al final |

**Ejemplo:**
```html
<div class="flex items-center justify-center h-[25vh]">
  Contenido centrado vertical y horizontalmente
</div>
```

---

### 9️⃣ Espaciado (Padding y Margin)

| Clase | Tamaño | Uso | Equivalente |
|-------|--------|-----|-------------|
| `p-2` | 0.5rem (8px) | Padding pequeño | - |
| `p-4` | 1rem (16px) | Padding normal | - |
| `p-6` | 1.5rem (24px) | Padding grande | - |
| `px-4` | Horizontal 1rem | Padding lateral | `pl-4 pr-4` |
| `py-2` | Vertical 0.5rem | Padding arriba/abajo | `pt-2 pb-2` |
| `gap-2` | 0.5rem | Espacio entre elementos grid | - |

**Convención:**
- `1 = 0.25rem = 4px`
- `2 = 0.5rem = 8px`
- `4 = 1rem = 16px`
- `6 = 1.5rem = 24px`

---

### 🔟 Colores (Paleta XIRO!)

| Clase | Color | Uso | Ejemplo |
|-------|-------|-----|---------|
| `bg-red-500` | Rojo | Respuesta 1 | `bg-red-500` |
| `bg-blue-500` | Azul | Respuesta 2 | `bg-blue-500` |
| `bg-yellow-500` | Amarillo | Respuesta 3 | `bg-yellow-500` |
| `bg-green-500` | Verde | Respuesta 4, Correcto | `bg-green-500` |
| `bg-purple-500` | Púrpura | Brand, Headers | `bg-purple-600` |
| `bg-slate-900` | Gris oscuro | Fondo | `bg-slate-900` |
| `bg-white` | Blanco | Pregunta | `bg-white` |

**Variantes de Intensidad:**
- `100-200` → Muy claro
- `300-400` → Claro
- `500-600` → Normal (recomendado)
- `700-800` → Oscuro
- `900` → Muy oscuro

---

## 🎨 Combinaciones Comunes

### Layout Principal No-Scroll
```html
<div class="h-dvh w-screen flex flex-col overflow-hidden bg-slate-900">
  <div class="shrink-0 bg-purple-600 p-4">Header</div>
  <div class="shrink-0 max-h-[25vh] overflow-y-auto bg-white p-4">Pregunta</div>
  <div class="flex-1 grid grid-cols-2 auto-rows-fr gap-2 p-2">
    <button class="bg-red-500 rounded-2xl">Respuesta</button>
  </div>
</div>
```

### Botón de Respuesta Completo
```html
<button class="
  bg-red-500 
  rounded-2xl 
  shadow-lg 
  flex flex-col 
  items-center 
  justify-center 
  p-3 
  border-b-4 border-black/20 
  active:scale-95 
  transition-transform 
  overflow-hidden
">
  <span class="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center font-black text-xl mb-2 text-white shrink-0">
    1
  </span>
  <span class="text-white font-bold text-lg uppercase line-clamp-4 leading-tight">
    Texto de Respuesta
  </span>
</button>
```

### Pregunta Adaptativa
```html
<div class="
  bg-white 
  px-4 py-4 
  max-h-[25vh] 
  flex items-center justify-center 
  shrink-0 
  overflow-y-auto 
  border-b-8 border-purple-600
">
  <h2 class="text-xl sm:text-2xl font-black uppercase italic leading-tight text-center">
    ¿Pregunta?
  </h2>
</div>
```

---

## 🔍 Debugging: Clases de Ayuda

### Bordes de Debug
```html
<!-- Agregar temporalmente para ver límites -->
<div class="border-2 border-red-500">Ver límites</div>
<div class="border-4 border-blue-500">Ver límites más grueso</div>
```

### Fondos de Debug
```html
<!-- Colores temporales para visualizar secciones -->
<div class="bg-red-200">Sección 1</div>
<div class="bg-blue-200">Sección 2</div>
<div class="bg-green-200">Sección 3</div>
```

### Ver Overflow
```html
<!-- Cambiar temporalmente overflow-hidden a overflow-visible -->
<div class="overflow-visible border-2 border-red-500">
  ¿Se desborda?
</div>
```

---

## ⚡ Clases de Performance

| Clase | Propósito | Cuándo usar |
|-------|-----------|-------------|
| `will-change-transform` | Optimiza animaciones | Botones con hover |
| `transform-gpu` | Acelera transformaciones | Animaciones complejas |
| `transition-transform` | Transición suave | Efectos hover/active |
| `transition-colors` | Transición de colores | Cambios de color |

---

## 🎯 Checklist de Clases No-Scroll

**Para Contenedor Raíz:**
- [ ] `h-dvh` o `h-screen`
- [ ] `w-screen`
- [ ] `flex flex-col`
- [ ] `overflow-hidden` ← **CRÍTICO**

**Para Header:**
- [ ] `shrink-0`

**Para Pregunta:**
- [ ] `max-h-[25vh]` (o 20vh, 30vh)
- [ ] `shrink-0`
- [ ] `overflow-y-auto` (scroll interno si necesario)

**Para Grid de Respuestas:**
- [ ] `grid grid-cols-2`
- [ ] `auto-rows-fr`
- [ ] `flex-1` ← **CRÍTICO**
- [ ] `overflow-hidden`

**Para Texto de Respuestas:**
- [ ] `line-clamp-4` (o 3, 5)
- [ ] `leading-tight`
- [ ] Tamaño responsive: `text-base sm:text-lg`

---

## 📐 Valores de Referencia

### Alturas Recomendadas
| Elemento | Clase | % del Viewport |
|----------|-------|----------------|
| Header | `h-[8vh]` | 8% |
| Pregunta | `max-h-[25vh]` | 25% máximo |
| Respuestas | `flex-1` | ~67% (resto) |

### Gaps Recomendados
| Uso | Clase | Tamaño |
|-----|-------|--------|
| Entre botones | `gap-2` | 8px |
| Entre secciones | `gap-4` | 16px |
| Padding botón | `p-3` | 12px |
| Padding sección | `p-4` | 16px |

### Tamaños de Fuente por Longitud
| Longitud Texto | Pregunta | Respuesta |
|----------------|----------|-----------|
| < 50 chars | `text-2xl` | `text-lg` |
| 50-80 chars | `text-xl` | `text-base` |
| 80-120 chars | `text-lg` | `text-sm` |
| > 120 chars | `text-base` | `text-xs` |

---

## 🚀 Quick Start Template

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @layer utilities {
            .h-dvh { height: 100dvh; }
            @supports not (height: 100dvh) {
                .h-dvh { height: 100vh; }
            }
        }
    </style>
</head>
<body>
    <div class="h-dvh w-screen flex flex-col overflow-hidden bg-slate-900">
        <div class="shrink-0 bg-purple-600 px-4 py-2 text-center">
            <p class="text-white font-black text-lg uppercase">JUGADOR</p>
        </div>
        
        <div class="bg-white px-4 py-4 max-h-[25vh] flex items-center justify-center shrink-0 overflow-y-auto border-b-8 border-purple-600">
            <h2 class="text-xl sm:text-2xl font-black uppercase italic leading-tight">
                ¿Pregunta?
            </h2>
        </div>
        
        <div class="grid grid-cols-2 auto-rows-fr gap-2 flex-1 p-2 bg-slate-200 overflow-hidden">
            <button class="bg-red-500 rounded-2xl shadow-lg flex flex-col items-center justify-center p-3 border-b-4 border-black/20 active:scale-95 transition-transform overflow-hidden">
                <span class="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center font-black text-xl mb-2 text-white shrink-0">1</span>
                <span class="text-white font-bold text-lg uppercase line-clamp-4 leading-tight">RESPUESTA 1</span>
            </button>
            <button class="bg-blue-500 rounded-2xl shadow-lg flex flex-col items-center justify-center p-3 border-b-4 border-black/20 active:scale-95 transition-transform overflow-hidden">
                <span class="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center font-black text-xl mb-2 text-white shrink-0">2</span>
                <span class="text-white font-bold text-lg uppercase line-clamp-4 leading-tight">RESPUESTA 2</span>
            </button>
            <button class="bg-yellow-500 rounded-2xl shadow-lg flex flex-col items-center justify-center p-3 border-b-4 border-black/20 active:scale-95 transition-transform overflow-hidden">
                <span class="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center font-black text-xl mb-2 text-white shrink-0">3</span>
                <span class="text-white font-bold text-lg uppercase line-clamp-4 leading-tight">RESPUESTA 3</span>
            </button>
            <button class="bg-green-500 rounded-2xl shadow-lg flex flex-col items-center justify-center p-3 border-b-4 border-black/20 active:scale-95 transition-transform overflow-hidden">
                <span class="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center font-black text-xl mb-2 text-white shrink-0">4</span>
                <span class="text-white font-bold text-lg uppercase line-clamp-4 leading-tight">RESPUESTA 4</span>
            </button>
        </div>
    </div>
</body>
</html>
```

---

## 💡 Tips Finales

1. **Siempre empezar con `h-dvh overflow-hidden`** en el contenedor raíz
2. **Usar `max-h` en lugar de `h`** para flexibilidad
3. **Combinar `flex-1` con `overflow-hidden`** para evitar desbordamiento
4. **Mobile-first:** Clases base para móvil, `sm:` para desktop
5. **Testing:** Probar en dispositivo real, no solo emulador
6. **Debugging:** Usar `border-2 border-red-500` temporalmente

---

**Referencia completa de Tailwind CSS:** https://tailwindcss.com/docs
