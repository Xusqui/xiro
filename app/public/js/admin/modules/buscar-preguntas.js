/**
 * @fileoverview Búsqueda global de preguntas para Juegos Personalizados
 * @module admin/modules/buscar-preguntas
 *
 * Funciones expuestas (globales):
 *   getHTMLBusquedaPreguntas()       - HTML para inyectar en el editor
 *   ejecutarBusquedaPreguntas()      - Llama al API y renderiza resultados
 *   agregarPreguntaDesdeBusqueda(id) - Añade al juego personalizado
 *
 * Reutiliza:
 *   fetchWithAuth, currentCustomGameQuestions, dibujarPreguntasPersonalizadas,
 *   extractCorrectAnswerFrontend, formatCorrectAnswerDisplayFrontend
 */

// Caché de resultados actuales (para refrescar estado de botones)
let _resultadosBusqueda = [];
let _busquedaDelegationReady = false;
let _busquedaDebounceTimer = null;

// ===== HTML DE LA SECCIÓN =====

/**
 * Devuelve el bloque HTML de búsqueda que se inserta en el editor de personalizados.
 * @returns {string}
 */
function getHTMLBusquedaPreguntas() {
    return `
        <div class="bg-white rounded-2xl shadow-sm p-8 border border-slate-200">
            <div class="flex justify-between items-center mb-2">
                <h3 class="text-xl font-black text-slate-700 uppercase">
                    <i class="fas fa-search text-blue-500 mr-2"></i>Buscar en Todos los Bancos
                </h3>
            </div>
            <p class="text-xs text-slate-400 mb-4">
                Busca por enunciado o por texto de las opciones en <strong>todos los bancos</strong> a la vez.
            </p>
            <div class="mb-4">
                <input
                    type="text"
                    id="busquedaInput"
                    class="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition shadow-sm"
                    placeholder="Escribe al menos 2 caracteres..."
                >
            </div>
            <div id="resultadosBusqueda" class="space-y-2 max-h-96 overflow-y-auto">
                <p class="text-slate-400 text-sm italic text-center py-4">
                    <i class="fas fa-database mr-1"></i>Escribe algo para buscar preguntas
                </p>
            </div>
        </div>
    `;
}

// ===== BÚSQUEDA =====

/**
 * Lee el input, llama al API y renderiza los resultados.
 */
