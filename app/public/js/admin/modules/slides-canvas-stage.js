/**
 * @fileoverview Escenario editable del editor de diapositivas libres: pinta el lienzo con
 * core/slide-canvas-render.js (modo 'editor') y, dentro del propio escenario de 1920x1080,
 * una capa con la selección, los tiradores, las guías y el cuadro de edición de texto
 * (slides-canvas-textedit.js).
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
    let host = null;
    let mounted = null;
    let overlay = null;

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

    /** Selección: tiradores solo con un elemento sin bloquear; si no, un recuadro por elemento. */
    function drawSelection(list) {
        overlay.querySelectorAll('.xsce-selection, .xsce-handle--p1, .xsce-handle--p2').forEach(n => n.remove());
        if (list.length === 1 && !list[0].locked) return drawSingle(list[0]);
        list.forEach(el => {
            const kind = el.locked ? 'xsce-selection--locked' : 'xsce-selection--multi';
            addDiv(overlay, 'xsce-selection ' + kind, el).style.outlineWidth = px(2 / scale());
        });
    }

    function selectedList() {
        return XiroCanvasEditor.getSelectedIds().map(XiroCanvasEditor.getElement);
    }

    /** Un elemento libre: caja girada con 8 tiradores, o 2 extremos en líneas y flechas. */
    function drawSingle(el) {
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

    // Celdas de tabla (slides-canvas-table-celledit.js); opcional para las suites que no lo cargan
    const cellEdit = () => XiroCanvasEditor.tableCellEdit || null;

    function isWriting() {
        const cells = cellEdit();
        return XiroCanvasEditor.textEdit.isOpenIn(overlay) || !!(cells && cells.isOpenIn(overlay));
    }

    /** En modo edición abre el cuadro del texto o la celda de la tabla seleccionada. */
    function startEditing(el) {
        if (!el || XiroCanvasEditor.state.mode !== 'editing') return;
        if (el.type === 'text') XiroCanvasEditor.textEdit.start(el, overlay, elementNode(el.id));
        else if (el.type === 'table' && cellEdit()) cellEdit().start(el, overlay, elementNode(el.id));
    }

    function resetEditors() {
        XiroCanvasEditor.textEdit.reset();
        if (cellEdit()) cellEdit().reset();
    }

    /** Repinta lienzo y capa; no lo hace mientras se escribe (perdería el foco). */
    function refresh() {
        if (!host || isWriting()) return;
        if (mounted) mounted.destroy();
        const state = XiroCanvasEditor.state;
        mounted = root.XiroSlideCanvasRender.mount(host, state.canvas, {
            mode: 'editor',
            labels: XiroCanvasEditor.videoLabels()
        });
        overlay = addDiv(mounted.stage, 'xsce-overlay');
        drawSelection(selectedList());
        startEditing(XiroCanvasEditor.getSelected());
    }

    /**
     * Durante un arrastre: mueve los nodos y la selección sin repintar todo el lienzo.
     * @param {Object<string, Object>} boxes - Caja lógica nueva por id.
     */
    function previewBoxes(boxes) {
        Object.keys(boxes).forEach(id => {
            const node = elementNode(id);
            if (node) placeBox(node, boxes[id]);
        });
        drawSelection(selectedList().map(el => Object.assign({}, el, boxes[el.id])));
    }

    /** Marco de selección en unidades lógicas; null lo quita. */
    function showMarquee(rect) {
        const old = overlay ? overlay.querySelector('.xsce-marquee') : null;
        if (old) old.remove();
        if (!overlay || !rect) return;
        const x = Math.min(rect.x, rect.x + rect.w);
        const y = Math.min(rect.y, rect.y + rect.h);
        const box = { x, y, w: Math.abs(rect.w), h: Math.abs(rect.h) };
        addDiv(overlay, 'xsce-marquee', box).style.borderWidth = px(1 / scale());
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
            resetEditors();
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
            resetEditors();
        },
        refresh,
        previewBox: (id, box) => previewBoxes({ [id]: box }),
        previewBoxes,
        showMarquee,
        stageNode: () => (mounted ? mounted.stage : null),
        showGuides,
        hideGuides,
        getScale: scale,
        isEditingText: () => XiroCanvasEditor.textEdit.isEditing() || !!(cellEdit() && cellEdit().isEditing())
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.stage;
})();
