/**
 * @fileoverview Conversión sin pérdida de las diapositivas antiguas (Información, Texto,
 * Imagen, Texto + imagen y Vídeo) a diapositiva libre. Cada campo con contenido pasa a ser
 * un elemento del lienzo; el pie (slide_footer) se convierte en un texto inferior.
 * Las diapositivas antiguas siguen funcionando: esto solo se usa al convertir en el editor
 * o al crear desde una plantilla. 'comment' (Actividad) y las preguntas no se convierten.
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasLegacy y module.exports.
 */
(function (root) {
    'use strict';

    const LEGACY_TYPES = ['info', 'text', 'image', 'text-image', 'video'];

    function model() {
        // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
        return typeof module !== 'undefined' && module.exports ? require('./slide-canvas-model') : root.XiroSlideCanvas;
    }

    function hasText(v) {
        return typeof v === 'string' && v.trim() !== '';
    }

    /** Elemento de texto en una caja fija. */
    function text(box, value, style) {
        const props = { text: value, align: 'center', valign: 'middle' };
        for (const key in style) {
            if (Object.prototype.hasOwnProperty.call(style, key)) props[key] = style[key];
        }
        return { type: 'text', x: box[0], y: box[1], w: box[2], h: box[3], props: props };
    }

    function image(box, src) {
        return { type: 'image', x: box[0], y: box[1], w: box[2], h: box[3], props: { src: src, fit: 'contain' } };
    }

    function textImageElements(slide, safeImage) {
        const imageLeft = slide.slide_image_position === 'left';
        const textX = imageLeft ? 1000 : 40;
        const list = [];
        if (safeImage) list.push(image([imageLeft ? 0 : 960, 0, 960, 1080], slide.slide_image));
        if (hasText(slide.slide_title))
            list.push(text([textX, 100, 880, 260], slide.slide_title, { size: 80, bold: true }));
        if (hasText(slide.slide_body)) list.push(text([textX, 400, 880, 560], slide.slide_body, { size: 44 }));
        return list;
    }

    function elementsFor(slide, m) {
        const type = slide.slide_type;
        const safeImage = m.isSafeMediaUrl(slide.slide_image);
        if (type === 'info') {
            return hasText(slide.comment_text)
                ? [text([160, 140, 1600, 800], slide.comment_text, { size: 96, bold: true })]
                : [];
        }
        if (type === 'text') {
            const list = [];
            if (hasText(slide.slide_title))
                list.push(text([160, 100, 1600, 260], slide.slide_title, { size: 96, bold: true }));
            if (hasText(slide.slide_body)) list.push(text([160, 400, 1600, 520], slide.slide_body, { size: 48 }));
            return list;
        }
        if (type === 'image') return safeImage ? [image([0, 0, 1920, 1080], slide.slide_image)] : [];
        if (type === 'text-image') return textImageElements(slide, safeImage);
        if (!hasText(slide.slide_video)) return [];
        return [{ type: 'video', x: 160, y: 90, w: 1600, h: 900, props: { url: slide.slide_video, autoplay: true } }];
    }

    /**
     * Lienzo equivalente a una diapositiva antigua, o null si no es de un tipo convertible.
     * @param {Object} slide - Fila de custom_game_questions (o entrada del editor)
     * @returns {Object|null}
     */
    function fromLegacySlide(slide) {
        if (!slide || LEGACY_TYPES.indexOf(slide.slide_type) < 0) return null;
        const m = model();
        const elements = elementsFor(slide, m);
        if (hasText(slide.slide_footer)) {
            elements.push(text([160, 960, 1600, 100], slide.slide_footer, { size: 36 }));
        }
        return m.normalizeCanvas({
            version: 1,
            background: { color: m.DEFAULT_BACKGROUND, image: null },
            elements: elements
        });
    }

    const api = { LEGACY_TYPES: LEGACY_TYPES, fromLegacySlide: fromLegacySlide };

    root.XiroSlideCanvasLegacy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
