/**
 * @fileoverview Panel de propiedades del gráfico (fase E3): tabla de datos, «Editar datos»,
 * «Ocultar la tabla de datos», series en columnas o filas, tipo con miniatura, apilado, colores
 * por serie, leyenda, valores, cuadrícula, texto y texto alternativo.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});
    E.propsByType = E.propsByType || {};

    const ROUND = ['pie', 'doughnut'];
    const THUMBS = {
        column: '<rect x="2" y="8" width="4" height="7" rx="1"/><rect x="10" y="3" width="4" height="12" rx="1"/><rect x="18" y="6" width="4" height="9" rx="1"/>',
        bar: '<rect x="1" y="1" width="12" height="3.5" rx="1"/><rect x="1" y="6.25" width="21" height="3.5" rx="1"/><rect x="1" y="11.5" width="8" height="3.5" rx="1"/>',
        line: '<polyline points="1,13 7,7 13,10 23,2"/>',
        area: '<path d="M1 15V11L7 6L13 9L23 2V15Z"/>',
        pie: '<circle cx="12" cy="8" r="7"/><path d="M12 8V1A7 7 0 0 1 19 8Z" fill="currentColor" stroke="none"/>',
        doughnut: '<circle cx="12" cy="8" r="7"/><circle cx="12" cy="8" r="3"/>'
    };
    const FONT_FIELD = { key: 'font', label: 'field.font', kind: 'select', options: E.FONT_OPTIONS };
    const COLOR_FIELD = { key: 'color', label: 'field.color', kind: 'color' };

    /** Núcleo de los gráficos (core/slide-canvas-chart.js), cargado antes que el editor. */
    const chart = () => root.XiroSlideCanvasChart;
    /** Sectores y anillo: sin ejes, así que sin cuadrícula ni leyenda opcional. */
    const isRound = el => ROUND.indexOf(el.props.kind) >= 0;
    const note = key => '<p class="xsce-chart-note">' + E.th(key) + '</p>';
    const action = (label, name, icon, quiet) => ({
        label: label,
        kind: 'action',
        action: name,
        icon: icon,
        quiet: !!quiet
    });
    const check = (label, attr, on) =>
        '<div class="xsce-field"><label class="xsce-check"><input type="checkbox" ' +
        attr +
        (on ? ' checked' : '') +
        '> ' +
        E.th(label) +
        '</label></div>';
    /** Tipos con miniatura y nombre; se construye al pintar para seguir al idioma activo. */
    const fields = (list, values, el) => E.propsFields.fieldsHtml(list, values, el);

    function kindField() {
        // bare: la sección ya se titula «Tipo»; el aria-label del grupo conserva el nombre.
        return {
            key: 'kind',
            label: 'chart.kind',
            bare: true,
            kind: 'segment',
            options: chart().KINDS.map(k => [
                k,
                'chart.kind_' + k,
                '<svg viewBox="0 0 24 16" aria-hidden="true" focusable="false">' +
                    THUMBS[k] +
                    '</svg><span>' +
                    E.th('chart.kind_' + k) +
                    '</span>'
            ])
        };
    }

    /** Series por columnas o por filas de la tabla. */
    function seriesField() {
        return {
            key: 'seriesIn',
            label: 'chart.series_in',
            kind: 'segment',
            options: [
                ['columns', 'chart.series_columns', '<span>' + E.th('chart.series_columns') + '</span>'],
                ['rows', 'chart.series_rows', '<span>' + E.th('chart.series_rows') + '</span>']
            ]
        };
    }

    /** Lista de las tablas de la diapositiva, numeradas por orden, con las ocultas marcadas. */
    function tableSelectHtml(el) {
        let html = '<h5>' + E.th('chart.data') + '</h5>';
        html +=
            '<div class="xsce-field"><label class="xsce-label" for="xsce-chart-table">' +
            E.th('chart.table') +
            '</label><select class="xsce-input" id="xsce-chart-table" data-chart-table>';
        html += '<option value="">' + E.th('chart.table_none') + '</option>';
        let counter = 0;
        E.state.canvas.elements.forEach(e => {
            if (e.type === 'table') {
                counter++;
                const text = E.th(e.hidden ? 'chart.table_hidden' : 'chart.table_option', { n: counter });
                html +=
                    '<option value="' +
                    e.id +
                    '"' +
                    (e.id === el.props.source.tableId ? ' selected' : '') +
                    '>' +
                    text +
                    '</option>';
            }
        });
        html += '</select></div>';
        return html;
    }

    /** Orientación, «Editar datos» y ocultar la tabla, con aviso si falta la tabla o sus números. */
    function dataHtml(el, table, data) {
        if (!table) return note('chart.no_table');
        const empty = !data.series.some(s => s.values.some(v => v !== null));
        const hide = check('chart.hide_table', 'data-chart-hide', table.hidden);
        return (
            (empty ? note('chart.no_numbers') : '') +
            fields([seriesField()], { seriesIn: el.props.source.seriesIn }, el) +
            fields([action('chart.edit_data', 'chart-edit-data', 'fa-pen-to-square')], {}, el) +
            hide
        );
    }

    /** Tipo y, si el tipo lo admite, «Apilado». */
    function kindHtml(el) {
        let html = '<h5>' + E.th('chart.kind') + '</h5>';
        html += fields([kindField()], el.props, el);
        if (chart().STACKABLE.includes(el.props.kind)) {
            html += fields([{ key: 'stacked', label: 'chart.stacked', kind: 'check' }], el.props, el);
        }
        return html;
    }

    /** Un color por serie (por categoría en sectores y anillo) y «Colores automáticos». */
    function colorsHtml(el, data) {
        if (!data || data.series.length === 0) return '';
        const names = isRound(el) ? data.categories.slice(0, chart().MAX_SERIES) : data.series.map(s => s.name);

        if (names.length === 0) return '';

        const colors = chart().seriesColors(el.props);
        let html = '<h5>' + E.th('chart.colors') + '</h5>';
        html += '<div class="xsce-chart-colors">';
        names.forEach((name, i) => {
            const raw = name || E.t('chart.sample_series', { n: i + 1 });
            html +=
                '<label class="xsce-chart-color"><span class="xsce-chart-color-name">' +
                esc(raw) +
                '</span><input type="color" class="xsce-swatch" data-chart-color="' +
                i +
                '" value="' +
                colors[i] +
                '" aria-label="' +
                E.th('chart.color_of', { name: raw }) +
                '"></label>';
        });
        html += '</div>';

        if (el.props.seriesColors.some(c => c)) {
            html += fields([action('chart.colors_auto', 'chart-colors-auto', 'fa-rotate-left', true)], {}, el);
        }
        return html;
    }

    /** Datos leídos de la tabla vinculada, como al pintar. */
    function chartData(el) {
        return chart().chartData(el.props, E.chartTable(el).props);
    }

    /** Escapa nombres de series y categorías que vienen de las celdas de la tabla. */
    const esc = text => root.XiroSlideCanvasRender.escapeText(text);

    E.propsByType.chart = {
        title: 'type.chart',

        fields: [
            { key: 'legend', label: 'chart.legend', kind: 'check', when: el => !isRound(el) },
            { key: 'values', label: 'chart.values', kind: 'check' },
            { key: 'grid', label: 'chart.grid', kind: 'check', when: el => !isRound(el) },
            FONT_FIELD,
            { key: 'size', label: 'field.size', kind: 'number', min: 12, max: 120 },
            COLOR_FIELD,
            { key: 'alt', label: 'chart.alt', kind: 'textarea', rows: 3 }
        ],

        /**
         * @param {object} el - Elemento del canvas
         * @returns {string} HTML extra para propiedades
         */
        extraHtml(el) {
            const table = E.chartTable(el);
            const data = table ? chartData(el) : null;
            let html = tableSelectHtml(el);
            html += dataHtml(el, table, data);
            html += kindHtml(el);
            html += colorsHtml(el, data);
            html += '<h5>' + E.th('chart.options') + '</h5>';
            return html;
        },

        /**
         * @param {object} input - Elemento de entrada
         * @param {boolean} silent - Silencioso
         * @param {object} el - Elemento del canvas
         * @returns {boolean} Si se procesó la entrada
         */
        applyInput(input, silent, el) {
            if (input.hasAttribute('data-chart-table')) {
                if (!silent) E.linkChartTo(el.id, input.value);
                return true;
            }
            if (input.hasAttribute('data-chart-hide')) {
                if (!silent) {
                    const t = E.chartTable(el);
                    if (t) E.setTableHidden(t.id, input.checked);
                }
                return true;
            }
            if (input.getAttribute('data-canvas-prop') === 'seriesIn') {
                E.updateElement(el.id, {
                    props: { source: { tableId: el.props.source.tableId, seriesIn: input.value } }
                });
                return true;
            }
            if (input.hasAttribute('data-chart-color')) {
                const i = parseInt(input.getAttribute('data-chart-color'), 10);
                const colors = el.props.seriesColors.slice();
                while (colors.length <= i) colors.push(null);
                colors[i] = input.value;
                E.updateElement(el.id, { props: { seriesColors: colors }, silent: silent });
                return true;
            }
            return false;
        },

        /**
         * @param {string} name - Nombre de acción
         * @param {object} el - Elemento del canvas
         * @returns {boolean} Si se procesó la acción
         */
        onAction(name, el) {
            if (name === 'chart-edit-data') {
                E.editChartData(el.id);
                return true;
            }
            if (name === 'chart-colors-auto') {
                E.updateElement(el.id, { props: { seriesColors: [] } });
                return true;
            }
            return false;
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.propsByType.chart;
})();