async function ejecutarBusquedaPreguntas() {
    clearTimeout(_busquedaDebounceTimer);

    const input = document.getElementById('busquedaInput');
    const contenedor = document.getElementById('resultadosBusqueda');
    if (!input || !contenedor) return;

    const query = input.value.trim();

    if (query.length < 2) {
        contenedor.innerHTML = _tHtml('<p class="text-amber-500 text-sm italic text-center py-4">Escribe al menos 2 caracteres</p>');
        return;
    }

    contenedor.innerHTML = _tHtml('<p class="text-slate-400 text-sm italic text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Buscando...</p>');

    try {
        const res = await fetchWithAuth(`/api/questions/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const questions = await res.json();
        _resultadosBusqueda = questions;
        renderResultadosBusqueda(questions);
    } catch (err) {
        contenedor.innerHTML = _tHtml('<p class="text-red-500 text-sm text-center py-4"><i class="fas fa-exclamation-triangle mr-1"></i>Error al buscar preguntas</p>');
    }
}

// ===== RENDERIZADO DE RESULTADOS =====

/**
 * Pinta los resultados en el contenedor #resultadosBusqueda.
 * @param {Array} questions
 */
function renderResultadosBusqueda(questions) {
    const contenedor = document.getElementById('resultadosBusqueda');
    if (!contenedor) return;

    if (!questions || questions.length === 0) {
        contenedor.innerHTML = _tHtml('<p class="text-slate-400 text-sm italic text-center py-4">No se encontraron preguntas</p>');
        return;
    }

    const filas = questions.map(q => {
        const correctAnswer = extractCorrectAnswerFrontend(q);
        const correctDisplay = formatCorrectAnswerDisplayFrontend(correctAnswer);
        const yaAñadida = currentCustomGameQuestions.some(cq => cq.question_id != null && Number(cq.question_id) === Number(q.id));

        return `
            <div class="bg-slate-50 p-4 rounded-xl border-2 ${yaAñadida ? 'border-green-300 bg-green-50' : 'border-slate-200'}">
                <div class="flex items-start gap-4">
                    <button
                        data-busqueda-action="add-question"
                        data-question-id="${q.id}"
                        class="mt-1 flex-shrink-0 ${yaAñadida ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'} text-white w-8 h-8 rounded-full flex items-center justify-center transition text-sm"
                        ${yaAñadida ? 'disabled' : ''}
                        title="${yaAñadida ? 'Ya añadida' : 'Añadir al juego'}"
                    >
                        <i class="fas ${yaAñadida ? 'fa-check' : 'fa-plus'}"></i>
                    </button>
                    <div class="flex-1 min-w-0">
                        <span class="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">${escapeHtml(q.bank_name)}</span>
                        <p class="font-medium text-sm text-slate-800 mt-1">${escapeHtml(q.question_text)}</p>
                        <p class="text-xs text-green-600 mt-0.5">
                            <i class="fas fa-check-circle mr-1"></i>
                            ${q.question_type === 'survey' ? 'Encuesta (votos)' : escapeHtml(correctDisplay)}
                        </p>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    contenedor.innerHTML = _tHtml(`
        <p class="text-xs text-slate-400 mb-2">
            <i class="fas fa-list mr-1"></i>${questions.length} pregunta(s) encontrada(s)
        </p>
        ${filas}
    `);
}

// ===== AÑADIR DESDE BÚSQUEDA =====

/**
 * Añade una pregunta de los resultados de búsqueda al juego personalizado.
 * Usa los mismos campos que agregarPreguntaPersonalizada (personalizados-expanded.js).
 * @param {number} questionId
 */
function agregarPreguntaDesdeBusqueda(questionId) {
    if (currentCustomGameQuestions.some(q => q.question_id != null && Number(q.question_id) === Number(questionId))) return;

    const question = _resultadosBusqueda.find(q => q.id === questionId);
    if (!question) return;

    const isNumericApproximation = question.question_type === 'numeric_approximation';
    const isWordScramble = question.question_type === 'word_scramble';
    const safeOptions = Array.isArray(question.options) ? question.options : [];

    currentCustomGameQuestions.push({
        slide_type: 'question',
        question_id: questionId,
        question_type: question.question_type,
        question_text: question.question_text,
        bank_name: question.bank_name,
        options: (isNumericApproximation || isWordScramble) ? [] : safeOptions.map(o => ({
            optionText: o.option_text,
            isCorrect: !!o.is_correct,
            justification: o.justification
        })),
        correct_answer: isNumericApproximation ? question.correct_answer : null,
        correct_word: isWordScramble ? (question.correct_word || null) : null,
        max_points: isNumericApproximation ? question.max_points : null,
        tolerance_mode: isNumericApproximation ? (question.tolerance_mode || 'hybrid') : null,
        tolerance_value: isNumericApproximation ? (question.tolerance_value ?? 25) : null,
        tolerance_cap: isNumericApproximation ? (question.tolerance_cap ?? 1000) : null,
        hint_text: isNumericApproximation ? (question.hint_text || null) : null,
        position: currentCustomGameQuestions.length
    });

    dibujarPreguntasPersonalizadas();
    // Refrescar resultados para marcar la pregunta como añadida
    renderResultadosBusqueda(_resultadosBusqueda);
}

/**
 * Refresca el estado visual de los botones en los resultados de búsqueda.
 * Llamada desde personalizados-expanded.js al añadir/eliminar preguntas
 * para mantener sincronizados ambos paneles.
 * Es seguro llamarla aunque no haya búsqueda activa (no hace nada).
 */
function refrescarResultadosBusqueda() {
    if (_resultadosBusqueda.length > 0) {
        renderResultadosBusqueda(_resultadosBusqueda);
    }
}

function initBusquedaPreguntasDelegation() {
    if (_busquedaDelegationReady) return;
    _busquedaDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-busqueda-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.busquedaAction;
        if (action === 'add-question') {
            const questionId = Number(actionElement.dataset.questionId);
            if (Number.isFinite(questionId)) agregarPreguntaDesdeBusqueda(questionId);
        }
    });

    document.addEventListener('keydown', (event) => {
        const target = event.target;
        if (!target || target.id !== 'busquedaInput') return;
        if (event.key !== 'Enter') return;

        event.preventDefault();
        ejecutarBusquedaPreguntas();
    });

    // Búsqueda en vivo: dispara sola mientras se escribe, con debounce
    // para no lanzar una petición por cada tecla.
    document.addEventListener('input', (event) => {
        if (!event.target || event.target.id !== 'busquedaInput') return;

        clearTimeout(_busquedaDebounceTimer);

        if (event.target.value.trim().length < 2) {
            ejecutarBusquedaPreguntas();
            return;
        }

        _busquedaDebounceTimer = setTimeout(ejecutarBusquedaPreguntas, 400);
    });
}

initBusquedaPreguntasDelegation();
