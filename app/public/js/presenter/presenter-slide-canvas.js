/**
 * @fileoverview Diapositiva libre (slide_type 'canvas') en la pantalla del presentador:
 * el lienzo 16:9 se encaja en #lobby-main (core/slide-canvas-render.js) y cada elemento
 * de vídeo monta su reproductor en su propio rectángulo con mountVideoMedia.
 */

import { getCurrentQuestionIndex, getTotalQuestions } from './presenter-state.js?v=20260922172926';
import { stopActiveVideo, mountVideoMedia } from './presenter-slide-video.js?v=20261019120000';
import { removeFloatingCards, showAbandonButton, showTerminateButton } from './presenter-utils.js?v=20260922172926';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260922172926';
import { cleanupPodio } from './presenter-podio.js?v=20260922172926';
import { showChamaleonOverlay } from './presenter-chamaleon.js?v=20260922172926';

let mounted = null;

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

function unsupportedHtml() {
    return `<div style="color: rgba(255,255,255,0.5); text-align: center;"><i class="fas fa-film fa-6x"></i><p style="margin-top: 1.5rem; font-size: 1.5rem; font-weight: 700;">${_t('presenter.slides.video_unsupported', null, 'No se puede reproducir este vídeo')}</p></div>`;
}

/**
 * Comprueba si una diapositiva canvas tiene algún elemento de tipo video
 * @param {Object} slide - Diapositiva canvas
 * @returns {boolean} true si hay videos, false en caso contrario
 */
export function hasCanvasVideo(slide) {
    if (!slide || !slide.slide_canvas || !Array.isArray(slide.slide_canvas.elements)) {
        return false;
    }

    for (let i = 0; i < slide.slide_canvas.elements.length; i++) {
        const element = slide.slide_canvas.elements[i];
        if (element && element.type === 'video' && element.video_source) {
            return true;
        }
    }
    return false;
}

/** Cada hueco [data-xsc-video] recibe el reproductor de su elemento (video_source lo añade el servidor). */
function mountCanvasVideos(host, canvas) {
    const elements = Array.isArray(canvas.elements) ? canvas.elements : [];
    host.querySelectorAll('[data-xsc-video]').forEach(box => {
        const element = elements[Number(box.getAttribute('data-xsc-video'))];
        if (element && element.video_source) {
            mountVideoMedia(box, element.video_source, { autoplay: element.props?.autoplay === true });
        } else {
            box.innerHTML = _tHtml(unsupportedHtml());
        }
    });
}

/**
 * Diapositiva libre en el presentador, ocupando todo el espacio disponible
 * @param {Object} slide - Objeto de diapositiva canvas
 */
export function renderCanvasSlide(slide) {
    stopActiveVideo();
    removeFloatingCards();
    cleanupRevealElements();
    cleanupPodio();
    showChamaleonOverlay();

    window.canShowRanking = false;
    window.currentSlideType = 'canvas';
    window.currentQuestionType = slide?.question_type || null;

    clearInterval(window.timerInterval);
    window.timerInterval = null;

    const lobbyMain = document.getElementById('lobby-main');
    lobbyMain.style.display = 'flex';

    // El montaje anterior deja de escuchar el resize de la ventana
    if (mounted) mounted.destroy();
    mounted = null;

    lobbyMain.innerHTML = _tHtml(`
        <div class="h-full w-full" style="background:#000;position:relative;">
            <div id="slide-canvas-host" style="position:absolute;inset:0;"></div>
            ${nextButtonHtml()}
        </div>
    `);

    const host = document.getElementById('slide-canvas-host');
    const canvas = slide && slide.slide_canvas;
    if (host && canvas) {
        mounted = window.XiroSlideCanvasRender.mount(host, canvas, { mode: 'presenter' });
        mountCanvasVideos(host, canvas);
    }

    showAbandonButton();
    showTerminateButton();
}
