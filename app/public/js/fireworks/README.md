# Sistema de Fuegos Artificiales para Podio Final

## Descripción
Sistema modular de fuegos artificiales de fondo para la pantalla del podio final del juego.

## Estructura de Archivos

```
app/public/
├── css/
│   └── fireworks.css                 # Estilos para canvas de fuegos
└── js/
    ├── fireworks/
    │   ├── utils.js                  # Utilidades matemáticas y helpers
    │   ├── stage.js                  # Gestión de canvas (Stage class)
    │   ├── particles.js              # Partículas (Star, Spark, BurstFlash)
    │   ├── shells.js                 # Tipos de fuegos artificiales (Shell class)
    │   └── fireworks.js              # Controlador principal (FireworksController)
    └── presenter/
        └── presenter-podio.js         # Renderizado del podio (integrado)
```

## Integración en HTML

Los scripts deben cargarse en el siguiente orden en tu archivo HTML principal:

### Opción 1: Scripts tradicionales (sin módulos ES6)

```html
<!-- CSS de Fuegos Artificiales -->
<link rel="stylesheet" href="/css/fireworks.css">

<!-- Scripts de Fuegos Artificiales (en orden de dependencias) -->
<script src="/js/fireworks/utils.js"></script>
<script src="/js/fireworks/stage.js"></script>
<script src="/js/fireworks/particles.js"></script>
<script src="/js/fireworks/shells.js"></script>
<script src="/js/fireworks/fireworks.js"></script>

<!-- Luego tus otros scripts -->
<script type="module" src="/js/presenter/presenter-main.js"></script>
```

### Opción 2: Módulos ES6 (Recomendado)

Si deseas usar módulos ES6, primero debes convertir los archivos de fireworks:

1. Añadir `export` a las clases y funciones principales en cada archivo
2. Usar `import` en fireworks.js para importar dependencias
3. Cargar como módulo:

```html
<link rel="stylesheet" href="/css/fireworks.css">
<script type="module" src="/js/fireworks/fireworks.js"></script>
<script type="module" src="/js/presenter/presenter-main.js"></script>
```

## Uso

### Inicialización Automática

El sistema se inicia automáticamente cuando se renderiza el podio:

```javascript
import { renderPodio } from './presenter-podio.js';

// Los fuegos se inician automáticamente al renderizar
renderPodio(rankingData);
```

### Limpieza

Cuando cambies de pantalla, asegúrate de limpiar los recursos:

```javascript
import { cleanupPodio } from './presenter-podio.js';

// Llamar antes de cambiar de pantalla
cleanupPodio();
```

### Ejemplo de integración en presenter-utils.js

```javascript
import { cleanupPodio } from './presenter-podio.js';

export function changeScreen(newScreen) {
    // Limpiar podio si estamos saliendo de él
    if (currentScreen === 'podio') {
        cleanupPodio();
    }
    
    // Continuar con el cambio de pantalla...
}
```

## Configuración

Puedes personalizar los fuegos artificiales modificando los parámetros en `presenter-podio.js`:

```javascript
fireworksController.setShellSize(2);      // Tamaño (0-4): 0=pequeño, 4=enorme
fireworksController.setAutoLaunch(true);  // Lanzamiento automático
fireworksController.setFinaleMode(false); // Modo finale (muchos fuegos)
```

## Características

- **Modular**: Cada componente está en su propio archivo
- **Rendimiento optimizado**: Sistema de pooling de objetos
- **Múltiples tipos de fuegos**:
  - Crysanthemum
  - Ring
  - Palm
  - Crossette
  - Crackle
  - Floral
  - Willow
- **Efectos visuales**:
  - Glitter (light, medium, heavy, thick)
  - Pistil (núcleo interno)
  - Streamers (estelas)
  - Burst flash (destellos)
- **Canvas dual**:
  - trails-canvas: Rastros de partículas con fade
  - main-canvas: Puntos brillantes de estrellas

## Rendimiento

- Usa `requestAnimationFrame` para animación fluida
- Sistema de pooling evita creación/destrucción constante de objetos
- Canvas con `mix-blend-mode: lighten` para efectos de luz
- Canvas escalado para alto DPI
- Límite de timeStep para evitar saltos en caso de lag

## Dependencias

- Ninguna dependencia externa
- JavaScript vanilla
- Canvas API nativa
- Solo requiere un navegador moderno con soporte para Canvas2D y requestAnimationFrame

## Troubleshooting

### Los fuegos no se muestran

1. Verifica que el CSS esté cargado
2. Verifica que los scripts se carguen en el orden correcto
3. Verifica la consola para errores
4. Asegúrate de que `FireworksController` esté definido globalmente

### Los fuegos se quedan en pantalla al cambiar

1. Asegúrate de llamar `cleanupPodio()` antes de cambiar de pantalla
2. Verifica que el contenedor se elimine correctamente

### Rendimiento bajo

1. Reduce el tamaño de los fuegos: `setShellSize(1)` o `setShellSize(0)`
2. Desactiva el modo finale si está activo
3. Verifica que no haya múltiples instancias ejecutándose

## Licencia

Sistema basado en el proyecto de fuegos artificiales de Caleb Miller (https://codepen.io/MillerTime/pen/XgpNwb)
Adaptado y modularizado para Xiro!
