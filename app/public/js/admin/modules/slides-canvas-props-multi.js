/**
 * @fileoverview Panel de propiedades con dos o más elementos seleccionados: alinear al
 * contorno común, distribuir (tres o más), agrupar, desagrupar y bloquear.
 * slides-canvas-props.js lo pinta en lugar del panel de un elemento y le pasa los clics.
 * Font Awesome 6.0 no trae iconos de alineación vertical: se giran los horizontales.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    // [modo de XiroSlideCanvasAlign, icono]
    const ALIGN = [
        ['left', 'fa-align-left'],
        ['centerH', 'fa-align-center'],
        ['right', 'fa-align-right'],
        ['top', 'fa-align-left fa-rotate-90'],
        ['middleV', 'fa-align-center fa-rotate-90'],
        ['bottom', 'fa-align-right fa-rotate-90']
    ];
    const DISTRIBUTE = [
        ['h', 'fa-arrows-left-right'],
        ['v', 'fa-arrows-up-down']
    ];
    const ACTIONS = {
        group: () => E.groupSelection(),
        ungroup: () => E.ungroupSelection(),
        lock: () => E.toggleLockSelection()
    };

    function iconButton(action, icon, label, disabled) {
        return (
            '<button type="button" class="xsce-seg-btn xiro-toolbar-btn" data-canvas-panel-action="' +
            action +
            '" aria-label="' +
            label +
            '" data-tooltip="' +
            label +
            '"' +
            (disabled ? ' disabled' : '') +
            '><i class="fas ' +
            icon +
            '" aria-hidden="true"></i></button>'
        );
    }

    function textButton(action, icon, label) {
        return (
            '<button type="button" class="xsce-action" data-canvas-panel-action="' +
            action +
            '"><i class="fas ' +
            icon +
            '" aria-hidden="true"></i>' +
            label +
            '</button>'
        );
    }

    function alignRow(th, count) {
        const align = ALIGN.map(a => iconButton('align-' + a[0], a[1], th('arrange.' + a[0]))).join('');
        const spread = DISTRIBUTE.map(d =>
            iconButton('distribute-' + d[0], d[1], th('arrange.distribute_' + d[0]), count < 3)
        ).join('');
        return (
            '<div class="xsce-stack"><div class="xsce-seg" role="group">' +
            align +
            '</div><div class="xsce-seg xsce-seg--two" role="group">' +
            spread +
            '</div></div>'
        );
    }

    function arrangeRow(th, list) {
        const grouped = list.some(el => el.groupId);
        const locked = list.every(el => el.locked);
        return (
            '<div class="xsce-stack">' +
            textButton('group', 'fa-object-group', th('tool.group')) +
            (grouped ? textButton('ungroup', 'fa-object-ungroup', th('tool.ungroup')) : '') +
            textButton('lock', locked ? 'fa-lock-open' : 'fa-lock', th(locked ? 'tool.unlock' : 'tool.lock')) +
            '</div>'
        );
    }

    E.propsMulti = {
        /**
         * HTML del panel para la selección actual.
         * @param {Object} parts - Ayudantes del panel: { head, section }.
         * @returns {string}
         */
        html(parts) {
            const th = E.th;
            const list = E.getSelectedIds().map(E.getElement);
            return (
                parts.head('fa-object-group', th('panel.multi_title'), th('panel.count_many', { n: list.length })) +
                parts.section(th('panel.align'), alignRow(th, list.length)) +
                parts.section(th('panel.arrange'), arrangeRow(th, list))
            );
        },

        /**
         * Ejecuta un botón del panel múltiple.
         * @param {string} action - Valor de data-canvas-panel-action.
         * @returns {boolean} true si la acción era de este panel.
         */
        handle(action) {
            if (action.indexOf('align-') === 0) E.alignSelection(action.slice(6));
            else if (action.indexOf('distribute-') === 0) E.distributeSelection(action.slice(11));
            else if (ACTIONS[action]) ACTIONS[action]();
            else return false;
            return true;
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.propsMulti;
})();
