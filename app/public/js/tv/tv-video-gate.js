/**
 * @fileoverview TV: botón previo a los reproductores de YouTube, Vimeo y Dailymotion.
 * El dispositivo no se conecta con esos servicios hasta que se toca. ES5 (tv.html).
 */
window.TVApp = window.TVApp || {};

window.TVApp.VideoGate = (function () {
    'use strict';

    let PROVIDERS = { youtube: 'YouTube', vimeo: 'Vimeo', dailymotion: 'Dailymotion' };
    let GATE_STYLE = 'width:100%;height:100%;background:#000;color:#fff;border:0;cursor:pointer;text-align:center;';
    let TITLE_STYLE = 'display:block;font-size:2rem;font-weight:700;';
    let NOTICE_STYLE = 'display:block;font-size:1rem;margin-top:.75rem;';
    let MEDIA_STYLE = 'width:100%;height:100%;border:0;background:#000;display:block;';

    function html(source) {
        let provider = PROVIDERS[source.kind] || 'vídeo';
        return (
            '<button type="button" data-tv-video-gate="' +
            window.TVApp.Utils.escapeHtml(source.embedUrl) +
            '" style="' +
            GATE_STYLE +
            '"><span style="' +
            TITLE_STYLE +
            '">&#9654; Cargar vídeo de ' +
            provider +
            '</span><span style="' +
            NOTICE_STYLE +
            '">Al cargarlo, este dispositivo se conectará con ' +
            provider +
            '.</span></button>'
        );
    }

    function createFrame(embedUrl) {
        let iframe = document.createElement('iframe');
        iframe.setAttribute('src', embedUrl + '&autoplay=1');
        iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        iframe.setAttribute('title', 'Vídeo');
        iframe.style.cssText = MEDIA_STYLE;
        return iframe;
    }

    // Sin closest: las TV antiguas no lo tienen
    function findGate(node) {
        while (node && node.getAttribute) {
            if (node.getAttribute('data-tv-video-gate')) return node;
            node = node.parentNode;
        }
        return null;
    }

    document.addEventListener('click', function (event) {
        let gate = findGate(event.target);
        if (gate && gate.parentNode) gate.parentNode.replaceChild(createFrame(gate.getAttribute('data-tv-video-gate')), gate);
    });

    return { html: html };
})();
