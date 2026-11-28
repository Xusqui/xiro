/**
 * @fileoverview «Nube de palabras» en el visor de resultados (xiro-results-viewer.html): las
 * palabras agrupadas que se guardaron al revelar la pregunta, con su recuento, y la imagen de la
 * nube (la misma espiral que ve el presentador, pintada al desplegar la pregunta). La nube
 * guardada es anónima: lo que escribió cada jugador viene de sus respuestas.
 * Expone window.XiroWordCloudSection y module.exports (Jest).
 */
(function (root) {
    'use strict';

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderRow(entry, top, times) {
        const pct = Math.round((100 * entry.count) / top);
        return (
            '<div class="answer-bar-wrap vote-row"><div class="answer-bar-label"><span class="vote-label">' +
            escapeHtml(entry.word) + '</span><span class="vote-count">' + entry.count + ' ' + escapeHtml(times) +
            '</span></div><div class="answer-bar"><div class="answer-bar-fill FILL" style="width:' + pct + '%"></div></div></div>'
        );
    }

    /**
     * @param {Array<{word: string, count: number}>} [words] - Palabras guardadas, de más a menos recuento
     * @param {{title: string, times: string, empty: string}} labels - Textos ya traducidos
     * @returns {string} HTML del bloque (todo el texto escapado)
     */
    function renderWordCloudSection(words, labels) {
        const list = Array.isArray(words) ? words : [];
        const title = '<div class="vote-title">' + escapeHtml(labels.title) + '</div>';
        if (!list.length) return '<div class="vote-distribution">' + title + '<p>' + escapeHtml(labels.empty) + '</p></div>';
        const top = Math.max.apply(null, list.map(function (entry) { return entry.count; })) || 1;
        return '<div class="vote-distribution">' + title + list.map(function (entry) { return renderRow(entry, top, labels.times); }).join('') + '</div>';
    }

    function describeWords(list, title) {
        return title + ': ' + list.map(function (entry) { return entry.word + ' (' + entry.count + ')'; }).join(', ');
    }

    function stageHtml(list, title) {
        const cloudWords = list.map(function (entry) { return { key: entry.word, text: entry.word, count: entry.count }; });
        return (
            '<div class="wcv-stage" role="img" aria-label="' + escapeHtml(describeWords(list, title)) +
            '" data-wcv-words="' + escapeHtml(JSON.stringify(cloudWords)) + '"></div>'
        );
    }

    /**
     * Imagen de la nube junto a la lista de palabras con su recuento.
     * @param {Array<{word: string, count: number}>} [words] - Palabras guardadas
     * @param {{title: string, times: string, empty: string}} labels - Textos ya traducidos
     * @returns {string} HTML del bloque (todo el texto escapado); la imagen se pinta con paintWordCloudStages
     */
    function renderWordCloudBlock(words, labels) {
        const list = Array.isArray(words) ? words : [];
        const section = renderWordCloudSection(list, labels);
        if (!list.length) return section;
        return '<div class="wcv-split">' + stageHtml(list, labels.title) + section + '</div>';
    }

    /**
     * Pinta las nubes aún sin pintar (o cuyo ancho cambió) dentro del contenedor. Hay que llamarla
     * con la pregunta ya desplegada: oculta, la imagen mide 0 y no hay dónde colocar las palabras.
     * @param {Element} container - Elemento que contiene imágenes `.wcv-stage`
     * @returns {void}
     */
    function paintWordCloudStages(container) {
        const stages = container.querySelectorAll('.wcv-stage');
        for (let i = 0; i < stages.length; i++) {
            const stage = stages[i];
            const width = stage.clientWidth;
            if (!width || stage.getAttribute('data-wcv-width') === String(width)) continue;
            // Alto explícito: sin él la imagen puede medir 0 y las palabras caen sobre lo que hay debajo
            const height = Math.round((width * 9) / 16);
            stage.style.height = height + 'px';
            root.XiroWordCloudRender.render(stage, { words: JSON.parse(stage.getAttribute('data-wcv-words')) }, { width: width, height: height });
            stage.setAttribute('data-wcv-width', String(width));
        }
    }

    const api = { renderWordCloudSection, renderWordCloudBlock, paintWordCloudStages };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.XiroWordCloudSection = api;
})(typeof window !== 'undefined' ? window : null);
