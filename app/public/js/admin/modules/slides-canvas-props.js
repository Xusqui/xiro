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

    // Etiquetas: claves admin.canvas.* (slides-canvas-i18n.js)
    const GEOMETRY_FIELDS = [
        { key: 'x', label: 'field.x', kind: 'number', min: -1920, max: 3840 },
        { key: 'y', label: 'field.y', kind: 'number', min: -1080, max: 2160 },
        { key: 'w', label: 'field.w', kind: 'number', min: 20, max: 3840 },
        { key: 'h', label: 'field.h', kind: 'number', min: 20, max: 2160 },
        { key: 'rotation', label: 'field.rotation', kind: 'number', min: -180, max: 180 }
    ];
    const BACKGROUND_FIELDS = [
        { key: 'color', label: 'field.background_color', kind: 'color' },
        { label: 'field.background_image', kind: 'action', action: 'bg-image', icon: 'fa-image' },
        { label: 'field.background_clear', kind: 'action', action: 'bg-clear', icon: 'fa-xmark', quiet: true, when: (bg) => !!bg.image }
    ];
    // Cabecera del panel: icono de cada tipo (el título lo da propsByType)
    const TYPE_ICONS = { text: 'fa-font', shape: 'fa-shapes', image: 'fa-image', video: 'fa-film' };
    const SHAPES = ['rect', 'ellipse', 'line', 'arrow'];
    const GEOMETRY_KEYS = ['x', 'y', 'w', 'h', 'rotation'];

    let panel = null;
    let shownId = undefined;

    function section(title, body) {
        return '<section class="xsce-section">' + (title ? '<h5>' + title + '</h5>' : '') + body + '</section>';
    }

    function head(icon, title, subtitle) {
        return '<header class="xsce-panel-head"><span class="xsce-panel-icon"><i class="fas ' + icon + '" aria-hidden="true"></i></span>'
            + '<div><h4>' + title + '</h4><p>' + subtitle + '</p></div></header>';
    }

    function subtitle(el) {
        const th = XiroCanvasEditor.th;
        if (el.type === 'shape') return th(SHAPES.indexOf(el.props.shape) >= 0 ? 'tool.' + el.props.shape : 'type.shape');
        const elements = XiroCanvasEditor.state.canvas.elements;
        return th('panel.layer', { n: elements.indexOf(el) + 1, total: elements.length });
    }

    function emptyTip() {
        const key = '<kbd>' + XiroCanvasEditor.th('hint_dblclick_key') + '</kbd>';
        return '<p class="xsce-tip">' + XiroCanvasEditor.th('panel.tip').replace('{dblclick}', key) + '</p>';
    }

    function render(state) {
        if (!panel) return;
        const F = XiroCanvasEditor.propsFields;
        const el = XiroCanvasEditor.getSelected();
        const id = el ? el.id : null;
        // No se repinta el campo en el que se está escribiendo (perdería el cursor)
        if (id === shownId && panel.contains(document.activeElement) && document.activeElement !== panel) return;
        shownId = id;
        const th = XiroCanvasEditor.th;
        if (!el) {
            const bg = state.canvas.background;
            const count = state.canvas.elements.length;
            panel.innerHTML = head('fa-object-group', th('panel.slide'), count === 1 ? th('panel.count_one') : th('panel.count_many', { n: count }))
                + section(th('panel.background'), F.fieldsHtml(BACKGROUND_FIELDS, bg, bg)) + emptyTip();
            return;
        }
        const type = XiroCanvasEditor.propsByType[el.type];
        // Primero lo propio del elemento (texto, fuente, colores…); la geometría también se cambia arrastrando
        panel.innerHTML = head(TYPE_ICONS[el.type] || 'fa-shapes', th(type ? type.title : 'type.shape'), subtitle(el))
            + (type ? section('', F.fieldsHtml(type.fields, el.props, el)) : '')
            + section(th('panel.geometry'), '<div class="xsce-grid2">' + F.fieldsHtml(GEOMETRY_FIELDS, el, el) + '</div>');
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
                if (e.target.type === 'checkbox') return;
                // El código junto a la muestra sigue al color mientras se elige
                if (e.target.type === 'color' && e.target.nextElementSibling) e.target.nextElementSibling.textContent = e.target.value;
                apply(e.target, true);
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
