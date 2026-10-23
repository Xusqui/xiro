/**
 * @fileoverview Diálogo de texto de la diapositiva libre: pide un nombre (guardar o renombrar en la
 * biblioteca), enseña el paquete para copiarlo a mano cuando el navegador no deja usar el portapapeles
 * (HTTP en la red local) o recoge el texto pegado para importarlo. Mismo aspecto que el diálogo de imagen o
 * vídeo (slides-canvas-media.js). Mientras está abierto (#modalLienzoTexto) las teclas no llegan al editor.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const MODAL_ID = 'modalLienzoTexto';
    const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
    }

    function close() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.remove();
    }

    function setStatus(text, ok) {
        const status = document.getElementById('lienzoTextoStatus');
        if (!status) return;
        status.className = 'text-xs mt-2 ' + (ok ? 'text-green-600' : 'text-red-600');
        status.textContent = text;
    }

    function fieldHtml(o) {
        const attrs =
            'id="lienzoTextoValor" class="xsce-input' +
            (o.multiline ? ' xsce-textarea' : '') +
            '"' +
            (o.readonly ? ' readonly' : '') +
            (o.maxLength ? ' maxlength="' + Number(o.maxLength) + '"' : '');
        return o.multiline
            ? '<textarea ' + attrs + ' rows="8" spellcheck="false"></textarea>'
            : '<input type="text" ' + attrs + '>';
    }

    function modalHtml(o) {
        const t = XiroCanvasEditor.t;
        return (
            '<div class="xsce-dialog" role="dialog" aria-modal="true" aria-labelledby="lienzoTextoTitulo" style="max-width:' +
            (o.multiline ? 560 : 460) +
            'px">' +
            '<div class="xsce-dialog-head"><span class="xsce-tile"><i class="fas ' +
            esc(o.icon || 'fa-pen') +
            '" aria-hidden="true"></i></span>' +
            '<div class="xsce-heading"><h3 id="lienzoTextoTitulo">' +
            esc(o.title) +
            '</h3></div></div>' +
            (o.label ? '<label class="xsce-label" for="lienzoTextoValor">' + esc(o.label) + '</label>' : '') +
            fieldHtml(o) +
            '<p id="lienzoTextoStatus" class="text-xs text-slate-500 mt-2">' +
            esc(o.hint || '') +
            '</p>' +
            '<div class="xsce-dialog-foot">' +
            '<button type="button" data-lienzo-texto="cancel" class="xsce-btn xsce-btn--ghost">' +
            esc(t(o.readonly ? 'io.close' : 'cancel')) +
            '</button>' +
            '<button type="button" data-lienzo-texto="confirm" class="xsce-btn xsce-btn--primary">' +
            esc(o.confirmLabel) +
            '</button>' +
            '</div></div>'
        );
    }

    /**
     * Abre el diálogo. Los textos llegan traducidos y sin escapar.
     * @param {Object} o
     * @param {string} o.title - Título
     * @param {string} o.confirmLabel - Texto del botón principal
     * @param {Function} o.onConfirm - (valor, ui) => false para dejarlo abierto; ui = { setStatus(texto, ok), select() }
     * @param {string} [o.hint] - Ayuda bajo el campo
     * @param {string} [o.label] - Etiqueta del campo
     * @param {string} [o.value] - Valor inicial
     * @param {boolean} [o.multiline] - Área de texto en vez de campo de una línea
     * @param {boolean} [o.readonly] - Solo lectura (texto para copiar a mano)
     * @param {number} [o.maxLength] - Longitud máxima
     * @param {string} [o.icon] - Icono Font Awesome de la cabecera (por defecto fa-pen)
     */
    function open(o) {
        close();
        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'xsce-overlay-dim';
        modal.style.zIndex = '75';
        modal.innerHTML = modalHtml(o);
        document.body.appendChild(modal);
        const field = document.getElementById('lienzoTextoValor');
        field.value = o.value || '';
        const ui = {
            setStatus,
            select: () => {
                field.focus();
                field.select();
            }
        };
        const confirm = () => {
            if (o.onConfirm(field.value, ui) !== false) close();
        };
        modal.addEventListener('click', e => {
            const action = e.target.closest('[data-lienzo-texto]');
            if (!action) return;
            if (action.getAttribute('data-lienzo-texto') === 'confirm') confirm();
            else close();
        });
        modal.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Escape') close();
            if (e.key === 'Enter' && !o.multiline) confirm();
        });
        ui.select();
    }

    XiroCanvasEditor.ioDialog = { open, close };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.ioDialog;
})();
