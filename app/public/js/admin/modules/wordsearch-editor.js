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
    return String(value || '').replace(/[^\p{L}]/gu, '').toUpperCase().slice(0, WORD_SEARCH_MAX_LETTERS);
}

function _wordRowsHtml(qIdx, words) {
    const canDelete = words.length > WORD_SEARCH_MIN_WORDS;
    return words.map((opt, oIdx) => `
        <div class="flex items-center gap-3 mb-2">
            <span class="text-xs font-bold text-slate-400 w-4">${oIdx + 1}</span>
            <input
                type="text"
                maxlength="${WORD_SEARCH_MAX_LETTERS}"
                value="${escapeHtml(opt.optionText || '')}"
                data-admin-change="actualizarPalabraSopa(${qIdx}, ${oIdx}, this.value)"
                placeholder="${_t('admin.q.wordsearch_placeholder', null, 'Palabra (3-10 letras)')}"
                class="flex-1 p-2 border-2 border-slate-100 rounded-xl focus:border-plum-500 outline-none text-sm font-mono font-bold tracking-widest uppercase"
            >
            ${canDelete ? `
                <button data-admin-click="eliminarPalabraSopa(${qIdx}, ${oIdx})"
                    class="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                    <i class="fas fa-times text-xs"></i>
                </button>
            ` : '<span class="w-8"></span>'}
        </div>
    `).join('');
}

/** Sección del editor para la Sopa de letras (questionTypeSectionHtml). */
function wordSearchEditorSectionHtml(q, qIdx) {
    const words = Array.isArray(q.options) ? q.options : [];
    const canAdd = words.length < WORD_SEARCH_MAX_WORDS;
    return `
                    <!-- SOPA DE LETRAS -->
                    <div class="bg-plum-100 border border-plum-300 p-3 mb-4 rounded-lg">
                        <p class="text-sm font-bold text-plum-800 flex items-center gap-2">
                            <i class="fas fa-search"></i>
                            ${_t('admin.q.wordsearch_intro', null, 'Las palabras se esconden en una rejilla de 10x10 en cualquier dirección: horizontal, vertical o diagonal, y del derecho o del revés.')}
                        </p>
                    </div>
                    <div class="bg-plum-50 p-4 rounded-xl border-2 border-plum-200">
                        <label class="text-[10px] font-bold text-plum-600 uppercase flex items-center gap-2 mb-3">
                            <i class="fas fa-font"></i> ${_t('admin.q.wordsearch_words_label', null, 'Palabras a esconder (2-6, de 3 a 10 letras)')}
                        </label>
                        ${_wordRowsHtml(qIdx, words)}
                        ${canAdd ? `
                            <button data-admin-click="añadirPalabraSopa(${qIdx})"
                                class="mt-2 text-plum-600 hover:text-plum-800 text-xs font-bold flex items-center gap-1 transition">
                                <i class="fas fa-plus-circle"></i> ${_t('admin.q.wordsearch_add', null, 'Añadir palabra')}
                            </button>
                        ` : `
                            <p class="mt-2 text-xs text-slate-400 italic">
                                <i class="fas fa-lock mr-1"></i>${_t('admin.q.wordsearch_max', null, 'Máximo 6 palabras alcanzado')}
                            </p>
                        `}
                        <div class="mt-3 bg-white p-3 rounded-lg border border-plum-300">
                            <p class="text-xs font-bold text-plum-700 mb-1"><i class="fas fa-lightbulb mr-1"></i>${_t('admin.q.how_it_works', null, 'Cómo funciona:')}</p>
                            <ul class="text-xs text-plum-600 space-y-1 ml-4 list-disc">
                                <li>${_t('admin.q.wordsearch_help_grid', null, 'Cada partida genera una sopa distinta con estas palabras')}</li>
                                <li>${_t('admin.q.wordsearch_help_play', null, 'El jugador ve la lista y marca cada palabra arrastrando o tocando su primera y última letra')}</li>
                                <li>${_t('admin.q.wordsearch_help_points', null, 'Puntuación: 20 pts por palabra encontrada')}</li>
                                <li>${_t('admin.q.wordsearch_help_time', null, 'Da tiempo suficiente: 60-120 segundos según el número de palabras')}</li>
                            </ul>
                        </div>
                    </div>
                    `;
}

function añadirPalabraSopa(qIdx) {
    const q = preguntasData[qIdx];
    if (!q || !Array.isArray(q.options) || q.options.length >= WORD_SEARCH_MAX_WORDS) return;
    q.options.push({ optionText: '', isCorrect: true, order_index: q.options.length });
    dibujarPreguntas();
}

function eliminarPalabraSopa(qIdx, oIdx) {
    const q = preguntasData[qIdx];
    if (!q || !Array.isArray(q.options) || q.options.length <= WORD_SEARCH_MIN_WORDS) return;
    q.options.splice(oIdx, 1);
    q.options.forEach((opt, i) => { opt.order_index = i; });
    dibujarPreguntas();
}

function actualizarPalabraSopa(qIdx, oIdx, value) {
    const q = preguntasData[qIdx];
    if (!q || !q.options[oIdx]) return;
    q.options[oIdx].optionText = _sanitizeSearchWord(value);
    q.options[oIdx].isCorrect = true;
    dibujarPreguntas();
}
