/**
 * @fileoverview Barra de formato del editor de diapositivas libres: con un cuadro de texto
 * seleccionado muestra, junto a la barra de herramientas, el formato tipo Word del texto (letra,
 * carácter, párrafo y espaciado). El marcado está en slides-canvas-textbar-html.js y lo que hace
 * cada control en slides-canvas-textbar-apply.js; aquí, el estado de los controles y los eventos.
 * La barra es un <fieldset>: sin texto seleccionado se desactiva entera (sigue visible y el
 * lienzo no salta).
 *
 * 'input' se ve al momento sin entrar en el historial y 'change' guarda un paso para deshacer.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const DEFAULT_HIGHLIGHT = '#ffff00';
    const PARA_FIELDS = ['lineHeight', 'spaceBefore', 'spaceAfter', 'style'];

    let bar = null;
    let shownId = null;

    function selectedText() {
        const el = XiroCanvasEditor.getSelected();
        return el && el.type === 'text' ? el : null;
    }

    function press(button, on) {
        button.classList.toggle('is-on', on);
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
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

    function renderCharacter(p) {
        const runs = p.runs || [{ text: p.text }];
        bar.querySelectorAll('[data-tb-toggle]').forEach(b => {
            const key = b.getAttribute('data-tb-toggle');
            press(b, !!p[key] || runs.every(run => run[key]));
        });
        bar.querySelectorAll('[data-tb-script]').forEach(b =>
            press(b, runs.every(run => run.script === b.getAttribute('data-tb-script')))
        );
    }

    function renderParagraph(el, sameText) {
        const p = el.props;
        bar.querySelectorAll('[data-tb-align]').forEach(b => press(b, p.align === b.getAttribute('data-tb-align')));
        bar.querySelectorAll('[data-tb-list]').forEach(b => press(b, p.list === b.getAttribute('data-tb-list')));
        const paras = XiroCanvasEditor.textFormat.paras(el);
        PARA_FIELDS.forEach(key => {
            const value = common(paras.map(para => para[key]));
            setField(key, value === undefined ? '' : String(value), sameText);
        });
    }

    /** Activa la barra con los valores del texto seleccionado (o la desactiva). */
    function render() {
        if (!bar) return;
        const el = selectedText();
        bar.disabled = !el;
        bar.title = el ? '' : XiroCanvasEditor.t('tb.idle');
        if (!el) {
            shownId = null;
            bar.querySelectorAll('[aria-pressed]').forEach(b => press(b, false));
            return;
        }
        const sameText = el.id === shownId;
        shownId = el.id;
        const p = el.props;
        const runs = p.runs || [{ text: p.text }];
        setField('font', p.font, sameText);
        setField('size', p.size, sameText);
        setField('color', p.color.slice(0, 7), sameText);
        setField('highlight', (common(runs.map(run => run.highlight)) || DEFAULT_HIGHLIGHT).slice(0, 7), sameText);
        renderCharacter(p);
        renderParagraph(el, sameText);
    }

    function onField(event, silent) {
        const el = selectedText();
        const key = event.target.getAttribute('data-tb');
        if (el && key) XiroCanvasEditor.textFormat.field(el, key, event.target.value, silent);
    }

    function onClick(event) {
        const el = selectedText();
        const button = event.target.closest('button');
        if (el && button) XiroCanvasEditor.textFormat.click(el, button);
    }

    XiroCanvasEditor.textbar = {
        attach(barEl) {
            bar = barEl;
            shownId = null;
            bar.innerHTML = XiroCanvasEditor.textbarHtml.html();
            bar.addEventListener('input', e => onField(e, true));
            bar.addEventListener('change', e => onField(e, false));
            bar.addEventListener('click', onClick);
            // Los botones no se llevan el foco: así no se pierde la selección del texto que se escribe
            bar.addEventListener('mousedown', e => {
                if (e.target.closest('button')) e.preventDefault();
            });
            XiroCanvasEditor.onRender(render);
            render();
        },
        detach() {
            XiroCanvasEditor.offRender(render);
            bar = null;
        },
        refresh: render
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.textbar;
})();
