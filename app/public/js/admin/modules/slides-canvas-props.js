/**
 * @fileoverview Panel de propiedades del editor de diapositivas libres (columna derecha).
 * Sin selección muestra el fondo del lienzo; con un elemento, su posición y tamaño en
 * unidades lógicas (1920x1080) y los campos de su tipo (XiroCanvasEditor.propsByType).
 *
 * Mientras se escribe en un campo los cambios se ven al momento sin entrar en el historial
 * ('input', silent); al confirmar ('change') se guarda un paso para deshacer.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = root.XiroCanvasEditor = root.XiroCanvasEditor || {};

    const GEOMETRY_FIELDS = [
        { key: 'x', label: 'X', kind: 'number', min: -1920, max: 3840 },
        { key: 'y', label: 'Y', kind: 'number', min: -1080, max: 2160 },
        { key: 'w', label: 'Ancho', kind: 'number', min: 20, max: 3840 },
        { key: 'h', label: 'Alto', kind: 'number', min: 20, max: 2160 },
        { key: 'rotation', label: 'Giro (grados)', kind: 'number', min: -180, max: 180 }
    ];
    const BACKGROUND_FIELDS = [
        { key: 'color', label: 'Color de fondo', kind: 'color' },
        { label: 'Imagen de fondo', kind: 'action', action: 'bg-image' },
        { label: 'Quitar la imagen de fondo', kind: 'action', action: 'bg-clear', when: (bg) => !!bg.image }
    ];
    const GEOMETRY_KEYS = ['x', 'y', 'w', 'h', 'rotation'];

    let panel = null;
    let shownId = undefined;

    function section(title, body) {
        return '<h4 class="text-xs font-black uppercase text-slate-500 tracking-widest mb-3 mt-1">' + title + '</h4>' + body;
    }

    function render(state) {
        if (!panel) return;
        const F = XiroCanvasEditor.propsFields;
        const el = XiroCanvasEditor.getSelected();
        const id = el ? el.id : null;
        // No se repinta el campo en el que se está escribiendo (perdería el cursor)
        if (id === shownId && panel.contains(document.activeElement) && document.activeElement !== panel) return;
        shownId = id;
        if (!el) {
            const bg = state.canvas.background;
            panel.innerHTML = section('Fondo de la diapositiva', F.fieldsHtml(BACKGROUND_FIELDS, bg, bg))
                + '<p class="text-xs text-slate-400 mt-4">Selecciona un elemento para editarlo. Doble clic en un texto para escribir.</p>';
            return;
        }
        const type = XiroCanvasEditor.propsByType[el.type];
        // Primero lo propio del elemento (texto, fuente, colores…); la geometría también se cambia arrastrando
        panel.innerHTML = (type ? section(type.title, F.fieldsHtml(type.fields, el.props, el)) : '')
            + section('Posición y tamaño', '<div class="grid grid-cols-2 gap-x-2">' + F.fieldsHtml(GEOMETRY_FIELDS, el, el) + '</div>');
    }

    /** Aplica el cambio de un control al fondo o al elemento seleccionado. */
    function apply(input, silent) {
        const F = XiroCanvasEditor.propsFields;
        const el = XiroCanvasEditor.getSelected();
        const noneKey = input.getAttribute('data-canvas-none');
        const key = noneKey || input.getAttribute('data-canvas-prop');
        if (!key) return;
        if (!el) {
            if (key === 'color' && !silent) XiroCanvasEditor.setBackground({ color: input.value });
            return;
        }
        let value = noneKey ? null : F.readValue(input);
        if (noneKey && !input.checked) {
            const picker = panel.querySelector('[data-canvas-prop="' + key + '"]');
            value = picker ? picker.value : '#000000';
        }
        if (value === null && !noneKey) return;
        const patch = GEOMETRY_KEYS.indexOf(key) >= 0 ? { [key]: value } : { props: { [key]: value } };
        patch.silent = silent;
        XiroCanvasEditor.updateElement(el.id, patch);
        if (noneKey) shownId = undefined;
    }

    function onPanelAction(action) {
        const media = XiroCanvasEditor.media;
        const el = XiroCanvasEditor.getSelected();
        if (action === 'bg-image') media.openImage((r) => XiroCanvasEditor.setBackground({ image: r.src }));
        if (action === 'bg-clear') XiroCanvasEditor.setBackground({ image: null });
        if (action === 'change-image' && el) media.openImage((r) => XiroCanvasEditor.updateElement(el.id, { props: { src: r.src, ratio: r.ratio || null } }));
        if (action === 'change-video' && el) media.openVideo((r) => XiroCanvasEditor.updateElement(el.id, { props: { url: r.url } }));
    }

    XiroCanvasEditor.props = {
        attach(panelEl) {
            panel = panelEl;
            shownId = undefined;
            panel.addEventListener('input', (e) => {
                if (e.target.type !== 'checkbox') apply(e.target, true);
            });
            panel.addEventListener('change', (e) => apply(e.target, false));
            panel.addEventListener('click', (e) => {
                const button = e.target.closest('[data-canvas-panel-action]');
                if (button) onPanelAction(button.getAttribute('data-canvas-panel-action'));
            });
            XiroCanvasEditor.onRender(render);
            render(XiroCanvasEditor.state);
        },
        detach() {
            XiroCanvasEditor.offRender(render);
            panel = null;
        },
        refresh: render
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.props;
})();
