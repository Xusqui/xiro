/**
 * @fileoverview Barra de formato del editor de diapositivas libres: con un cuadro de texto
 * seleccionado muestra, junto a la barra de herramientas, fuente, tamaño (con − y +),
 * negrita, cursiva, color y alineación. Son los mismos campos que el panel de la derecha
 * (slides-canvas-props-text.js), pero siempre a la vista.
 *
 * Igual que el panel: 'input' se ve al momento sin entrar en el historial y 'change'
 * guarda un paso para deshacer.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = root.XiroCanvasEditor = root.XiroCanvasEditor || {};

    const SIZE_STEP = 4;
    const ALIGNS = [['left', 'fa-align-left', 'Alinear a la izquierda'], ['center', 'fa-align-center', 'Centrar'], ['right', 'fa-align-right', 'Alinear a la derecha']];

    let bar = null;
    let shownId = null;

    function button(attrs, icon, title) {
        return '<button type="button" class="xsce-tb-btn" ' + attrs + ' title="' + title + '" aria-label="' + title + '"><i class="fas ' + icon + '"></i></button>';
    }

    function html() {
        const families = root.XiroSlideCanvas.FONTS;
        const fonts = XiroCanvasEditor.FONT_OPTIONS.map((f) => '<option value="' + f[0] + '" style="font-family:' + families[f[0]].replace(/"/g, '') + '">' + f[1] + '</option>').join('');
        return '<select class="xsce-tb-font" data-tb="font" title="Fuente" aria-label="Fuente">' + fonts + '</select>'
            + button('data-tb-step="-' + SIZE_STEP + '"', 'fa-minus', 'Letra más pequeña')
            + '<input type="number" class="xsce-tb-size" data-tb="size" min="8" max="400" title="Tamaño de letra" aria-label="Tamaño de letra">'
            + button('data-tb-step="' + SIZE_STEP + '"', 'fa-plus', 'Letra más grande')
            + '<span class="xsce-tb-sep"></span>'
            + button('data-tb-toggle="bold"', 'fa-bold', 'Negrita')
            + button('data-tb-toggle="italic"', 'fa-italic', 'Cursiva')
            + '<input type="color" class="xsce-tb-color" data-tb="color" title="Color del texto" aria-label="Color del texto">'
            + '<span class="xsce-tb-sep"></span>'
            + ALIGNS.map((a) => button('data-tb-align="' + a[0] + '"', a[1], a[2])).join('');
    }

    function selectedText() {
        const el = XiroCanvasEditor.getSelected();
        return el && el.type === 'text' ? el : null;
    }

    /** Muestra la barra con los valores del texto seleccionado (o la oculta). */
    function render() {
        if (!bar) return;
        const el = selectedText();
        bar.hidden = !el;
        if (!el) {
            shownId = null;
            return;
        }
        // No se pisa el número que se está escribiendo
        const typing = el.id === shownId && document.activeElement === bar.querySelector('[data-tb="size"]');
        shownId = el.id;
        const p = el.props;
        bar.querySelector('[data-tb="font"]').value = p.font;
        if (!typing) bar.querySelector('[data-tb="size"]').value = p.size;
        bar.querySelector('[data-tb="color"]').value = p.color.slice(0, 7);
        bar.querySelectorAll('[data-tb-toggle]').forEach((b) => b.classList.toggle('is-on', !!p[b.getAttribute('data-tb-toggle')]));
        bar.querySelectorAll('[data-tb-align]').forEach((b) => b.classList.toggle('is-on', p.align === b.getAttribute('data-tb-align')));
    }

    function setProp(key, value, silent) {
        const el = selectedText();
        if (el) XiroCanvasEditor.updateElement(el.id, { props: { [key]: value }, silent });
    }

    function onField(event, silent) {
        const key = event.target.getAttribute('data-tb');
        if (!key) return;
        if (key === 'size') {
            const size = parseFloat(event.target.value);
            if (Number.isFinite(size)) setProp('size', size, silent);
            return;
        }
        // El desplegable solo avisa con 'change'; el color también con 'input' (vista previa)
        if (!silent || key === 'color') setProp(key, event.target.value, silent);
    }

    function onClick(event) {
        const el = selectedText();
        const target = event.target.closest('button');
        if (!el || !target) return;
        const step = target.getAttribute('data-tb-step');
        const toggle = target.getAttribute('data-tb-toggle');
        const align = target.getAttribute('data-tb-align');
        if (step) setProp('size', el.props.size + Number(step));
        if (toggle) setProp(toggle, !el.props[toggle]);
        if (align) setProp('align', align);
    }

    XiroCanvasEditor.textbar = {
        html,
        attach(barEl) {
            bar = barEl;
            shownId = null;
            bar.innerHTML = html();
            bar.addEventListener('input', (e) => onField(e, true));
            bar.addEventListener('change', (e) => onField(e, false));
            bar.addEventListener('click', onClick);
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
