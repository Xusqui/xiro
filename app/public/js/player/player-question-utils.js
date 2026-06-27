/**
 * @fileoverview Utilidades compartidas de UI del jugador
 */

export const OPTION_COLORS = [
    'btn-gradient-red',
    'btn-gradient-blue',
    'btn-gradient-yellow',
    'btn-gradient-green',
    'btn-gradient-purple',
    'btn-gradient-pink'
];

/**
 * Calcular clase de tamano de fuente segun longitud del texto.
 * `narrow` indica que el texto se renderiza en un contenedor de ~mitad
 * de ancho de pantalla (p.ej. columnas de matching), donde el mismo
 * texto necesita una fuente menor para no desbordar la caja.
 */
export function getResponsiveFontClass(text, narrow = false) {
    const length = text.length * (narrow ? 1.8 : 1);
    if (length > 180) return 'text-responsive-base';
    if (length > 120) return 'text-responsive-md';
    if (length > 80) return 'text-responsive-lg';
    if (length > 40) return 'text-adaptive';
    return 'text-adaptive-lg';
}

/**
 * Reduce progresivamente el font-size (y opcionalmente la altura mínima)
 * de los elementos marcados dentro de `container` hasta que su contenido
 * quepa sin necesidad de scroll, o hasta tocar el mínimo permitido.
 * Útil cuando el número/longitud de elementos es variable (p.ej. tarjetas
 * de matching) y no se puede fijar un tamaño de fuente de antemano.
 */
export function fitTextToContainer(container, {
    textSelector = '[data-fit-text]',
    boxSelector = '[data-fit-box]',
    minFontPx = 9,
    minBoxHeightPx = 24,
    maxSteps = 40
} = {}) {
    if (!container) return;
    const texts = Array.from(container.querySelectorAll(textSelector));
    const boxes = Array.from(container.querySelectorAll(boxSelector));
    if (!texts.length) return;

    const currentSize = (el) => parseFloat(el.style.fontSize) || parseFloat(getComputedStyle(el).fontSize);
    const currentMinHeight = (el) => parseFloat(el.style.minHeight) || parseFloat(getComputedStyle(el).minHeight) || minBoxHeightPx;

    for (let step = 0; step < maxSteps && container.scrollHeight > container.clientHeight + 1; step++) {
        let shrunkAny = false;
        texts.forEach((el) => {
            const size = currentSize(el);
            if (size > minFontPx) {
                el.style.fontSize = `${Math.max(minFontPx, size - 1)}px`;
                shrunkAny = true;
            }
        });
        boxes.forEach((el) => {
            const height = currentMinHeight(el);
            if (height > minBoxHeightPx) {
                el.style.minHeight = `${Math.max(minBoxHeightPx, height - 2)}px`;
                shrunkAny = true;
            }
        });
        if (!shrunkAny) break;
    }
}
