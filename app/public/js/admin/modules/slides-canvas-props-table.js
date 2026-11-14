/**
 * @fileoverview Panel de propiedades de las tablas de la diapositiva libre (fase D): añadir y
 * quitar filas y columnas, pegar desde una hoja de cálculo y el estilo (cabecera, fuente,
 * colores y borde). Las celdas se escriben en el lienzo (slides-canvas-table-celledit.js). Las operaciones sobre filas están en
 * slides-canvas-table-edit.js; slides-canvas-props.js llama a extraHtml, applyInput y onAction.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});
    E.propsByType = E.propsByType || {};

    // Acción del panel -> operación de slides-canvas-table-edit.js
    const GRID_OPS = {
        'table-add-row': 'addRow',
        'table-remove-row': 'removeRow',
        'table-add-col': 'addCol',
        'table-remove-col': 'removeCol'
    };
    const GRID_ACTIONS = [
        { label: 'table.add_row', kind: 'action', action: 'table-add-row', icon: 'fa-plus' },
        {
            label: 'table.remove_row',
            kind: 'action',
            action: 'table-remove-row',
            icon: 'fa-minus',
            quiet: true,
            when: el => el.props.rows.length > 1
        },
        { label: 'table.add_col', kind: 'action', action: 'table-add-col', icon: 'fa-plus' },
        {
            label: 'table.remove_col',
            kind: 'action',
            action: 'table-remove-col',
            icon: 'fa-minus',
            quiet: true,
            when: el => el.props.rows[0].length > 1
        }
    ];
    const PASTE_ACTION = [{ label: 'table.paste', kind: 'action', action: 'table-paste', icon: 'fa-paste' }];

    const FA = name => '<i class="fas ' + name + '" aria-hidden="true"></i>';
    // Fuente, color y alineación de toda la tabla (el texto los tiene en la barra de formato)
    const FONT_FIELD = { key: 'font', label: 'field.font', kind: 'select', options: E.FONT_OPTIONS };
    const COLOR_FIELD = { key: 'color', label: 'field.color', kind: 'color' };
    const ALIGN_FIELD = {
        key: 'align',
        label: 'field.align',
        kind: 'segment',
        options: [
            ['left', 'align.left', FA('fa-align-left')],
            ['center', 'align.center', FA('fa-align-center')],
            ['right', 'align.right', FA('fa-align-right')]
        ]
    };

    function pasteHtml(el) {
        return (
            '<div class="xsce-field"><label class="xsce-label" for="xsce-table-paste">' +
            E.th('table.paste_hint') +
            '</label><textarea class="xsce-input" id="xsce-table-paste" rows="3" data-table-paste></textarea></div>' +
            E.propsFields.fieldsHtml(PASTE_ACTION, {}, el)
        );
    }

    function update(el, rows) {
        E.updateElement(el.id, { props: { rows: rows } });
    }

    E.propsByType.table = {
        title: 'type.table',
        fields: [
            { key: 'header', label: 'field.header_row', kind: 'check' },
            FONT_FIELD,
            { key: 'size', label: 'field.size', kind: 'number', min: 8, max: 200 },
            COLOR_FIELD,
            ALIGN_FIELD,
            {
                key: 'headerFill',
                label: 'field.header_fill',
                kind: 'color',
                noneLabel: 'none.fill',
                when: el => el.props.header
            },
            { key: 'fill', label: 'field.fill', kind: 'color', noneLabel: 'none.fill' },
            { key: 'bandFill', label: 'field.band_fill', kind: 'color', noneLabel: 'none.fill' },
            { key: 'borderColor', label: 'field.border_color', kind: 'color', noneLabel: 'none.border' },
            { key: 'borderWidth', label: 'field.border_width', kind: 'number', min: 0, max: 20 }
        ],

        /** Filas, columnas y pegar, delante del estilo (las celdas se escriben en el lienzo). */
        extraHtml(el) {
            return (
                '<h5>' +
                E.th('field.cells') +
                '</h5>' +
                '<div class="xsce-table-actions">' +
                E.propsFields.fieldsHtml(GRID_ACTIONS, {}, el) +
                '</div>' +
                pasteHtml(el)
            );
        },

        /** La casilla de pegar solo se lee al pulsar su botón; @returns {boolean} si era ella. */
        applyInput(input) {
            return input.hasAttribute('data-table-paste');
        },

        /** Botones del panel; @returns {boolean} si la acción era de la tabla. */
        onAction(action, el, panel) {
            if (GRID_OPS[action]) {
                update(el, E.tableEdit[GRID_OPS[action]](el.props.rows));
                return true;
            }
            if (action !== 'table-paste') return false;
            const box = panel.querySelector('[data-table-paste]');
            const rows = E.tableEdit.parseTsv(box ? box.value : null);
            if (rows) update(el, rows);
            return true;
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.propsByType.table;
})();
