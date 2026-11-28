/**
 * @fileoverview «Nube de palabras» en el visor de resultados (xiro-results-viewer.html): las
 * palabras agrupadas que se guardaron al revelar la pregunta, con su recuento. No hay autores
 * ni respuestas por jugador: la nube es anónima.
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

    const api = { renderWordCloudSection };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.XiroWordCloudSection = api;
})(typeof window !== 'undefined' ? window : null);
