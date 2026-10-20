/**
 * @fileoverview Diapositiva libre (slide_type 'canvas') en tv.html. La TV es una pantalla
 * de presentador: pinta el lienzo con core/slide-canvas-render.js y monta en cada hueco de
 * vídeo su reproductor (video_source lo añade el servidor).
 * ES5 a propósito (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 */
window.TVApp = window.TVApp || {};
window.TVApp.RenderCanvas = (function () {
    'use strict';

    const MEDIA_STYLE = 'width:100%;height:100%;object-fit:contain;border:0;background:#000;display:block;';
    let mounted = null;

    function unsupportedHtml() {
        return (
            '<div style="color:rgba(255,255,255,.5);text-align:center;font-size:40px;font-weight:700;padding-top:40px;">' +
            '<i class="fas fa-film"></i><p>No se puede reproducir este vídeo</p></div>'
        );
    }

    /** Reproductor de un elemento de vídeo, igual que renderVideoSlide pero sin autoplay forzado. */
    function mediaHtml(element) {
        const escapeHtml = window.TVApp.Utils.escapeHtml;
        const source = element && element.video_source ? element.video_source : null;
        const autoplay = !!(element && element.props && element.props.autoplay === true);
        if (source && source.kind === 'file' && source.url) {
            return (
                '<video src="' +
                escapeHtml(source.url) +
                '"' +
                (autoplay ? ' autoplay' : '') +
                ' controls playsinline preload="auto" style="' +
                MEDIA_STYLE +
                '"></video>'
            );
        }
        if (source && source.embedUrl) {
            return (
                '<iframe src="' +
                escapeHtml(source.embedUrl + (autoplay ? '&autoplay=1' : '')) +
                '"' +
                ' allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen' +
                ' referrerpolicy="strict-origin-when-cross-origin" title="Vídeo" style="' +
                MEDIA_STYLE +
                '"></iframe>'
            );
        }
        return unsupportedHtml();
    }

    function renderCanvasSlide(slide) {
        const getEl = window.TVApp.Utils.getEl;
        window.TVApp.RenderSlides.resetTimers();
        window.TVApp.Audio.stopQuestionAudio();

        const state = window.TVApp.State;
        const isLast = state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1;
        const nextBtnText = isLast && !window.isTrivialGame ? 'Ver Ránking ★' : 'Siguiente →';

        if (mounted) mounted.destroy();
        mounted = null;

        getEl('main-container').innerHTML = _tHtml(
            '<div id="tv-canvas-host" style="position:relative;width:100%;height:100vh;background:#000;"></div>' +
                '<button id="btn-next" data-tv-action="next-question" class="btn btn-secondary btn-next">' +
                nextBtnText +
                '</button>'
        );

        const host = document.getElementById('tv-canvas-host');
        const canvas = slide && slide.slide_canvas;
        if (host && canvas) {
            mounted = window.XiroSlideCanvasRender.mount(host, canvas, { mode: 'tv' });
            const elements = canvas.elements || [];
            Array.prototype.forEach.call(host.querySelectorAll('[data-xsc-video]'), function (box) {
                box.innerHTML = mediaHtml(elements[Number(box.getAttribute('data-xsc-video'))]);
            });
        }
        window.TVApp.Utils.clearCache();
    }

    return { renderCanvasSlide: renderCanvasSlide };
})();
