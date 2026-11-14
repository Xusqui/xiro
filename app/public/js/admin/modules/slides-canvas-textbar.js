/**
 * @fileoverview Barra de formato del editor de diapositivas libres: con un cuadro de texto
 * seleccionado muestra, junto a la barra de herramientas, el formato tipo Word del texto (letra,
 * carácter, párrafo y espaciado). El marcado está en slides-canvas-textbar-html.js y lo que hace
 * cada control en slides-canvas-textbar-apply.js; aquí, el estado de los controles y los eventos.
 * La barra es un <fieldset>: sin texto seleccionado se desactiva entera (sigue visible y el
 * lienzo no salta). Escribiendo en el cuadro muestra el formato de la selección, como Word (un
 * botón queda «mixto» si solo una parte lo tiene) y se repinta al moverse la selección. El
 * rotulador aplica el último color de resaltado elegido (amarillo al abrir el editor).
 *
 * 'input' se ve al momento sin entrar en el historial y 'change' guarda un paso para deshacer.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const DEFAULT_HIGHLIGHT = '#ffff00';
    const NUMBERED_KINDS = ['number', 'alpha', 'roman'];
    const PARA_FIELDS = ['lineHeight', 'spaceBefore', 'spaceAfter', 'style'];

    let bar = null;
    let shownId = null;
    let markColor = DEFAULT_HIGHLIGHT;
    let keys = null;

    function selectedText() {
        const el = XiroCanvasEditor.getSelected();
        return el && el.type === 'text' ? el : null;
    }

    /** @param {boolean|string} on - true, false o 'mixed' (solo una parte de la selección lo tiene). */
    function press(button, on) {
        button.classList.toggle('is-on', on === true);
        button.classList.toggle('is-mixed', on === 'mixed');
        button.setAttribute('aria-pressed', String(on));
    }

    /** true si todos cumplen, false si ninguno y 'mixed' si solo una parte. */
    function tri(items, test) {
        const n = items.filter(test).length;
        if (n === items.length) return true;
        return n > 0 ? 'mixed' : false;
    }

    /** El valor si todos coinciden; si no, undefined (el control queda en blanco). */
    function common(values) {
        return values.every(v => v === values[0]) ? values[0] : undefined;
    }

    /** No se pisa el campo en el que se está escribiendo para ese mismo texto. */
    function setField(key, value, sameText) {
        const field = bar.querySelector('[data-tb="' + key + '"]');
        if (!(sameText && field === document.activeElement)) field.value = value === undefined ? '' : value;
    }

    /** El rotulador aplica este color y lo enseña en su raya. */
    function setMark(color) {
        const marker = bar.querySelector('[data-tb-mark]');
        markColor = color;
        marker.setAttribute('data-tb-mark', color);
        marker.style.setProperty('--xsce-mark', color);
    }

    /**
     * Muestra del resaltado: vacía si nada lo tiene (sin fingir un amarillo), mixta si solo una
     * parte; el campo guarda entonces el color del rotulador, para que el selector empiece en él.
     */
    function renderHighlight(values, sameText) {
        const field = bar.querySelector('[data-tb="highlight"]');
        const shared = common(values);
        const none = values.every(v => !v);
        field.classList.toggle('is-empty', none);
        field.classList.toggle('is-mixed', !none && shared === undefined);
        setField('highlight', (shared || markColor).slice(0, 7), sameText);
    }

    function renderCharacter(p) {
        const runs = p.runs || [{ text: p.text }];
        bar.querySelectorAll('[data-tb-toggle]').forEach(b => {
            const key = b.getAttribute('data-tb-toggle');
            press(b, !!p[key] || runs.every(run => run[key]));
        });
        bar.querySelectorAll('[data-tb-script]').forEach(b =>
            press(
                b,
                runs.every(run => run.script === b.getAttribute('data-tb-script'))
            )
        );
    }

    /**
     * Listas: viñetas pulsadas o no; el botón de números toma el tipo de numeración del texto (y
     * pulsarlo la quita); en el menú, el tipo elegido queda marcado.
     */
    function renderLists(list) {
        const numbered = bar.querySelector('[data-tb-numbered]');
        const kind = NUMBERED_KINDS.indexOf(list) >= 0 ? list : 'number';
        if (numbered && numbered.getAttribute('data-tb-list') !== kind) {
            numbered.setAttribute('data-tb-list', kind);
            numbered.innerHTML = XiroCanvasEditor.textbarHtml.numberedFace(kind);
        }
        bar.querySelectorAll('[data-tb-list]').forEach(b => {
            const on = list === b.getAttribute('data-tb-list');
            if (b.getAttribute('role') === 'menuitemradio') b.setAttribute('aria-checked', String(on));
            else press(b, on);
        });
    }

    /** Formato de párrafo: el del cuadro o, escribiendo, el de los párrafos de la selección. */
    function renderParagraph(el, sameText, selected) {
        const p = el.props;
        const H = root.XiroSlideCanvasRichTextHtml;
        const align = selected ? common(selected.map(para => para.align || p.align)) : p.align;
        const list = selected ? common(selected.map(para => H.kindOf(para, p.list) || 'none')) : p.list;
        bar.querySelectorAll('[data-tb-align]').forEach(b => press(b, align === b.getAttribute('data-tb-align')));
        renderLists(list);
        const paras = selected || XiroCanvasEditor.textFormat.paras(el);
        PARA_FIELDS.forEach(key => {
            const value = common(paras.map(para => para[key]));
            setField(key, value === undefined ? '' : String(value), sameText);
        });
    }

    /** Escribiendo: el formato de lo seleccionado en el cuadro (como Word), no el del cuadro entero. */
    function renderSelection(el, summary, sameText) {
        const formats = summary.formats;
        const value = key => common(formats.map(f => f[key]));
        setField('font', value('font'), sameText);
        setField('size', value('size'), sameText);
        setField('color', (value('color') || '').slice(0, 7), sameText);
        renderHighlight(
            formats.map(f => f.highlight),
            sameText
        );
        bar.querySelectorAll('[data-tb-toggle]').forEach(b => {
            const key = b.getAttribute('data-tb-toggle');
            press(
                b,
                tri(formats, f => !!f[key])
            );
        });
        bar.querySelectorAll('[data-tb-script]').forEach(b =>
            press(
                b,
                tri(formats, f => f.script === b.getAttribute('data-tb-script'))
            )
        );
        renderParagraph(el, sameText, summary.paras);
    }

    function editingSummary() {
        const T = XiroCanvasEditor.textEdit;
        return T && T.isEditing() && T.selectionSummary ? T.selectionSummary() : null;
    }

    /** Activa la barra con los valores del texto seleccionado (o la desactiva). */
    function render() {
        if (!bar) return;
        const el = selectedText();
        bar.disabled = !el;
        bar.querySelector('.xsce-tb-idle').hidden = !!el;
        if (!el) {
            if (XiroCanvasEditor.textbarPop) XiroCanvasEditor.textbarPop.close();
            shownId = null;
            bar.querySelectorAll('[aria-pressed]').forEach(b => press(b, false));
            return;
        }
        const sameText = el.id === shownId;
        shownId = el.id;
        const summary = editingSummary();
        if (summary) {
            renderSelection(el, summary, sameText);
            return;
        }
        const p = el.props;
        const runs = p.runs || [{ text: p.text }];
        setField('font', p.font, sameText);
        setField('size', p.size, sameText);
        setField('color', p.color.slice(0, 7), sameText);
        renderHighlight(
            runs.map(run => run.highlight),
            sameText
        );
        renderCharacter(p);
        renderParagraph(el, sameText);
    }

    let pendingFrame = 0;

    /** La selección del cuadro que se escribe se mueve: un repintado por fotograma como mucho. */
    function onSelectionChange() {
        if (pendingFrame || !(XiroCanvasEditor.textEdit && XiroCanvasEditor.textEdit.isEditing())) return;
        pendingFrame = root.requestAnimationFrame(() => {
            pendingFrame = 0;
            render();
        });
    }

    function onField(event, silent) {
        const el = selectedText();
        const key = event.target.getAttribute('data-tb');
        if (!el || !key) return;
        // El color elegido pasa al rotulador antes de repintar, para que la muestra lo enseñe
        if (key === 'highlight' && !silent) setMark(event.target.value);
        XiroCanvasEditor.textFormat.field(el, key, event.target.value, silent);
    }

    function onClick(event) {
        const el = selectedText();
        const button = event.target.closest('button');
        const pop = XiroCanvasEditor.textbarPop;
        if (!el || !button) return;
        // Abierto con el teclado (detail 0), el foco entra en el panel
        if (button.hasAttribute('data-tb-pop')) {
            if (pop) pop.toggle(button, event.detail === 0);
            return;
        }
        XiroCanvasEditor.textFormat.click(el, button);
        if (pop && button.getAttribute('role') === 'menuitemradio') pop.close();
    }

    XiroCanvasEditor.textbar = {
        attach(barEl) {
            bar = barEl;
            shownId = null;
            bar.innerHTML = XiroCanvasEditor.textbarHtml.html();
            setMark(DEFAULT_HIGHLIGHT);
            // Una parada de Tab y flechas (slides-canvas-roving.js); los paneles van aparte
            const row = bar.querySelector('[role="toolbar"]');
            keys = XiroCanvasEditor.roving ? XiroCanvasEditor.roving.attach(row, '.xsce-tb-pop') : null;
            bar.addEventListener('input', e => onField(e, true));
            bar.addEventListener('change', e => onField(e, false));
            bar.addEventListener('click', onClick);
            // Los botones no se llevan el foco: así no se pierde la selección del texto que se escribe
            bar.addEventListener('mousedown', e => {
                if (e.target.closest('button')) e.preventDefault();
            });
            XiroCanvasEditor.onRender(render);
            document.addEventListener('selectionchange', onSelectionChange);
            render();
        },
        detach() {
            if (XiroCanvasEditor.textbarPop) XiroCanvasEditor.textbarPop.close();
            if (keys) keys.detach();
            keys = null;
            XiroCanvasEditor.offRender(render);
            document.removeEventListener('selectionchange', onSelectionChange);
            if (pendingFrame) root.cancelAnimationFrame(pendingFrame);
            pendingFrame = 0;
            bar = null;
        },
        refresh: render
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.textbar;
})();
