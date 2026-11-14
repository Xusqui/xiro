/**
 * @fileoverview Edición del texto en el lienzo (fase C): un cuadro contenteditable encima del
 * elemento, con su formato por tramos y párrafos (core/slide-canvas-richtext.js). Cada línea es un
 * <div> con el formato de su párrafo en atributos data-*; las marcas de lista las pinta CSS y no
 * son texto. Cada cambio se lee con slides-canvas-richtext-dom.js y se guarda sin historial; al
 * terminar, un paso de deshacer. El formato de fuente, tamaño y párrafo de la selección está en
 * slides-canvas-textedit-format.js.
 *
 * Pegar solo admite texto plano: el HTML del portapapeles nunca entra en el lienzo.
 *
 * El selector de color de la barra se queda el foco: al ir a un control con data-keep-edit la
 * edición queda aparcada (se guarda la selección) hasta aplicar el color o pulsar fuera.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    // Estilo del cuadro que se copia del texto pintado, para que editar no cambie su aspecto
    const STYLE_KEYS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'textAlign', 'backgroundColor', 'textDecoration'];
    const BOX_KEYS = ['left', 'top', 'width', 'height', 'transform', 'webkitTransform'];

    let editingId = null;
    let box = null;
    let savedRange = null;

    const keepsEdit = node => !!(node && node.closest && node.closest('[data-keep-edit]'));

    function unpark() {
        savedRange = null;
        document.removeEventListener('pointerdown', onOutside, true);
        document.removeEventListener('focusin', onOutside, true);
    }

    /** Con la edición aparcada: volver al texto o a la barra la mantiene; cualquier otra cosa la termina. */
    function onOutside(event) {
        if ((box && box.contains(event.target)) || keepsEdit(event.target)) return;
        finish();
    }

    function park() {
        const selection = root.getSelection ? root.getSelection() : null;
        savedRange = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
        document.addEventListener('pointerdown', onOutside, true);
        document.addEventListener('focusin', onOutside, true);
    }

    function onBlur(event) {
        if (keepsEdit(event.relatedTarget)) park();
        else finish();
    }

    function finish() {
        if (!editingId) return;
        unpark();
        editingId = null;
        box = null;
        E.setMode('selected');
        E.commit();
    }

    function save() {
        const el = E.getElement(editingId);
        if (!el || !box) return;
        const read = E.richTextDom.read(box, el.props);
        E.updateElement(el.id, {
            props: { text: read.text, runs: read.runs || undefined, paras: read.paras },
            silent: true
        });
    }

    function onKeyDown(event) {
        // Las teclas son del texto, no de los atajos del editor
        event.stopPropagation();
        if (event.key !== 'Escape') return;
        event.preventDefault();
        box.blur();
    }

    function onPaste(event) {
        event.preventDefault();
        const plain = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
        if (plain) document.execCommand('insertText', false, plain);
    }

    /** Cursor al final del texto. */
    function caretToEnd(node) {
        const selection = root.getSelection ? root.getSelection() : null;
        if (!selection || !document.createRange) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function createBox(el, elementNode) {
        const node = document.createElement('div');
        node.className = 'xsce-textedit';
        node.setAttribute('contenteditable', 'true');
        node.setAttribute('spellcheck', 'true');
        const painted = elementNode ? elementNode.querySelector('.xsc-text') : null;
        if (elementNode) BOX_KEYS.forEach(key => (node.style[key] = elementNode.style[key]));
        if (painted) STYLE_KEYS.forEach(key => (node.style[key] = painted.style[key]));
        node.innerHTML = root.XiroSlideCanvasRichText.innerHtml(el.props, root.XiroSlideCanvasRender.escapeText, {
            editable: true
        });
        return node;
    }

    E.textEdit = {
        /**
         * Abre la edición de un texto (el nodo pintado se oculta mientras tanto).
         * @param {Object} el - Elemento de texto.
         * @param {HTMLElement} overlay - Capa del escenario donde va el cuadro.
         * @param {HTMLElement|null} elementNode - Nodo pintado del elemento.
         */
        start(el, overlay, elementNode) {
            editingId = el.id;
            box = createBox(el, elementNode);
            if (elementNode) elementNode.style.visibility = 'hidden';
            overlay.appendChild(box);
            box.addEventListener('input', save);
            box.addEventListener('keydown', onKeyDown);
            box.addEventListener('paste', onPaste);
            box.addEventListener('blur', onBlur);
            box.focus();
            caretToEnd(box);
        },
        /** @returns {boolean} Si hay un cuadro de edición abierto en esa capa. */
        isOpenIn: overlay => !!(editingId && overlay && overlay.querySelector('.xsce-textedit')),
        isEditing: () => editingId !== null,
        /** Termina la edición y guarda un paso de deshacer. */
        finish,
        /** El cuadro abierto (para aplicar formato a la selección), o null. */
        box: () => box,
        save,
        /**
         * Vuelve al texto (y a su selección si la edición estaba aparcada).
         * @returns {Selection|null} La selección del documento.
         */
        restore() {
            const range = savedRange;
            unpark();
            box.focus();
            const selection = root.getSelection ? root.getSelection() : null;
            if (range && selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
            return selection;
        },
        /**
         * Aplica un formato a la selección del texto (vuelve a ella si la edición estaba aparcada).
         * @param {string} command - Orden de execCommand (bold, strikeThrough, foreColor, hiliteColor…).
         * @param {string} [value] - Color para foreColor y hiliteColor.
         */
        format(command, value) {
            if (!box) return;
            E.textEdit.restore();
            // Spans con estilo en vez de <b>/<font>: los lee richtext-dom y no dependen del navegador
            document.execCommand('styleWithCSS', false, true);
            document.execCommand(command, false, value === undefined ? null : value);
            save();
        },
        reset() {
            unpark();
            editingId = null;
            box = null;
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.textEdit;
})();
