/**
 * @fileoverview Overlay decorativo del camaleón
 * Muestra una imagen aleatoria de /images/chamaleon/ en una esquina
 * durante la presentación de preguntas. Opacidad 0.5, z-index alto.
 */

const CHAMALEON_IMAGES = [
    'afraid.svg', 'albanil.svg', 'angry.svg', 'astronauta.svg', 'bailarina.svg',
    'branch.svg', 'busca-tesoros.svg', 'chamaleon.svg', 'cooking.svg', 'cool.svg',
    'detective.svg', 'disguise.svg', 'dizzy.svg', 'gamer.svg', 'gaming.svg',
    'gris.svg', 'hello.svg', 'inteligencia-artificial.svg', 'jardinero.svg', 'jetpack.svg',
    'love.svg', 'mago.svg', 'musico.svg', 'nerd.svg', 'painting.svg',
    'party.svg', 'pastelero.svg', 'pintor.svg', 'pirata.svg', 'planting.svg',
    'pointing.svg', 'quimico.svg', 'running.svg', 'searching.svg', 'sleep.svg',
    'surfero.svg', 'thinking.svg', 'thumbs_up.svg', 'worker.svg', 'yoda.svg',
    'leyendo.svg', 'thumbs_down.svg', 'farewell.svg'
];

// Solo esquinas inferiores para no tapar la pregunta
const CORNERS = [
    { top: '', left: '16px', bottom: '16px', right: '' },
    { top: '', left: '', bottom: '16px', right: '220px' }
];

const OVERLAY_ID = 'chamaleon-overlay';
const IMG_SIZE = 170; // px

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
    do { imgIndex = Math.floor(Math.random() * CHAMALEON_IMAGES.length); }
    while (CHAMALEON_IMAGES[imgIndex] === _lastImage && CHAMALEON_IMAGES.length > 1);
    const img = CHAMALEON_IMAGES[imgIndex];
    _lastImage = img;

    // Elegir esquina diferente a la anterior
    let cornerIndex;
    do { cornerIndex = Math.floor(Math.random() * CORNERS.length); }
    while (cornerIndex === _lastCorner && CORNERS.length > 1);
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
    ].filter(Boolean).join('; ');

    const image = document.createElement('img');
    image.src = `/images/chamaleon/${img}`;
    image.alt = '';
    image.style.cssText = `width: ${IMG_SIZE}px; height: ${IMG_SIZE}px; object-fit: contain; display: block;`;

    el.appendChild(image);
    document.body.appendChild(el);
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
