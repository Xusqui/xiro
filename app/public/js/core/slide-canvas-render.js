/**
 * @fileoverview Render común de la diapositiva libre (slide_type 'canvas').
 *
 * Pinta el lienzo lógico de 1920x1080 sin escalar y lo encaja en su contenedor con un
 * único transform: scale(s). Así editor, presentador, jugador, TV, standalone y PDF
 * colocan cada elemento exactamente igual. El orden del array es el z-index.
 * Todo texto y URL se escapa; las URL no seguras no se pintan.
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasRender y module.exports.
 */
(function (root) {
    'use strict';

    const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;', '`': '&#96;' };
    const VIDEO_BOX = 'background-color:#000;color:rgba(255,255,255,0.7);display:-webkit-box;display:-webkit-flex;display:flex;'
        + '-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;height:100%;';

    function isNode() {
        return typeof module !== 'undefined' && module.exports;
    }

    function model() {
        // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
        return isNode() ? require('./slide-canvas-model') : root.XiroSlideCanvas;
    }

    function shapes() {
        // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
        return isNode() ? require('./slide-canvas-shapes') : root.XiroSlideCanvasShapes;
    }

    function escapeText(s) {
        return String(s === undefined || s === null ? '' : s).replace(/[&<>"'`]/g, function (ch) { return HTML_ESCAPES[ch]; });
    }

    function safeColor(v, fallback) {
        return model().isColor(v) ? v : fallback;
    }

    function safeUrl(v) {
        return model().isSafeMediaUrl(v) ? escapeText(v) : '';
    }

    function textHtml(p) {
        const m = model();
        let style = 'font-family:' + escapeText(m.FONTS[p.font] || m.FONTS.sans) + ';font-size:' + p.size + 'px;'
            + 'font-weight:' + (p.bold ? '700' : '400') + ';font-style:' + (p.italic ? 'italic' : 'normal') + ';'
            + 'color:' + safeColor(p.color, '#ffffff') + ';text-align:' + p.align + ';';
        if (p.fill) style += 'background-color:' + safeColor(p.fill, 'transparent') + ';';
        return '<div class="xsc-text xsc-valign--' + p.valign + '" data-size="' + p.size + '" style="' + style + '">'
            + '<div class="xsc-text-inner">' + escapeText(p.text) + '</div></div>';
    }

    function imageHtml(p) {
        const src = safeUrl(p.src);
        if (!src) return '';
        return '<img class="xsc-img" src="' + src + '" alt="" draggable="false" style="object-fit:' + p.fit
            + ';border-radius:' + p.radius + 'px">';
    }

    /** Rótulo del hueco del vídeo: dominio de origen, o el texto que pase quien pinta (labels). */
    function hostOf(url, labels) {
        const l = labels || {};
        if (String(url).indexOf('/uploads/') === 0) return l.localVideo || '';
        const match = /^https?:\/\/([^/?#]+)/i.exec(String(url));
        return match ? match[1] : (l.video || '');
    }

    /** Hueco del vídeo: vacío en presentador/TV (el cliente monta el reproductor). */
    function videoHtml(el, index, options) {
        const mode = options.mode;
        let inner = '';
        if (mode === 'player') {
            const label = options.labels && options.labels.videoOnScreen ? options.labels.videoOnScreen : '';
            inner = '<div class="xsc-video-label" style="' + VIDEO_BOX + '"><i class="fas fa-film"></i>&nbsp;' + escapeText(label) + '</div>';
        } else if (mode !== 'presenter' && mode !== 'tv') {
            inner = '<div class="xsc-video-label" style="' + VIDEO_BOX + '"><i class="fas fa-film"></i>&nbsp;' + escapeText(hostOf(el.props.url, options.labels)) + '</div>';
        }
        return '<div class="xsc-video" data-xsc-video="' + index + '">' + inner + '</div>';
    }

    function elementHtml(el, index, options) {
        let style = 'left:' + el.x + 'px;top:' + el.y + 'px;width:' + el.w + 'px;height:' + el.h + 'px;z-index:' + (index + 1) + ';';
        if (el.rotation) style += '-webkit-transform:rotate(' + el.rotation + 'deg);transform:rotate(' + el.rotation + 'deg);';
        let inner = '';
        if (el.type === 'text') inner = textHtml(el.props);
        else if (el.type === 'shape') inner = shapes().shapeSvg(el);
        else if (el.type === 'image') inner = imageHtml(el.props);
        else inner = videoHtml(el, index, options);
        return '<div class="xsc-el xsc-el--' + el.type + '" data-el-id="' + escapeText(el.id) + '" data-el-index="' + index + '"'
            + (el.type === 'text' ? ' data-fit="' + el.props.fit + '"' : '') + ' style="' + style + '">' + inner + '</div>';
    }

    /**
     * HTML del lienzo completo (marco + escenario de 1920x1080 sin escalar).
     * @param {Object} canvas - slide_canvas
     * @param {Object} [options] - { mode: editor|presenter|player|tv|pdf|thumb,
     *                              labels: { videoOnScreen (jugador), localVideo, video (editor, miniatura, PDF) } }
     * @returns {string}
     */
    function stageHtml(canvas, options) {
        const m = model();
        const opts = options || {};
        const c = m.normalizeCanvas(canvas) || m.createCanvas();
        let style = 'width:' + m.WIDTH + 'px;height:' + m.HEIGHT + 'px;background-color:' + safeColor(c.background.color, m.DEFAULT_BACKGROUND) + ';';
        const bgImage = safeUrl(c.background.image);
        if (bgImage) style += 'background-image:url(&quot;' + bgImage + '&quot;);';
        // data-i18n-skip: la traducción automática del DOM no debe tocar los textos del autor
        let html = '<div class="xsc-frame" data-xsc-frame="1" data-i18n-skip="true"><div class="xsc-stage" style="' + style + '">';
        for (let i = 0; i < c.elements.length; i++) html += elementHtml(c.elements[i], i, opts);
        return html + '</div></div>';
    }

    /** Escala y centra el escenario dentro del marco; devuelve la escala aplicada. */
    function fitStage(frame) {
        const stage = frame ? frame.querySelector('.xsc-stage') : null;
        const w = frame ? frame.clientWidth : 0;
        const h = frame ? frame.clientHeight : 0;
        if (!stage || !w || !h) return 0;
        const s = Math.min(w / 1920, h / 1080);
        stage.style.webkitTransform = 'scale(' + s + ')';
        stage.style.transform = 'scale(' + s + ')';
        stage.style.left = ((w - 1920 * s) / 2) + 'px';
        stage.style.top = ((h - 1080 * s) / 2) + 'px';
        frame.setAttribute('data-xsc-scale', String(s));
        return s;
    }

    /** Reduce la letra de los textos con ajuste 'shrink' hasta que caben en su caja. */
    function fitText(rootEl) {
        if (!rootEl) return;
        const boxes = rootEl.querySelectorAll('.xsc-el--text[data-fit="shrink"] .xsc-text');
        for (let i = 0; i < boxes.length; i++) {
            const text = boxes[i];
            // Se parte del tamaño elegido: al reajustar (fuentes ya cargadas) puede volver a crecer
            let size = parseFloat(text.getAttribute('data-size')) || parseFloat(text.style.fontSize) || 64;
            text.style.fontSize = size + 'px';
            for (let n = 0; n < 200 && size > 8 && text.scrollHeight > text.clientHeight + 1; n++) {
                size = Math.max(8, size - 2);
                text.style.fontSize = size + 'px';
            }
        }
    }

    /**
     * Pinta el lienzo en el contenedor, lo encaja y lo reencaja al cambiar el tamaño de la ventana.
     * @returns {{frame: Element, stage: Element, scale: number, refit: Function, destroy: Function}}
     */
    function mount(container, canvas, options) {
        container.innerHTML = stageHtml(canvas, options);
        const frame = container.querySelector('.xsc-frame');
        const handle = {
            frame: frame,
            stage: frame.querySelector('.xsc-stage'),
            scale: 0,
            refit: function () {
                handle.scale = fitStage(frame);
                return handle.scale;
            },
            destroy: function () {
                if (typeof window !== 'undefined') window.removeEventListener('resize', handle.refit);
            }
        };
        handle.refit();
        fitText(frame);
        // Las fuentes web llegan después del primer pintado: se vuelve a ajustar con las definitivas
        if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                if (frame.isConnected !== false) fitText(frame);
            });
        }
        if (typeof window !== 'undefined') window.addEventListener('resize', handle.refit);
        return handle;
    }

    const api = {
        stageHtml: stageHtml,
        fitStage: fitStage,
        fitText: fitText,
        mount: mount,
        escapeText: escapeText,
        safeColor: safeColor,
        safeUrl: safeUrl
    };

    root.XiroSlideCanvasRender = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
