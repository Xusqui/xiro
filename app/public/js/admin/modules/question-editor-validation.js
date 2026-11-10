/**
 * @fileoverview Validación del editor de bancos antes de guardar, pregunta a pregunta.
 * Cada fallo dice qué pregunta y qué campo es; la tarjeta se marca, se despliega y el
 * foco va al campo. El servidor vuelve a validarlo todo (validation/questions.js): si
 * rechaza una pregunta, la ruta del fallo (fields[].path = ['questions', N, …]) la señala igual.
 * Antes, las preguntas sin enunciado se descartaban sin avisar al guardar.
 */

const _OPTION_TYPES = new Set(['quiz', 'survey', 'survey_multiple', 'order', 'multiple_choice']);

const _problem = (fieldId, key, fallback, params) => ({ fieldId, key, fallback, params });
const _isBlank = value => String(value ?? '').trim() === '';

function _fillBlanksProblem(q, qIdx) {
    const fieldId = `fb-text-${qIdx}`;
    if (_isBlank(q.questionText)) return _problem(fieldId, 'admin.q.err_sentence', 'Falta la frase');
    const parsed = window.XiroFillBlanks?.parseEditorText(q.questionText);
    const first = parsed?.errors?.[0];
    return first ? { fieldId, message: fillBlanksErrorText(first) } : null;
}

function _optionsProblem(q, qIdx) {
    const options = q.options || [];
    const empty = options.findIndex(o => _isBlank(o.optionText) && !o.option_image_url);
    if (empty >= 0) return _problem(`opt-${qIdx}-${empty}`, 'admin.q.err_option_empty', 'La opción {n} está vacía', { n: empty + 1 });
    const needsCorrect = q.type === 'quiz' || q.type === 'multiple_choice';
    if (needsCorrect && !options.some(o => o.isCorrect)) {
        return _problem(`correct-${qIdx}-0`, 'admin.q.err_no_correct', 'Marca la respuesta correcta');
    }
    return null;
}

function _matchingProblem(q, qIdx) {
    const idx = (q.options || []).findIndex(o => _isBlank(o.optionText) || _isBlank(o.match_value));
    if (idx < 0) return null;
    const side = _isBlank(q.options[idx].optionText) ? 'left' : 'right';
    return _problem(`pair-${side}-${qIdx}-${idx}`, 'admin.q.err_pair_empty', 'El par {n} está incompleto', { n: idx + 1 });
}

function _numericProblem(q, qIdx) {
    if (!Number.isFinite(Number(q.correctAnswer)) || q.correctAnswer === null) {
        return _problem(`num-answer-${qIdx}`, 'admin.q.err_numeric_answer', 'Falta la respuesta correcta');
    }
    if (!(Number(q.maxPoints) > 0)) return _problem(`num-points-${qIdx}`, 'admin.q.err_numeric_points', 'Faltan los puntos máximos');
    return null;
}

function _typeProblem(q, qIdx) {
    if (_OPTION_TYPES.has(q.type)) return _optionsProblem(q, qIdx);
    if (q.type === 'matching') return _matchingProblem(q, qIdx);
    if (q.type === 'numeric_approximation') return _numericProblem(q, qIdx);
    if (q.type === 'word_scramble' && !/^.{7,10}$/u.test(q.correctWord || '')) {
        return _problem(`word-${qIdx}`, 'admin.q.err_word', 'La palabra debe tener entre 7 y 10 letras');
    }
    if (q.type === 'word_search') {
        const empty = (q.options || []).findIndex(o => _isBlank(o.optionText));
        if (empty >= 0) return _problem(`ws-word-${qIdx}-${empty}`, 'admin.q.err_word_empty', 'La palabra {n} está vacía', { n: empty + 1 });
    }
    return null;
}

/**
 * Primer fallo de una pregunta, o null si se puede guardar.
 * @param {Object} q - Pregunta del editor (preguntasData[i])
 * @param {number} qIdx - Su posición
 * @returns {{ fieldId: string|null, message: string }|null}
 */
function findQuestionProblem(q, qIdx) {
    const raw = q.type === 'fill_blanks'
        ? _fillBlanksProblem(q, qIdx)
        : _isBlank(q.questionText)
            ? _problem(`q-text-${qIdx}`, 'admin.q.err_statement', 'Falta el enunciado')
            : _typeProblem(q, qIdx);
    if (!raw) return null;
    const detail = raw.message ?? _t(raw.key, raw.params || null, raw.fallback);
    return { fieldId: raw.fieldId, message: _t('admin.q.err_prefix', { n: qIdx + 1, message: detail }, 'Pregunta {n}: {message}') };
}

/** Primer fallo de la lista: { qIdx, fieldId, message } o null. */
function findFirstQuestionProblem(questions) {
    for (let qIdx = 0; qIdx < questions.length; qIdx += 1) {
        const problem = findQuestionProblem(questions[qIdx], qIdx);
        if (problem) return { qIdx, ...problem };
    }
    return null;
}

/**
 * Fallo de pregunta en la respuesta 400 del servidor (validateBody: fields[].path).
 * @param {{ fields?: Array<{ path: Array<string|number>, message: string }> }} body
 * @returns {{ qIdx: number, fieldId: null, message: string }|null}
 */
function questionProblemFromServer(body) {
    const fields = Array.isArray(body?.fields) ? body.fields : [];
    const field = fields.find(f => f?.path?.[0] === 'questions' && Number.isInteger(f.path[1]));
    const qIdx = field?.path[1];
    if (!field || !globalThis.preguntasData?.[qIdx]) return null;
    const message = _t('admin.q.err_prefix', { n: qIdx + 1, message: field.message }, 'Pregunta {n}: {message}');
    return { qIdx, fieldId: null, message };
}

/**
 * Marca la pregunta con el fallo, la despliega, la pinta y lleva el foco al campo.
 * @returns {string} HTML para la barra de guardado: el mensaje y "Ir a la pregunta"
 */
function showQuestionProblem(problem) {
    clearQuestionErrors();
    const q = preguntasData[problem.qIdx];
    setQuestionError(q, { fieldId: problem.fieldId, message: problem.message });
    setQuestionCollapsed(q, false);
    setQuestionFocus(problem.fieldId || `q-toggle-${problem.qIdx}`, true);
    dibujarPreguntas();
    const go = _t('admin.q.err_go', { n: problem.qIdx + 1 }, 'Ir a la pregunta {n}');
    return `${escapeHtml(problem.message)} <button type="button" class="savebar__link" data-admin-click="irAPreguntaConError(${problem.qIdx})">${escapeHtml(go)}</button>`;
}

/** Botón de la barra de guardado: vuelve a llevar a la pregunta con el fallo. */
function irAPreguntaConError(qIdx) {
    const problem = getQuestionError(preguntasData[qIdx]);
    const target = document.getElementById(problem?.fieldId || '') || document.getElementById(`q-toggle-${qIdx}`);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target?.focus({ preventScroll: true });
}
