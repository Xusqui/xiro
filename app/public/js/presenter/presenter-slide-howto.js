/**
 * @fileoverview Diapositiva de instrucciones (slide_type 'howto') en el presentador: la animación
 * guionada de core/howto-core.js ocupa #lobby-main, con la locución en el idioma de la interfaz
 * (se reinicia si el presentador cambia de idioma). El contenido es fijo
 * en el código; de la diapositiva solo se lee `slide_howto`, que elige un tema de una lista cerrada.
 */

import { getCurrentQuestionIndex, getTotalQuestions } from './presenter-state.js?v=20260922172926';
import { removeFloatingCards, showAbandonButton, showTerminateButton } from './presenter-utils.js?v=20260922172926';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260922172926';
import { cleanupPodio } from './presenter-podio.js?v=20260922172926';
import { showChamaleonOverlay } from './presenter-chamaleon.js?v=20260922172926';

function nextButtonHtml() {
    const isLastQuestion = getCurrentQuestionIndex() >= getTotalQuestions() - 1;
    const buttonText = window.isTrivialGame
        ? _t('presenter.slides.next_round', null, 'Siguiente Ronda')
        : isLastQuestion
            ? _t('presenter.slides.view_ranking', null, 'Ver Ránking')
            : _t('presenter.slides.next', null, 'Siguiente');

    const iconClass = window.isTrivialGame ? 'fa-rotate-right' : isLastQuestion ? 'fa-trophy' : 'fa-chevron-right';

    return `<button id="btn-next" data-presenter-action="next-question" class="fixed bottom-10 right-10 bg-white text-slate-900 px-10 py-5 rounded-3xl font-black text-2xl shadow-2xl hover:bg-aubergine-600 hover:text-white transition italic uppercase" style="z-index: 10000;">
        ${buttonText}
        <i class="fas ${iconClass} ml-2"></i>
    </button>`;
}

let currentSlide = null;

/** Detiene la animación y su voz (al cambiar de diapositiva o abandonar la partida). */
export function stopHowTo() {
    if (window.XiroHowTo) window.XiroHowTo.stop();
}

/**
 * Diapositiva de instrucciones en el presentador, ocupando todo el espacio disponible
 * @param {Object} slide - Diapositiva howto ({ slide_howto: 'word_search' })
 */
export function renderHowToSlide(slide) {
    stopHowTo();
    currentSlide = slide;
    removeFloatingCards();
    cleanupRevealElements();
    cleanupPodio();
    showChamaleonOverlay();

    window.canShowRanking = false;
    window.currentSlideType = 'howto';
    window.currentQuestionType = slide?.question_type || null;

    clearInterval(window.timerInterval);
    window.timerInterval = null;

    const lobbyMain = document.getElementById('lobby-main');
    lobbyMain.style.display = 'flex';
    lobbyMain.innerHTML = _tHtml(`
        <div class="h-full w-full" style="background:#000;position:relative;">
            <div id="slide-howto-host" class="howto-host" data-i18n-skip="true"></div>
            ${nextButtonHtml()}
        </div>
    `);

    const host = document.getElementById('slide-howto-host');
    if (host && window.XiroHowTo) window.XiroHowTo.mount(host, slide?.slide_howto, { audio: true });

    showAbandonButton();
    showTerminateButton();
}

// El idioma de la locución es el de la interfaz: si cambia con la diapositiva en pantalla, se reinicia
window.addEventListener('xiro:language-changed', () => {
    if (window.currentSlideType === 'howto' && currentSlide && document.getElementById('slide-howto-host')) {
        renderHowToSlide(currentSlide);
    }
});
