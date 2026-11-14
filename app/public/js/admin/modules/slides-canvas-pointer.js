/**
 * @fileoverview Interacción con el puntero en el editor de diapositivas libres: seleccionar
 * (Mayús+clic o el modo «Selección múltiple» suman a la selección), marco de selección sobre
 * el lienzo vacío, mover uno o varios, redimensionar (8 tiradores, también con giro),
 * arrastrar los extremos de líneas y flechas y doble clic para escribir.
 * Los elementos bloqueados se seleccionan pero no se mueven ni tienen tiradores.
 *
 * Las coordenadas de pantalla se pasan a unidades lógicas dividiendo por la escala real del
 * escenario (stage.getScale), así que el resultado no depende del tamaño del editor.
 * Durante el arrastre solo se mueven los nodos (un fotograma por requestAnimationFrame);
 * al soltar se guarda una vez en el estado y en el historial. Teclado: slides-canvas-keys.js.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const DRAG_THRESHOLD_PX = 3;

    let host = null;
    let drag = null;
    let pending = null;
    let frame = 0;

    const scale = () => E.stage.getScale() || 1;
    const additive = event => event.shiftKey || !!E.state.multiMode;

    function boxOf(el) {
        return { x: el.x, y: el.y, w: el.w, h: el.h, rotation: el.rotation };
    }

    function begin(event, fields) {
        drag = Object.assign({ startX: event.clientX, startY: event.clientY, moved: false }, fields);
        event.preventDefault();
    }

    function startDrag(event, kind, el) {
        begin(event, { kind, id: el.id, start: boxOf(el), ends: E.geometry.lineEndpoints(el), box: null });
    }

    /** Arrastre en bloque: se ajusta a las guías el contorno común, no cada elemento. */
    function startGroupDrag(event, movable, collapseTo) {
        const starts = {};
        movable.forEach(el => (starts[el.id] = boxOf(el)));
        const b = root.XiroSlideCanvasAlign.boundsOf(movable);
        const bounds = { x: b.left, y: b.top, w: b.right - b.left, h: b.bottom - b.top };
        begin(event, { kind: 'group', starts, bounds, collapseTo, delta: null });
    }

    function startMarquee(event) {
        if (!additive(event)) E.select(null);
        const r = E.stage.stageNode().getBoundingClientRect();
        const origin = { x: (event.clientX - r.left) / scale(), y: (event.clientY - r.top) / scale() };
        begin(event, { kind: 'marquee', origin, base: additive(event) ? E.getSelectedIds() : [], rect: null });
    }

    /** Pulsar un elemento: suma/quita, o lo selecciona y empieza a moverlo (con su grupo). */
    function pressElement(event, id) {
        if (additive(event)) {
            E.toggleSelection(id);
            event.preventDefault();
            return;
        }
        const wasSelected = E.getSelectedIds().indexOf(id) >= 0;
        if (!wasSelected) E.selectMany([id]);
        const ids = E.getSelectedIds();
        const movable = ids.map(E.getElement).filter(el => !el.locked);
        if (!movable.length) return;
        if (ids.length === 1) startDrag(event, 'move', movable[0]);
        else startGroupDrag(event, movable, wasSelected ? id : null);
    }

    /** Caja resultante del arrastre de un elemento (movimiento, tirador o extremo de línea). */
    function computeBox(p) {
        const G = E.geometry;
        const dx = p.dx / scale();
        const dy = p.dy / scale();
        const el = E.getElement(drag.id);
        if (!el) return null;
        if (drag.kind === 'move') {
            const moved = G.moveBox(drag.start, dx, dy, { snap: !p.alt });
            E.stage.showGuides(moved.guides);
            return Object.assign({}, drag.start, { x: moved.x, y: moved.y });
        }
        if (drag.kind === 'p1' || drag.kind === 'p2') {
            const e = drag.ends;
            const p1 = drag.kind === 'p1' ? { x: e.x1 + dx, y: e.y1 + dy } : { x: e.x1, y: e.y1 };
            const p2 = drag.kind === 'p2' ? { x: e.x2 + dx, y: e.y2 + dy } : { x: e.x2, y: e.y2 };
            return G.lineFromEndpoints(p1, p2, drag.start.h);
        }
        // Las imágenes mantienen la proporción salvo con Mayúsculas; el resto, al revés
        const keepRatio = el.type === 'image' ? el.props.lockRatio !== p.shift : p.shift;
        return Object.assign(G.resizeBox(drag.start, drag.kind, dx, dy, { keepRatio }), {
            rotation: drag.start.rotation
        });
    }

    function applySingle() {
        const box = computeBox(pending);
        if (!box) return;
        const visible = E.geometry.keepVisible(box);
        box.x = visible.x;
        box.y = visible.y;
        drag.box = box;
        E.stage.previewBox(drag.id, box);
    }

    function applyGroup() {
        const G = E.geometry;
        const moved = G.moveBox(drag.bounds, pending.dx / scale(), pending.dy / scale(), { snap: !pending.alt });
        E.stage.showGuides(moved.guides);
        const visible = G.keepVisible(Object.assign({}, drag.bounds, { x: moved.x, y: moved.y }));
        const delta = { dx: Math.round(visible.x - drag.bounds.x), dy: Math.round(visible.y - drag.bounds.y) };
        const boxes = {};
        Object.keys(drag.starts).forEach(id => {
            const s = drag.starts[id];
            boxes[id] = Object.assign({}, s, { x: s.x + delta.dx, y: s.y + delta.dy });
        });
        drag.delta = delta;
        E.stage.previewBoxes(boxes);
    }

    function applyFrame() {
        frame = 0;
        if (!drag || !pending) return;
        if (drag.kind === 'marquee') {
            const o = drag.origin;
            drag.rect = { x: o.x, y: o.y, w: pending.dx / scale(), h: pending.dy / scale() };
            E.stage.showMarquee(drag.rect);
        } else if (drag.kind === 'group') applyGroup();
        else applySingle();
    }

    function onPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        const target = event.target;
        if (!target.closest || target.closest('.xsce-textedit, .xsce-celledit')) return;
        // pointerdown con preventDefault no quita el foco al cuadro de texto: se cierra aquí
        if (E.textEdit && E.textEdit.isEditing()) E.textEdit.finish();
        if (E.tableCellEdit && E.tableCellEdit.isEditing()) E.tableCellEdit.finish();
        const handle = target.closest('.xsce-handle');
        const selected = E.getSelected();
        if (handle && selected && !selected.locked) return startDrag(event, handle.getAttribute('data-handle'), selected);
        const node = target.closest('.xsc-el');
        if (node) return pressElement(event, node.getAttribute('data-el-id'));
        if (target.closest('.xsc-stage')) return startMarquee(event);
        E.select(null);
    }

    function onPointerMove(event) {
        if (!drag) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        if (!drag.moved) {
            // Se captura al empezar a arrastrar, no al pulsar: con captura, Chrome envía
            // click y dblclick al contenedor y el doble clic no encontraría el texto.
            try {
                host.setPointerCapture(event.pointerId);
            } catch (_) {
                /* puntero ya liberado */
            }
        }
        drag.moved = true;
        pending = { dx, dy, alt: event.altKey, shift: event.shiftKey };
        if (!frame) frame = root.requestAnimationFrame(applyFrame);
    }

    /** Guarda el resultado del arrastre en el estado (un solo paso de historial). */
    function finishDrag(done) {
        if (done.kind === 'marquee') {
            if (done.moved && done.rect) {
                const inside = root.XiroSlideCanvasAlign.idsInsideRect(E.state.canvas.elements, done.rect);
                E.selectMany(done.base.concat(inside));
            } else E.stage.showMarquee(null);
            return;
        }
        // Clic sin arrastrar sobre un miembro de una selección múltiple: queda solo él
        if (!done.moved) return done.collapseTo && E.selectMany([done.collapseTo]);
        if (done.kind === 'group') return done.delta && E.moveSelectionBy(done.delta.dx, done.delta.dy);
        if (!done.box) return;
        const b = done.box;
        E.updateElement(done.id, { x: b.x, y: b.y, w: b.w, h: b.h, rotation: b.rotation });
    }

    function onPointerUp(event) {
        if (!drag) return;
        if (frame) {
            root.cancelAnimationFrame(frame);
            applyFrame();
        }
        const done = drag;
        drag = null;
        pending = null;
        try {
            host.releasePointerCapture(event.pointerId);
        } catch (_) {
            /* captura ya liberada */
        }
        E.stage.hideGuides();
        finishDrag(done);
    }

    function onDoubleClick(event) {
        if (E.tableCellEdit && E.tableCellEdit.openFromCell(event.target)) return;
        const node = event.target.closest ? event.target.closest('.xsc-el--text') : null;
        if (!node) return;
        E.select(node.getAttribute('data-el-id'));
        E.setMode('editing');
    }

    const LISTENERS = {
        pointerdown: onPointerDown,
        pointermove: onPointerMove,
        pointerup: onPointerUp,
        pointercancel: onPointerUp,
        dblclick: onDoubleClick
    };

    E.pointer = {
        attach(hostEl) {
            host = hostEl;
            Object.keys(LISTENERS).forEach(type => host.addEventListener(type, LISTENERS[type]));
            E.keys.listen();
        },
        detach() {
            if (!host) return;
            Object.keys(LISTENERS).forEach(type => host.removeEventListener(type, LISTENERS[type]));
            host = null;
            drag = null;
        },
        isAttached: () => host !== null
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.pointer;
})();
