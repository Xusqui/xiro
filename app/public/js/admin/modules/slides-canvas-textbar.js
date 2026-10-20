/**
 * @fileoverview Barra de formato del editor de diapositivas libres: con un cuadro de texto
 * seleccionado muestra, junto a la barra de herramientas, fuente, tamaño (con − y +),
 * negrita, cursiva, color y alineación. Son los mismos campos que el panel de la derecha
 * (slides-canvas-props-text.js), pero siempre a la vista. La barra es un <fieldset>: sin
 * texto seleccionado se desactiva entera (sigue visible y el lienzo no salta).
 *
 * Igual que el panel: 'input' se ve al momento sin entrar en el historial y 'change'
 * guarda un paso para deshacer.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const SIZE_STEP = 4;
    // Textos: claves admin.canvas.tb.* (slides-canvas-i18n.js)
    const ALIGNS = [
        ['left', 'fa-align-left'],
        ['center', 'fa-align-center'],
        ['right', 'fa-align-right']
    ];

    let bar = null;
    let shownId = null;

    function button(attrs, icon, key) {
        const title = XiroCanvasEditor.th(key);
        return (
            '<button type="button" class="xsce-tool xiro-toolbar-btn" ' +
            attrs +
            ' data-tooltip="' +
            title +
            '" aria-label="' +
            title +
            '"><i class="fas ' +
            icon +
            '" aria-hidden="true"></i></button>'
        );
    }

    function html() {
        const th = XiroCanvasEditor.th;
        const families = root.XiroSlideCanvas.FONTS;
        const fonts = XiroCanvasEditor.FONT_OPTIONS.map(
            f =>
                '<option value="' +
                f[0] +
                '" style="font-family:' +
                families[f[0]].replace(/"/g, '') +
                '">' +
                th(f[1]) +
                '</option>'
        ).join('');
        return (
            '<select class="xsce-tb-font" data-tb="font" title="' +
            th('tb.font') +
            '" aria-label="' +
            th('tb.font') +
            '">' +
            fonts +
            '</select>' +
            button('data-tb-step="-' + SIZE_STEP + '"', 'fa-minus', 'tb.smaller') +
            '<input type="number" class="xsce-tb-size" data-tb="size" min="8" max="400" title="' +
            th('tb.size') +
            '" aria-label="' +
            th('tb.size') +
            '">' +
            button('data-tb-step="' + SIZE_STEP + '"', 'fa-plus', 'tb.bigger') +
            '<span class="xsce-sep" aria-hidden="true"></span>' +
            button('data-tb-toggle="bold"', 'fa-bold', 'tb.bold') +
            button('data-tb-toggle="italic"', 'fa-italic', 'tb.italic') +
            '<input type="color" class="xsce-swatch" data-tb="color" title="' +
            th('tb.color') +
            '" aria-label="' +
            th('tb.color') +
            '">' +
            '<span class="xsce-sep" aria-hidden="true"></span>' +
            ALIGNS.map(a => button('data-tb-align="' + a[0] + '"', a[1], 'tb.align_' + a[0])).join('')
        );
    }

    function selectedText() {
        const el = XiroCanvasEditor.getSelected();
        return el && el.type === 'text' ? el : null;
    }

    /** Activa la barra con los valores del texto seleccionado (o la desactiva). */
    function render() {
        if (!bar) return;
        const el = selectedText();
        bar.disabled = !el;
        bar.title = el ? '' : XiroCanvasEditor.t('tb.idle');
        if (!el) {
            shownId = null;
            bar.querySelectorAll('.is-on').forEach(b => b.classList.remove('is-on'));
            return;
        }
        // No se pisa el número que se está escribiendo
        const typing = el.id === shownId && document.activeElement === bar.querySelector('[data-tb="size"]');
        shownId = el.id;
        const p = el.props;
        bar.querySelector('[data-tb="font"]').value = p.font;
        if (!typing) bar.querySelector('[data-tb="size"]').value = p.size;
        bar.querySelector('[data-tb="color"]').value = p.color.slice(0, 7);
        bar.querySelectorAll('[data-tb-toggle]').forEach(b =>
            b.classList.toggle('is-on', !!p[b.getAttribute('data-tb-toggle')])
        );
        bar.querySelectorAll('[data-tb-align]').forEach(b =>
            b.classList.toggle('is-on', p.align === b.getAttribute('data-tb-align'))
        );
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
            bar.addEventListener('input', e => onField(e, true));
            bar.addEventListener('change', e => onField(e, false));
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
