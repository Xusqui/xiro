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
/**
 * Mayúsculas solo si todas las opciones son cortas: a partir de ~40
 * caracteres, las frases en mayúsculas con guiones («ESPECIA-LIZADOS»)
 * cuestan de leer. La clase es común a todas las opciones de la pregunta
 * para no mezclar opciones en mayúsculas y en minúsculas.
 * Devuelve solo un nombre de clase, y así el texto del editor no aparece
 * en la interpolación HTML.
 *
 * @param {Array<string>} [texts] - Textos de todas las opciones de la pregunta
 */
export function optionCaseClass(texts = []) {
    const tooLong = texts.some((text) => String(text || '').length > 40);
    return tooLong ? 'normal-case' : 'uppercase';
}

/**
 * Ajusta el texto de cada botón de opción (quiz, selección múltiple) al
 * mayor tamaño que cabe en su tarjeta, entre un mínimo legible y un máximo.
 * Sustituye en la práctica a la clase por longitud de getResponsiveFontClass,
 * que daba 2rem a textos de 80-120 caracteres y se salían de la tarjeta.
 * Se repite al cargar las fuentes y al girar el móvil (cambian las medidas).
 *
 * @param {string} [textSelector] - Textos a ajustar; su caja es el botón padre
 */
export function fitOptionButtonText(textSelector = 'button .btn-text') {
    const fitAll = () => {
        document.querySelectorAll(textSelector).forEach((text) => {
            const box = text.closest('button');
            if (!box || box.clientHeight === 0) return;
            const fits = () => box.scrollHeight <= box.clientHeight && box.scrollWidth <= box.clientWidth
                && text.scrollWidth <= text.clientWidth;
            const largestFit = () => {
                let low = 11;
                let high = Math.max(low, Math.min(box.clientHeight * 0.3, 40));
                while (high - low > 0.5) {
                    const mid = (low + high) / 2;
                    text.style.fontSize = `${mid}px`;
                    if (fits()) low = mid;
                    else high = mid;
                }
                return Math.floor(low);
            };

            // Sin cortar palabras («SATURNO», no «SA-TURNO») mientras se lea
            // bien (>= 18 px); con una palabra muy larga, mejor guion que letra diminuta
            // Valores explícitos (no los previos): una segunda pasada al cargar
            // fuentes o girar el móvil no debe heredar el estado de la anterior.
            // -webkit-hyphens: Safari parte con él aunque hyphens diga otra cosa.
            const allowBreaks = (allow) => {
                text.style.setProperty('hyphens', allow ? 'auto' : 'manual');
                text.style.setProperty('-webkit-hyphens', allow ? 'auto' : 'manual');
                text.style.setProperty('overflow-wrap', allow ? 'break-word' : 'normal');
            };
            allowBreaks(true);
            const hyphenated = largestFit();
            allowBreaks(false);
            const wholeWords = largestFit();
            if (wholeWords >= Math.min(18, hyphenated)) {
                text.style.fontSize = `${wholeWords}px`;
            } else {
                allowBreaks(true);
                text.style.fontSize = `${hyphenated}px`;
            }
        });
    };

    fitAll();
    document.fonts?.ready?.then(fitAll);
    if (!fitOptionButtonText.resizeBound) {
        fitOptionButtonText.resizeBound = true;
        window.addEventListener('resize', () => fitOptionButtonText.lastFit?.());
    }
    fitOptionButtonText.lastFit = fitAll;
}

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
