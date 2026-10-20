/**
 * @fileoverview Interacción del editor de diapositivas libres: seleccionar, mover,
 * redimensionar (8 tiradores, también con giro), arrastrar los extremos de líneas y flechas,
 * doble clic para escribir y atajos de teclado.
 *
 * Las coordenadas de pantalla se pasan a unidades lógicas dividiendo por la escala real del
 * escenario (stage.getScale), así que el resultado no depende del tamaño del editor.
 * Durante el arrastre solo se mueve el nodo (stage.previewBox, un fotograma por
 * requestAnimationFrame); al soltar se guarda una vez en el estado y en el historial.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const DRAG_THRESHOLD_PX = 3;
    const EDITABLE = 'input, textarea, select, [contenteditable="true"]';

    let host = null;
    let drag = null;
    let pending = null;
    let frame = 0;
    let keyboardReady = false;

    function boxOf(el) {
        return { x: el.x, y: el.y, w: el.w, h: el.h, rotation: el.rotation };
    }

    function startDrag(event, kind, el) {
        drag = {
            kind,
            id: el.id,
            startX: event.clientX,
            startY: event.clientY,
            start: boxOf(el),
            ends: XiroCanvasEditor.geometry.lineEndpoints(el),
            moved: false,
            box: null
        };
        event.preventDefault();
    }

    /** Caja resultante del arrastre en curso (movimiento, tirador o extremo de línea). */
    function computeBox(p) {
        const G = XiroCanvasEditor.geometry;
        const s = XiroCanvasEditor.stage.getScale() || 1;
        const dx = p.dx / s;
        const dy = p.dy / s;
        const el = XiroCanvasEditor.getElement(drag.id);
        if (!el) return null;
        if (drag.kind === 'move') {
            const moved = G.moveBox(drag.start, dx, dy, { snap: !p.alt });
            XiroCanvasEditor.stage.showGuides(moved.guides);
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

    function applyFrame() {
        frame = 0;
        if (!drag || !pending) return;
        const box = computeBox(pending);
        if (!box) return;
        const visible = XiroCanvasEditor.geometry.keepVisible(box);
        box.x = visible.x;
        box.y = visible.y;
        drag.box = box;
        XiroCanvasEditor.stage.previewBox(drag.id, box);
    }

    function onPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        const target = event.target;
        if (!target.closest || target.closest('.xsce-textedit')) return;
        const handle = target.closest('.xsce-handle');
        const selected = XiroCanvasEditor.getSelected();
        if (handle && selected) {
            startDrag(event, handle.getAttribute('data-handle'), selected);
            return;
        }
        const node = target.closest('.xsc-el');
        if (!node) {
            XiroCanvasEditor.select(null);
            return;
        }
        const id = node.getAttribute('data-el-id');
        if (XiroCanvasEditor.state.selectedId !== id) XiroCanvasEditor.select(id);
        const el = XiroCanvasEditor.getElement(id);
        if (el) startDrag(event, 'move', el);
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
        XiroCanvasEditor.stage.hideGuides();
        if (done.moved && done.box) {
            const b = done.box;
            XiroCanvasEditor.updateElement(done.id, { x: b.x, y: b.y, w: b.w, h: b.h, rotation: b.rotation });
        }
    }

    function onDoubleClick(event) {
        const node = event.target.closest ? event.target.closest('.xsc-el--text') : null;
        if (!node) return;
        XiroCanvasEditor.select(node.getAttribute('data-el-id'));
        XiroCanvasEditor.setMode('editing');
    }

    function nudge(el, key, step) {
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        XiroCanvasEditor.updateElement(el.id, { x: el.x + dx, y: el.y + dy });
    }

    /** Acción de Ctrl/Cmd + tecla, o null. Deshacer y rehacer no necesitan selección. */
    function modifierAction(event, el) {
        const key = event.key.toLowerCase();
        if (key === 'z') return event.shiftKey ? XiroCanvasEditor.redo : XiroCanvasEditor.undo;
        if (key === 'y') return XiroCanvasEditor.redo;
        if (key === 'd' && el) return XiroCanvasEditor.duplicateSelected;
        return null;
    }

    /** Acción de una tecla sin modificador sobre el elemento seleccionado, o null. */
    function elementAction(event, el) {
        const key = event.key;
        if (key === 'Delete' || key === 'Backspace') return XiroCanvasEditor.removeSelected;
        if (key.indexOf('Arrow') === 0) return () => nudge(el, key, event.shiftKey ? 10 : 1);
        if (key === 'Escape') return () => XiroCanvasEditor.select(null);
        if (key === 'Enter' && el.type === 'text') return () => XiroCanvasEditor.setMode('editing');
        return null;
    }

    /** Atajos (solo con el editor abierto y sin foco en un campo). preventDefault marca la tecla como usada. */
    function onKeyDown(event) {
        if (!host || !document.getElementById('modalLienzo') || document.getElementById('modalLienzoMedia')) return;
        if (event.target && event.target.closest && event.target.closest(EDITABLE)) return;
        const el = XiroCanvasEditor.getSelected();
        let action = null;
        if (event.ctrlKey || event.metaKey) action = modifierAction(event, el);
        else if (el) action = elementAction(event, el);
        if (!action) return;
        event.preventDefault();
        action();
    }

    XiroCanvasEditor.pointer = {
        attach(hostEl) {
            host = hostEl;
            host.addEventListener('pointerdown', onPointerDown);
            host.addEventListener('pointermove', onPointerMove);
            host.addEventListener('pointerup', onPointerUp);
            host.addEventListener('pointercancel', onPointerUp);
            host.addEventListener('dblclick', onDoubleClick);
            if (!keyboardReady) {
                keyboardReady = true;
                document.addEventListener('keydown', onKeyDown);
            }
        },
        detach() {
            if (!host) return;
            host.removeEventListener('pointerdown', onPointerDown);
            host.removeEventListener('pointermove', onPointerMove);
            host.removeEventListener('pointerup', onPointerUp);
            host.removeEventListener('pointercancel', onPointerUp);
            host.removeEventListener('dblclick', onDoubleClick);
            host = null;
            drag = null;
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.pointer;
})();
