/**
 * @fileoverview Textos del editor de diapositivas libres. Todos viven en el sistema i18n
 * (claves admin.canvas.* de js/i18n/<idioma>/language_<idioma>_admin_canvas.json) y se piden
 * al pintar, nunca al cargar el módulo: así salen en el idioma activo y, al cambiarlo, basta
 * con volver a pintar (slides-canvas.js remonta el editor abierto con su estado intacto).
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = root.XiroCanvasEditor = root.XiroCanvasEditor || {};
    const PREFIX = 'admin.canvas.';
    const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };

    /** Texto de admin.canvas.<key> con sus {variables}; la clave completa si falta. */
    function t(key, vars) {
        const full = PREFIX + key;
        const text = typeof root._t === 'function' ? root._t(full, vars) : null;
        return text == null || text === '' ? full : String(text);
    }

    /** Lo mismo, escapado para meterlo en HTML (texto o atributo). */
    function th(key, vars) {
        return t(key, vars).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
    }

    /** Rótulos del hueco de vídeo para core/slide-canvas-render.js (opción labels). */
    function videoLabels() {
        return { localVideo: t('video_label.local'), video: t('video_label.generic') };
    }

    XiroCanvasEditor.t = t;
    XiroCanvasEditor.th = th;
    XiroCanvasEditor.videoLabels = videoLabels;

    if (typeof module !== 'undefined' && module.exports) module.exports = { t, th, videoLabels };
})();
