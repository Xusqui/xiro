/**
 * @fileoverview Escenario editable del editor de diapositivas libres: pinta el lienzo con
 * core/slide-canvas-render.js (modo 'editor') y, dentro del propio escenario de 1920x1080,
 * una capa con la selección, los tiradores, las guías y el cuadro de edición de texto.
 * Todo se coloca en unidades lógicas, así que la escala del lienzo no altera la geometría;
 * solo el tamaño en pantalla de tiradores y guías.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const HANDLE_POS = {
        nw: [0, 0],
        n: [0.5, 0],
        ne: [1, 0],
        e: [1, 0.5],
        se: [1, 1],
        s: [0.5, 1],
        sw: [0, 1],
        w: [0, 0.5]
    };
    const TEXT_STYLE_KEYS = [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'color',
        'textAlign',
        'backgroundColor'
    ];

    let host = null;
    let mounted = null;
    let overlay = null;
    let editingId = null;

    function px(v) {
        return v + 'px';
    }

    function scale() {
        return mounted && mounted.scale ? mounted.scale : 1;
    }

    function isLine(el) {
        return el.type === 'shape' && (el.props.shape === 'line' || el.props.shape === 'arrow');
    }

    /** Coloca un nodo en la caja lógica b (con su giro). */
    function placeBox(node, b) {
        node.style.left = px(b.x);
        node.style.top = px(b.y);
        node.style.width = px(b.w);
        node.style.height = px(b.h);
        const rotate = b.rotation ? 'rotate(' + b.rotation + 'deg)' : '';
        node.style.webkitTransform = rotate;
        node.style.transform = rotate;
    }

    function addDiv(parent, className, b) {
        const node = document.createElement('div');
        node.className = className;
        if (b) placeBox(node, b);
        parent.appendChild(node);
        return node;
    }

    function addHandle(parent, name, x, y) {
        const size = 14 / scale();
        const handle = addDiv(parent, 'xsce-handle xsce-handle--' + name);
        handle.setAttribute('data-handle', name);
        handle.style.width = px(size);
        handle.style.height = px(size);
        handle.style.left = px(x - size / 2);
        handle.style.top = px(y - size / 2);
    }

    /** Selección: caja girada con 8 tiradores, o 2 extremos en líneas y flechas. */
    function drawSelection(el) {
        overlay.querySelectorAll('.xsce-selection, .xsce-handle--p1, .xsce-handle--p2').forEach(n => n.remove());
        if (isLine(el)) {
            const p = XiroCanvasEditor.geometry.lineEndpoints(el);
            addHandle(overlay, 'p1', p.x1, p.y1);
            addHandle(overlay, 'p2', p.x2, p.y2);
            return;
        }
        const selection = addDiv(overlay, 'xsce-selection', el);
        selection.style.outlineWidth = px(2 / scale());
        Object.keys(HANDLE_POS).forEach(name =>
            addHandle(selection, name, HANDLE_POS[name][0] * el.w, HANDLE_POS[name][1] * el.h)
        );
    }

    function elementNode(id) {
        return mounted ? mounted.stage.querySelector('[data-el-id="' + id + '"]') : null;
    }

    function finishTextEdit() {
        if (!editingId) return;
        editingId = null;
        XiroCanvasEditor.setMode('selected');
        XiroCanvasEditor.commit();
    }

    /** Cuadro de texto editable encima del elemento (el original se oculta mientras tanto). */
    function startTextEdit(el) {
        editingId = el.id;
        const node = elementNode(el.id);
        const text = node ? node.querySelector('.xsc-text') : null;
        if (node) node.style.visibility = 'hidden';
        const area = document.createElement('textarea');
        area.className = 'xsce-textedit';
        placeBox(area, el);
        if (text)
            TEXT_STYLE_KEYS.forEach(key => {
                area.style[key] = text.style[key];
            });
        area.value = el.props.text;
        overlay.appendChild(area);
        area.addEventListener('input', () =>
            XiroCanvasEditor.updateElement(el.id, { props: { text: area.value }, silent: true })
        );
        area.addEventListener('keydown', event => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault();
                area.blur();
            }
        });
        area.addEventListener('blur', finishTextEdit);
        area.focus();
        area.setSelectionRange(area.value.length, area.value.length);
    }

    /** Repinta lienzo y capa; no lo hace mientras se escribe (perdería el foco). */
    function refresh() {
        if (!host || (editingId && overlay && overlay.querySelector('.xsce-textedit'))) return;
        if (mounted) mounted.destroy();
        const state = XiroCanvasEditor.state;
        mounted = root.XiroSlideCanvasRender.mount(host, state.canvas, {
            mode: 'editor',
            labels: XiroCanvasEditor.videoLabels()
        });
        overlay = addDiv(mounted.stage, 'xsce-overlay');
        const el = XiroCanvasEditor.getSelected();
        if (!el) return;
        drawSelection(el);
        if (state.mode === 'editing' && el.type === 'text') startTextEdit(el);
    }

    /** Durante un arrastre: mueve el nodo y la selección sin repintar todo el lienzo. */
    function previewBox(id, b) {
        const node = elementNode(id);
        const el = XiroCanvasEditor.getElement(id);
        if (!node || !el) return;
        placeBox(node, b);
        drawSelection(Object.assign({}, el, b));
    }

    function showGuides(guides) {
        hideGuides();
        if (!overlay || !guides) return;
        const width = 2 / scale();
        (guides.v || []).forEach(x => addDiv(overlay, 'xsce-guide', { x: x - width / 2, y: 0, w: width, h: 1080 }));
        (guides.h || []).forEach(y => addDiv(overlay, 'xsce-guide', { x: 0, y: y - width / 2, w: 1920, h: width }));
    }

    function hideGuides() {
        if (overlay) overlay.querySelectorAll('.xsce-guide').forEach(n => n.remove());
    }

    function onResize() {
        refresh();
    }

    XiroCanvasEditor.stage = {
        attach(hostEl) {
            host = hostEl;
            editingId = null;
            XiroCanvasEditor.onRender(refresh);
            window.addEventListener('resize', onResize);
            refresh();
        },
        detach() {
            XiroCanvasEditor.offRender(refresh);
            if (mounted) mounted.destroy();
            window.removeEventListener('resize', onResize);
            host = null;
            mounted = null;
            overlay = null;
            editingId = null;
        },
        refresh,
        previewBox,
        showGuides,
        hideGuides,
        getScale: scale,
        isEditingText: () => editingId !== null
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.stage;
})();
