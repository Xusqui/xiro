/**
 * @fileoverview Overlay decorativo del camaleón
 * Muestra una imagen aleatoria de /images/chamaleon/ en una esquina
 * durante la presentación de preguntas. Opacidad 0.5, z-index alto.
 */

const CHAMALEON_IMAGES = [
    'afraid.svg',
    'albanil.svg',
    'angry.svg',
    'astronauta.svg',
    'bailarina.svg',
    'banco-de-preguntas.svg',
    'branch.svg',
    'busca-tesoros.svg',
    'chamaleon.svg',
    'cooking.svg',
    'cool.svg',
    'detective.svg',
    'disguise.svg',
    'dizzy.svg',
    'farewell.svg',
    'gameover.svg',
    'gamer.svg',
    'gaming.svg',
    'gris.svg',
    'hello.svg',
    'inteligencia-artificial.svg',
    'jardinero.svg',
    'jetpack.svg',
    'juegos-personalizados.svg',
    'leyendo.svg',
    'love.svg',
    'mago.svg',
    'mezcla-de-preguntas.svg',
    'musico.svg',
    'nerd.svg',
    'painting.svg',
    'party.svg',
    'pastelero.svg',
    'pintor.svg',
    'pirata.svg',
    'planting.svg',
    'pointing.svg',
    'pregunta-ia.svg',
    'quimico.svg',
    'running.svg',
    'searching.svg',
    'sleep.svg',
    'subir-preguntas.svg',
    'surfero.svg',
    'thinking.svg',
    'thumbs_down.svg',
    'thumbs_up.svg',
    'trivial-pursuit.svg',
    'worker.svg',
    'yoda.svg'
];

const OVERLAY_ID = 'chamaleon-overlay';
// Proporcional a la pantalla: 170 px a 1920x1080, 113 px a 1280x720
const IMG_SIZE = '15.75vmin';

// Solo esquinas inferiores para no tapar la pregunta. La derecha va pegada por
// dentro al borde de la columna de jugadores (--stage-side, presenter.css) para
// no quedar detrás de «Siguiente»; sin columna (móvil), en la esquina.
const CORNERS = [
    { top: '', left: '16px', bottom: '16px', right: '' },
    { top: '', left: '', bottom: '16px', right: `max(16px, calc(var(--stage-side, 0px) - ${IMG_SIZE}))` }
];

let _lastImage = null;
let _lastCorner = -1;

/**
 * Muestra el overlay del camaleón con imagen y esquina aleatorias.
 * Garantiza que imagen y esquina cambien respecto a la pregunta anterior.
 * Si ya existe uno, lo reemplaza.
 */
export function showChamaleonOverlay() {
    // El anterior (si existe) se desvanece en vez de desaparecer de golpe;
    // se libera el id de inmediato para que el nuevo overlay pueda usarlo.
    const previous = document.getElementById(OVERLAY_ID);
    if (previous) {
        previous.removeAttribute('id');
        previous.classList.remove('chamaleon-overlay-enter');
        previous.classList.add('chamaleon-overlay-exit');
        setTimeout(() => previous.remove(), 350);
    }

    // Elegir imagen diferente a la anterior
    let imgIndex;
    do {
        imgIndex = Math.floor(Math.random() * CHAMALEON_IMAGES.length);
    } while (CHAMALEON_IMAGES[imgIndex] === _lastImage && CHAMALEON_IMAGES.length > 1);
    const img = CHAMALEON_IMAGES[imgIndex];
    _lastImage = img;

    // Elegir esquina diferente a la anterior
    let cornerIndex;
    do {
        cornerIndex = Math.floor(Math.random() * CORNERS.length);
    } while (cornerIndex === _lastCorner && CORNERS.length > 1);
    const corner = CORNERS[cornerIndex];
    _lastCorner = cornerIndex;

    const el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'chamaleon-overlay-enter';
    el.style.cssText = [
        'position: fixed',
        corner.top ? `top: ${corner.top}` : '',
        corner.bottom ? `bottom: ${corner.bottom}` : '',
        corner.left ? `left: ${corner.left}` : '',
        corner.right ? `right: ${corner.right}` : '',
        'z-index: 500',
        'pointer-events: none'
    ]
        .filter(Boolean)
        .join('; ');

    el.appendChild(createChamaleonImage(img));
    document.body.appendChild(el);
}

/**
 * Imagen de la mascota con el tamaño proporcional a la pantalla.
 * @param {string} file - Fichero de /images/chamaleon/
 * @returns {HTMLImageElement}
 */
export function createChamaleonImage(file) {
    const image = document.createElement('img');
    image.src = `/images/chamaleon/${file}`;
    image.alt = '';
    image.style.cssText = `width: ${IMG_SIZE}; height: ${IMG_SIZE}; object-fit: contain; display: block;`;
    return image;
}

/**
 * Elimina el overlay del camaleón si existe, con un fundido de salida.
 */
export function hideChamaleonOverlay() {
    const el = document.getElementById(OVERLAY_ID);
    if (!el) return;
    el.removeAttribute('id');
    el.classList.remove('chamaleon-overlay-enter');
    el.classList.add('chamaleon-overlay-exit');
    setTimeout(() => el.remove(), 350);
}
