/**
 * Ficheros de XiRo que se copian en scripts/lib/xiro/ (sync-xiro.mjs) y que compara el selftest
 * con el repo. Rutas relativas a la carpeta app de XiRo.
 */

export const VENDORED_FILES = [
    'public/js/core/slide-package.js',
    'public/js/core/slide-canvas-model.js',
    'public/js/core/slide-canvas-legacy.js',
    'public/js/core/slide-canvas-path.js',
    'public/js/core/slide-canvas-path-presets.js',
    'public/js/core/slide-canvas-style.js',
    'public/js/core/slide-canvas-richtext.js',
    'public/js/core/slide-canvas-richtext-html.js',
    'public/js/core/slide-canvas-table.js',
    'public/js/core/slide-canvas-chart.js',
    'public/js/core/slide-canvas-chart-data.js',
    'public/js/core/slide-canvas-chart-svg.js',
    'public/js/core/slide-canvas-chart-axes.js',
    'public/js/core/slide-canvas-chart-links.js',
    'public/js/core/slide-canvas-theme-catalog.js',
    'public/js/core/slide-canvas-theme-legibility.js',
    'public/js/core/slide-canvas-theme.js',
    'public/js/core/slide-canvas-layouts.js',
    'public/js/core/slide-canvas-shapes.js',
    'public/js/core/slide-canvas-render.js',
    'public/js/core/video-source.js',
    'public/css/slide-canvas.css',
    'application/validators/CanvasSlideValidator.js',
    'application/validators/CanvasTableSchema.js',
    'application/validators/CanvasChartSchema.js',
    'application/validators/CanvasTextSchema.js',
    'application/validators/SlidePackageValidator.js',
    'services/slide-package/import.service.js',
    'services/slide-package/svg-guard.js',
    'services/slide-package/image-type.js',
    'services/slide-package/inline-images.js',
    'services/slide-package/remote-image.js',
    'services/slide-package/public-address.js'
];

// Familias de FONTS (slide-canvas-model.js); fonts.css de XiRo trae también las de la interfaz
export const CANVAS_FONT_FAMILIES = ['DM Sans', 'Merriweather', 'Bebas Neue', 'JetBrains Mono', 'Nunito', 'Oswald', 'Playfair Display', 'Caveat'];
