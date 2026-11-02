/**
 * @fileoverview Diapositiva de instrucciones (slide_type 'howto') en tv.html: la misma animación
 * que el presentador (core/howto-core.js) pero sin locución. Contenido fijo del código;
 * de la diapositiva solo se lee `slide_howto`, que elige un tema de una lista cerrada.
 * ES5 a propósito (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread. La TV no carga i18n:
 * la animación sale en español.
 */
window.TVApp = window.TVApp || {};
window.TVApp.RenderHowTo = (function () {
    'use strict';

    function renderHowToSlide(slide) {
        const getEl = window.TVApp.Utils.getEl;
        window.TVApp.RenderSlides.resetTimers();
        window.TVApp.Audio.stopQuestionAudio();
        if (window.XiroHowTo) window.XiroHowTo.stop();

        const state = window.TVApp.State;
        const isLast = state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1;
        const nextBtnText = isLast && !window.isTrivialGame ? 'Ver Ránking ★' : 'Siguiente →';

        getEl('main-container').innerHTML = _tHtml(
            '<div style="position:relative;width:100%;height:100vh;background:#000;">' +
                '<div id="tv-howto-host" class="howto-host" data-i18n-skip="true"></div></div>' +
                '<button id="btn-next" data-tv-action="next-question" class="btn btn-secondary btn-next">' +
                nextBtnText +
                '</button>'
        );

        const host = document.getElementById('tv-howto-host');
        if (host && window.XiroHowTo) window.XiroHowTo.mount(host, slide && slide.slide_howto, { audio: false });
        window.TVApp.Utils.clearCache();
    }

    return { renderHowToSlide: renderHowToSlide };
})();
