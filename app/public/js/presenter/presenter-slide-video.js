/**
 * @fileoverview Renderizado de diapositivas de vídeo (solo presentador)
 */

import { getCurrentQuestionIndex, getTotalQuestions } from './presenter-state.js?v=20260922172926';
import { removeFloatingCards, showAbandonButton, showTerminateButton } from './presenter-utils.js?v=20260922172926';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260922172926';
import { cleanupPodio } from './presenter-podio.js?v=20260922172926';
import { showChamaleonOverlay } from './presenter-chamaleon.js?v=20260922172926';
import { appendSlideFooter } from '../core/slide-footer-dom.js?v=20261017120000';
import { takePreloadedVideo, createVideoElement, releaseVideo } from './presenter-video-preloader.js?v=20261019120000';

// El vídeo ocupa todo el hueco y conserva su proporción (bandas negras si hace falta)
const MEDIA_STYLE = 'width:100%;height:100%;object-fit:contain;border:0;background:#000;display:block;';
const IFRAME_ALLOW = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
const activeVideos = [];

/**
 * Para los vídeos de archivo que se están viendo y libera su memoria (al cambiar de diapositiva)
 */
export function stopActiveVideo() {
    while (activeVideos.length > 0) {
        const video = activeVideos.pop();
        releaseVideo(video);
    }
}

function nextButtonHtml() {
    const isLastQuestion = getCurrentQuestionIndex() >= getTotalQuestions() - 1;
    const buttonText = window.isTrivialGame
        ? _t('presenter.slides.next_round', null, 'Siguiente Ronda')
        : isLastQuestion
            ? _t('presenter.slides.view_ranking', null, 'Ver Ránking')
            : _t('presenter.slides.next', null, 'Siguiente');

    const iconClass = window.isTrivialGame
        ? 'fa-rotate-right'
        : isLastQuestion
            ? 'fa-trophy'
            : 'fa-chevron-right';

    return `<button id="btn-next" data-presenter-action="next-question" class="fixed bottom-10 right-10 bg-white text-slate-900 px-10 py-5 rounded-3xl font-black text-2xl shadow-2xl hover:bg-aubergine-600 hover:text-white transition italic uppercase" style="z-index: 10000;">
        ${buttonText}
        <i class="fas ${iconClass} ml-2"></i>
    </button>`;
}

function unsupportedHtml() {
    return `<div style="color: rgba(255,255,255,0.5); text-align: center;"><i class="fas fa-film fa-6x"></i><p style="margin-top: 1.5rem; font-size: 1.5rem; font-weight: 700;">${_t('presenter.slides.video_unsupported', null, 'No se puede reproducir este vídeo')}</p></div>`;
}

function buildFileVideo(url) {
    const video = takePreloadedVideo(url) || createVideoElement(url);
    video.controls = true;
    video.muted = false;
    video.style.cssText = MEDIA_STYLE;
    return video;
}

/**
 * Diapositiva de vídeo: solo en el presentador, ocupando todo el espacio disponible
 * @param {Object} slide - Objeto de diapositiva
 */
export function renderVideoSlide(slide) {
    stopActiveVideo();
    removeFloatingCards();
    cleanupRevealElements();
    cleanupPodio();
    showChamaleonOverlay();

    window.canShowRanking = false;
    window.currentSlideType = 'video';
    window.currentQuestionType = slide?.question_type || null;

    clearInterval(window.timerInterval);
    window.timerInterval = null;

    const lobbyMain = document.getElementById('lobby-main');
    lobbyMain.style.display = 'flex';

    const source = window.XiroVideoSource?.parseVideoSource(slide?.slide_video) || null;

    // Hueco inferior para que «Siguiente» no tape los controles del vídeo
    lobbyMain.innerHTML = _tHtml(`
        <div class="h-full w-full flex items-center justify-center" style="background: #111827; padding: 1.5rem 1.5rem 7.5rem; box-sizing: border-box;">
            <div id="slide-video-box" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">${source ? '' : unsupportedHtml()}</div>
            ${nextButtonHtml()}
        </div>
    `);

    if (source) mountVideoMedia(document.getElementById('slide-video-box'), source, { autoplay: true });
    appendSlideFooter(lobbyMain, slide, 'presenter');
    showAbandonButton();
    showTerminateButton();
}

/**
 * Monta el reproductor de una fuente de vídeo (archivo o embebido) dentro de una caja.
 * Lo usan la diapositiva de vídeo (siempre con autoplay) y la diapositiva libre.
 * @param {Element} box - Caja donde se monta el vídeo
 * @param {Object} source - Resultado de parseVideoSource
 * @param {Object} [options] - { autoplay } (por defecto true)
 */
export function mountVideoMedia(box, source, options = {}) {
    const autoplay = options.autoplay !== false;
    if (source.kind !== 'file') {
        const iframe = document.createElement('iframe');
        iframe.src = source.embedUrl + (autoplay ? '&autoplay=1' : '');
        iframe.allow = IFRAME_ALLOW;
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.title = 'Vídeo';
        iframe.style.cssText = MEDIA_STYLE;
        box.appendChild(iframe);
        return;
    }

    const video = buildFileVideo(source.url);
    box.appendChild(video);
    activeVideos.push(video);

    // Un vídeo que falla solo libera el suyo: los demás de la diapositiva siguen
    function showError() {
        const index = activeVideos.indexOf(video);
        if (index < 0) return;
        activeVideos.splice(index, 1);
        releaseVideo(video);
        box.innerHTML = _tHtml(unsupportedHtml());
    }

    if (video.error) {
        showError();
        return;
    }

    video.addEventListener('error', showError, { once: true });

    // Si el navegador bloquea la reproducción automática quedan los controles del vídeo
    if (autoplay) {
        const playing = video.play();
        if (playing && typeof playing.catch === 'function') playing.catch(() => {});
    }
}
