/**
 * @fileoverview «Toca la imagen» (hotspot) en la TV: al lanzar la pregunta, la imagen en su escenario
 * con el crédito (Wikimedia Commons); al revelar, el área correcta, los toques de todos (anónimos,
 * por franja) y cuántos cayeron dentro. HTML compartido en core/hotspot-view.js; estilos en
 * css/hotspot.css. ES5 (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 */
window.TVApp = window.TVApp || {};
window.TVApp.Hotspot = (function () {
    'use strict';

    function utils() {
        return window.TVApp.Utils;
    }

    /** Imagen de la pregunta (sin el área: se dibuja al revelar) y su crédito. */
    function questionImageHtml(q) {
        let credit = q.image_credit
            ? '<p class="hs-credit" style="color:rgba(255,255,255,0.8);text-align:center">' + utils().escapeHtml(q.image_credit) + '</p>'
            : '';
        return '<div style="text-align:center;margin:20px 0">' +
            window.XiroHotspotView.stageHtml({ imageUrl: q.url_recurso || '', id: 'hs-tv' }) + credit + '</div>';
    }

    /** Aviso: la respuesta se da tocando la imagen en el móvil. */
    function devicesNoteHtml() {
        return '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.6);font-style:italic;font-size:18px">📍 Tocad la imagen en vuestros móviles</div>';
    }

    function captionHtml(hotspot) {
        let text = hotspot.respondents > 0
            ? hotspot.insideCount + ' de ' + hotspot.respondents + ' dentro del área'
            : 'Nadie ha respondido';
        return '<div class="hs-tv-caption" style="position:absolute;left:0;right:0;bottom:0;line-height:1.4;padding:6px;background:rgba(0,0,0,0.6);color:#ffffff;font-size:20px;font-weight:bold;text-align:center">' +
            text + '</div>';
    }

    /** Revelado: área, toques y recuento sobre la imagen de la pregunta. */
    function renderReveal(data) {
        let stage = utils().getEl('hs-tv');
        let hotspot = data && data.hotspot;
        if (!stage || !hotspot) return;
        stage.querySelector('.hs-stage__img').insertAdjacentHTML('afterend', window.XiroHotspotView.areaSvg(hotspot.area));
        let taps = hotspot.taps || [];
        for (let i = 0; i < taps.length; i++) {
            stage.insertAdjacentHTML('beforeend', window.XiroHotspotView.pinHtml(taps[i], taps[i].band));
        }
        stage.insertAdjacentHTML('beforeend', window._tHtml(captionHtml(hotspot)));
    }

    return {
        questionImageHtml: questionImageHtml,
        devicesNoteHtml: devicesNoteHtml,
        renderReveal: renderReveal
    };
})();
