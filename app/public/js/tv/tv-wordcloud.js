/**
 * @fileoverview «Nube de palabras» (word_cloud) en la TV: el lienzo al lanzar la pregunta, la nube
 * en directo (sin botones: la TV solo mira, ocultar palabras es cosa del presentador) y la nube
 * final al revelar. Cerrada la pregunta, una actualización tardía no repinta. Colocación y
 * pintado en core/word-cloud-layout.js y core/word-cloud-render.js; estilos en css/word-cloud.css.
 * ES5 (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 */
window.TVApp = window.TVApp || {};
window.TVApp.WordCloud = (function () {
    'use strict';

    function stage() {
        return document.getElementById('wc-stage');
    }

    /** HTML del área de la pregunta: el lienzo vacío de la nube. */
    function stageHtml() {
        return '<div id="wc-stage" class="wc-stage wc-stage--tv"><div id="wc-cloud" class="wc-cloud"></div></div>';
    }

    function paint(cloud, options) {
        const canvas = document.getElementById('wc-cloud');
        if (!canvas || !window.XiroWordCloudRender) return 0;
        return window.XiroWordCloudRender.render(canvas, cloud, options);
    }

    /** Nube en directo (`word-cloud-update`); ignorada si no hay escenario o ya se reveló. */
    function update(cloud, options) {
        const el = stage();
        if (!el || el.getAttribute('data-wc-closed')) return 0;
        return paint(cloud, options);
    }

    /** Nube final del `reveal-answer`; cierra el escenario a nuevas actualizaciones. */
    function reveal(cloud, options) {
        const el = stage();
        if (!el) return;
        el.setAttribute('data-wc-closed', '1');
        paint(cloud, options);
    }

    return {
        stageHtml: stageHtml,
        update: update,
        reveal: reveal
    };
})();
