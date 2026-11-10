/**
 * @fileoverview Editor de palabras para preguntas tipo "word_search" (Sopa de letras).
 * Cada palabra es una opción (optionText, order_index). Entre 2 y 6 palabras de
 * 3 a 10 letras; el servidor las vuelve a validar (WordSearchQuestionValidator).
 * Exporta (globales): wordSearchEditorSectionHtml, añadirPalabraSopa,
 * eliminarPalabraSopa, actualizarPalabraSopa
 */

const WORD_SEARCH_MIN_WORDS = 2;
const WORD_SEARCH_MAX_WORDS = 6;
const WORD_SEARCH_MAX_LETTERS = 10;

/** Solo letras (con tildes, Ñ…), en mayúsculas y como mucho 10 */
function _sanitizeSearchWord(value) {
    return String(value || '')
        .replace(/[^\p{L}]/gu, '')
        .toUpperCase()
        .slice(0, WORD_SEARCH_MAX_LETTERS);
}

function _wordRowsHtml(qIdx, words) {
    const canDelete = words.length > WORD_SEARCH_MIN_WORDS;
    return words
        .map((opt, oIdx) => {
            const n = oIdx + 1;
            const label = _t('admin.q.wordsearch_word_n', { n }, 'Palabra {n}');
            const remove = canDelete
                ? optionIconButtonHtml(`ws-del-${qIdx}-${oIdx}`, `eliminarPalabraSopa(${qIdx}, ${oIdx})`, 'fa-xmark', _t('admin.q.wordsearch_remove', { n }, 'Quitar la palabra {n}'))
                : '';
            return `
                            <div class="xq-option">
                                <span class="xq-num" aria-hidden="true">${n}</span>
                                <input type="text" id="ws-word-${qIdx}-${oIdx}" maxlength="${WORD_SEARCH_MAX_LETTERS}" value="${escapeHtml(opt.optionText || '')}"
                                    aria-label="${label}" placeholder="${_t('admin.q.wordsearch_placeholder', null, 'Palabra (3-10 letras)')}"
                                    data-admin-change="actualizarPalabraSopa(${qIdx}, ${oIdx}, this.value)" class="xq-option__input xq-option__input--word">
                                ${remove}
                            </div>`;
        })
        .join('');
}

/** Sección del editor para la Sopa de letras (questionTypeSectionHtml). */
function wordSearchEditorSectionHtml(q, qIdx) {
    const words = Array.isArray(q.options) ? q.options : [];
    const add = words.length < WORD_SEARCH_MAX_WORDS
        ? `<button type="button" id="ws-add-${qIdx}" data-admin-click="añadirPalabraSopa(${qIdx})" class="xq-btn xq-btn--dashed">
                                <i class="fas fa-plus-circle" aria-hidden="true"></i> ${_t('admin.q.wordsearch_add', null, 'Añadir palabra')}</button>`
        : `<p class="xq-hint"><i class="fas fa-lock" aria-hidden="true"></i> ${_t('admin.q.wordsearch_max', null, 'Máximo 6 palabras alcanzado')}</p>`;
    const help = questionHelpHtml(q, [
        _t('admin.q.wordsearch_intro', null, 'Las palabras se esconden en una rejilla de 10x10 en cualquier dirección: horizontal, vertical o diagonal, y del derecho o del revés.'),
        _t('admin.q.wordsearch_help_grid', null, 'Cada partida genera una sopa distinta con estas palabras'),
        _t('admin.q.wordsearch_help_play', null, 'El jugador ve la lista y marca cada palabra arrastrando o tocando su primera y última letra'),
        _t('admin.q.wordsearch_help_points', null, 'Puntuación: 20 pts por palabra encontrada'),
        _t('admin.q.wordsearch_help_time', null, 'Da tiempo suficiente: 60-120 segundos según el número de palabras')
    ]);
    return questionSectionHtml(
        _t('admin.q.wordsearch_title', null, 'Palabras a esconder'),
        _t('admin.q.wordsearch_rule', null, 'Entre 2 y 6 palabras, de 3 a 10 letras cada una.'),
        `<div class="xq-options xq-options--list">${_wordRowsHtml(qIdx, words)}</div>${add}${help}`
    );
}

function añadirPalabraSopa(qIdx) {
    const q = preguntasData[qIdx];
    if (!q || !Array.isArray(q.options) || q.options.length >= WORD_SEARCH_MAX_WORDS) return;
    q.options.push({ optionText: '', isCorrect: true, order_index: q.options.length });
    setQuestionFocus(`ws-word-${qIdx}-${q.options.length - 1}`);
    dibujarPregunta(qIdx);
}

function eliminarPalabraSopa(qIdx, oIdx) {
    const q = preguntasData[qIdx];
    if (!q || !Array.isArray(q.options) || q.options.length <= WORD_SEARCH_MIN_WORDS) return;
    q.options.splice(oIdx, 1);
    q.options.forEach((opt, i) => {
        opt.order_index = i;
    });
    setQuestionFocus(`ws-word-${qIdx}-${Math.min(oIdx, q.options.length - 1)}`);
    dibujarPregunta(qIdx);
}

function actualizarPalabraSopa(qIdx, oIdx, value) {
    const q = preguntasData[qIdx];
    if (!q || !q.options[oIdx]) return;
    q.options[oIdx].optionText = _sanitizeSearchWord(value);
    q.options[oIdx].isCorrect = true;
    dibujarPregunta(qIdx);
}
