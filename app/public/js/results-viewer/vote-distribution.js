/**
 * @fileoverview Reparto de votos por respuesta en el visor de resultados
 * (xiro-results-viewer.html): qué porcentaje de los jugadores que contestaron
 * una pregunta eligió cada respuesta.
 *
 * Trabaja con las filas del visor (`answer`, `correct` = 'Sí' | 'No' | 'Encuesta',
 * `multipleChoiceItems` opcional), que llegan igual del JSON y del CSV exportados.
 * El snapshot de preguntas no guarda las opciones, así que solo aparecen las
 * respuestas que alguien eligió.
 * Expone window.XiroVoteDistribution y module.exports (Jest).
 */
(function (root) {
    'use strict';

    // Cada jugador puede marcar varias opciones: cada una cuenta como un voto
    const MULTI_SELECT_TYPES = new Set(['multiple_choice', 'survey_multiple']);
    // Respuestas compuestas (orden, parejas, huecos, sopa): casi nunca coinciden entre jugadores
    const NO_DISTRIBUTION_TYPES = new Set(['order', 'matching', 'word_search', 'fill_blanks']);
    // Lo que el servidor guarda en una encuesta múltiple enviada sin marcar nada
    const NO_SELECTION = '—';
    // Separador con el que playerAnswerArchive une las opciones marcadas
    const OPTION_SEPARATOR = ', ';

    function correctnessOf(answer) {
        if (answer.correct === 'Sí') return true;
        if (answer.correct === 'No') return false;
        return null;
    }

    function selectedOptions(answer) {
        if (Array.isArray(answer.multipleChoiceItems)) {
            return answer.multipleChoiceItems.map(item => ({ label: String(item.text), correct: !!item.correct }));
        }
        const text = String(answer.answer || '').trim();
        if (!text || text === NO_SELECTION) return [];
        // Sin estructura (CSV, encuestas): solo queda el texto unido; no se sabe qué opción era correcta
        return text
            .split(OPTION_SEPARATOR)
            .map(label => label.trim())
            .filter(Boolean)
            .map(label => ({ label, correct: null }));
    }

    function votesOf(answer, questionType) {
        if (MULTI_SELECT_TYPES.has(questionType)) return selectedOptions(answer);
        const label = String(answer.answer || '').trim() || NO_SELECTION;
        return [{ label, correct: correctnessOf(answer) }];
    }

    function mergeCorrect(current, next) {
        if (current === true || next === true) return true;
        if (current === false || next === false) return false;
        return null;
    }

    function tally(answers, questionType) {
        const byLabel = new Map();
        answers.forEach(answer => {
            const seen = new Set();
            votesOf(answer, questionType).forEach(vote => {
                if (seen.has(vote.label)) return;
                seen.add(vote.label);
                const entry = byLabel.get(vote.label) || { label: vote.label, votes: 0, correct: null };
                entry.votes += 1;
                entry.correct = mergeCorrect(entry.correct, vote.correct);
                byLabel.set(vote.label, entry);
            });
        });
        return Array.from(byLabel.values());
    }

    /**
     * Calcula los votos de cada respuesta de una pregunta.
     *
     * @param {Array<Object>} answers - Filas del visor de una misma pregunta.
     * @param {string} [questionType] - question_type; vacío si no se conoce.
     * @returns {Array<{label: string, votes: number, pct: number, correct: (boolean|null)}>}
     *   Ordenado de más a menos votos; vacío si no hay respuestas o el tipo no admite reparto.
     *   `pct` es el porcentaje sobre los jugadores que contestaron (en selección múltiple
     *   la suma puede pasar de 100).
     */
    function computeVoteDistribution(answers, questionType) {
        if (!Array.isArray(answers) || !answers.length) return [];
        if (NO_DISTRIBUTION_TYPES.has(questionType)) return [];
        const total = answers.length;
        return tally(answers, questionType)
            .map(entry => ({
                label: entry.label,
                votes: entry.votes,
                pct: Math.round((100 * entry.votes) / total),
                correct: entry.correct
            }))
            .sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label));
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function fillClass(correct) {
        if (correct === true) return 'fill-green';
        if (correct === false) return 'fill-red';
        return 'fill-neutral';
    }

    function renderRow(entry, total) {
        return (
            '<div class="answer-bar-wrap vote-row">' +
            '<div class="answer-bar-label"><span class="vote-label">' +
            escapeHtml(entry.label) +
            '</span>' +
            '<span class="vote-count">' +
            entry.pct +
            '% · ' +
            entry.votes +
            '/' +
            total +
            '</span></div>' +
            '<div class="answer-bar"><div class="answer-bar-fill ' +
            fillClass(entry.correct) +
            '" style="width:' +
            entry.pct +
            '%"></div></div></div>'
        );
    }

    /**
     * HTML del bloque «votos por respuesta» de una pregunta.
     *
     * @param {Array<Object>} answers - Filas del visor de una misma pregunta.
     * @param {string} [questionType] - question_type; vacío si no se conoce.
     * @param {string} title - Título ya traducido.
     * @returns {string} HTML escapado, o '' si no hay reparto que mostrar.
     */
    function renderVoteDistribution(answers, questionType, title) {
        const entries = computeVoteDistribution(answers, questionType);
        if (!entries.length) return '';
        const rows = entries.map(entry => renderRow(entry, answers.length)).join('');
        return (
            '<div class="vote-distribution"><div class="vote-title">' + escapeHtml(title) + '</div>' + rows + '</div>'
        );
    }

    const api = { computeVoteDistribution, renderVoteDistribution };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.XiroVoteDistribution = api;
})(typeof window !== 'undefined' ? window : null);
