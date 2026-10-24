/**
 * @fileoverview Player - Trivial: el dado pasa a la cabecera al elegir casilla
 *
 * Tras tirar, el dado deja el centro de la pantalla y se queda pequeño (56 px)
 * a la izquierda de «¿Dónde te mueves?», con la cara que salió, para que hasta
 * 7 casillas quepan sin scroll. Animación FLIP: se mide el dado antes y después
 * del cambio y el envoltorio viaja desde su sitio anterior; el encogido lo hace
 * la transición de .dice-scene en dice3d.css, con la misma duración y curva.
 */

const MOVE_MS = 420;
const FADE_MS = 260;
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function centerOf(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Pasa la pantalla del dado al modo «elegir casilla».
 * @param {HTMLElement} screen - .trivial-dice-screen
 * @param {Function} fillContent - pinta la pregunta y las casillas; se llama
 *   después de medir el dado, porque las casillas mueven el centro de la pantalla
 */
export function compactDiceHeader(screen, fillContent) {
    const wrapper = screen.querySelector('#dice-wrapper');
    const from = wrapper ? centerOf(wrapper.getBoundingClientRect()) : null;

    fillContent();
    screen.classList.add('is-choosing');
    if (!wrapper) return;
    wrapper.classList.remove('dice-clickable');
    wrapper.removeAttribute('data-player-action');
    wrapper.classList.add('disabled', 'compact');

    if (prefersReducedMotion() || typeof wrapper.animate !== 'function') return;
    const to = centerOf(wrapper.getBoundingClientRect());
    wrapper.animate([{ transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)` }, { transform: 'none' }], {
        duration: MOVE_MS,
        easing: EASE_OUT
    });
    // La pregunta y las casillas aparecen mientras el dado se coloca
    screen.querySelectorAll('.trivial-dice-text, .trivial-moves').forEach(el => {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' });
    });
}
