// Conversión de preguntas de banco entre la API y el editor del admin
// (cargarEditorBanco y guardarBanco, en bancos-expanded.js).

// ===== API → EDITOR =====

function _bankOptionFromApi(o) {
    return {
        optionText: o.option_text,
        isCorrect: !!o.is_correct,
        order_index: o.order_index ?? o.orderIndex ?? null,
        justification: o.justification || null,
        match_value: o.match_value ?? null,
        option_image_url: o.option_image_url ?? null
    };
}

function _orderIndexOrZero(option) {
    return Number.isInteger(option.order_index) ? option.order_index : 0;
}

/** Ordenar y emparejar se muestran en su orden guardado. */
function _bankOptionsFromApi(q, questionType) {
    const options = (q.options || []).map(_bankOptionFromApi);
    if (questionType === 'order' || questionType === 'matching' || questionType === 'word_search') {
        options.sort((a, b) => _orderIndexOrZero(a) - _orderIndexOrZero(b));
    }
    return options;
}

/** Ordenar: la primera justificación de sus opciones; resto: la de la opción correcta. */
function _bankJustificationFromApi(q, questionType, options) {
    if (questionType === 'order') {
        return options.find(opt => opt.justification)?.justification || '';
    }
    return q.options?.find(o => !!o.is_correct)?.justification || '';
}

function _numericFieldsFromApi(q, questionType) {
    if (questionType !== 'numeric_approximation') {
        return { correctAnswer: null, maxPoints: null, toleranceMode: null, toleranceValue: null, toleranceCap: null };
    }
    return {
        correctAnswer: q.correct_answer ?? null,
        maxPoints: q.max_points ?? null,
        toleranceMode: q.tolerance_mode || 'hybrid',
        toleranceValue: q.tolerance_value ?? 25,
        toleranceCap: q.tolerance_cap ?? 1000
    };
}

function _multipleChoiceFieldsFromApi(q, questionType) {
    if (questionType !== 'multiple_choice') {
        return { mcPointsPerCorrect: null, mcPenaltyPerIncorrect: null, mcPerfectBonus: null };
    }
    return {
        mcPointsPerCorrect: q.mc_points_per_correct ?? 10,
        mcPenaltyPerIncorrect: q.mc_penalty_per_incorrect ?? 10,
        mcPerfectBonus: q.mc_perfect_bonus ?? 20
    };
}

/** Pregunta de la API (/api/banks/:id) → objeto del editor (preguntasData). */
function mapBankQuestionFromApi(q) {
    const questionType = q.question_type || 'quiz';
    const options = _bankOptionsFromApi(q, questionType);
    return {
        id: q.id,
        questionText: q.question_text,
        justification: _bankJustificationFromApi(q, questionType, options),
        type: questionType,
        tipo_contenido: q.tipo_contenido || 'texto',
        url_recurso: q.url_recurso || null,
        question_image_url: q.question_image_url || null,
        time_limit: q.time_limit || getDefaultQuestionTimeLimit(),
        options,
        ..._numericFieldsFromApi(q, questionType),
        correctWord: questionType === 'word_scramble' ? (q.correct_word || '') : null,
        hint: q.hint_text || '',
        ..._multipleChoiceFieldsFromApi(q, questionType)
    };
}

// ===== EDITOR → GUARDADO =====

function _numericFieldsForSave(q) {
    if (q.type !== 'numeric_approximation') {
        return { correctAnswer: null, maxPoints: null, toleranceMode: null, toleranceValue: null, toleranceCap: null, hint: null };
    }
    return {
        correctAnswer: q.correctAnswer,
        maxPoints: q.maxPoints,
        toleranceMode: q.toleranceMode || 'hybrid',
        toleranceValue: Number(q.toleranceValue) || 25,
        toleranceCap: q.toleranceCap === null || q.toleranceCap === '' ? null : Number(q.toleranceCap),
        hint: q.hint || null
    };
}

function _multipleChoiceFieldsForSave(q) {
    if (q.type !== 'multiple_choice') {
        return { mc_points_per_correct: null, mc_penalty_per_incorrect: null, mc_perfect_bonus: null };
    }
    return {
        mc_points_per_correct: Number(q.mc_points_per_correct) || 10,
        mc_penalty_per_incorrect: Number(q.mc_penalty_per_incorrect) || 10,
        mc_perfect_bonus: Number(q.mc_perfect_bonus) || 20
    };
}

/** Ordenar: la de cada opción; resto: solo la opción correcta lleva justificación. */
function _optionJustificationForSave(q, opt) {
    if (q.type === 'order') return opt.justification || null;
    return opt.isCorrect ? (opt.justification || q.justification || null) : null;
}

function _bankOptionForSave(q, opt, index) {
    const ordered = q.type === 'order' || q.type === 'matching' || q.type === 'word_search';
    return {
        optionText: opt.optionText || opt.text,
        // Sopa de letras: todas las palabras son "correctas"
        isCorrect: (q.type === 'quiz' || q.type === 'multiple_choice') ? !!opt.isCorrect : q.type === 'word_search',
        order_index: ordered ? index : (opt.order_index ?? opt.orderIndex ?? null),
        match_value: q.type === 'matching' ? (opt.match_value ?? null) : null,
        justification: _optionJustificationForSave(q, opt),
        option_image_url: opt.option_image_url ?? null
    };
}

function _bankOptionsForSave(q) {
    if (q.type === 'numeric_approximation' || q.type === 'word_scramble') return [];
    return q.options.map((opt, index) => _bankOptionForSave(q, opt, index));
}

/** Pregunta del editor → pregunta del payload de /api/banks/save-all. */
function mapBankQuestionForSave(q) {
    return {
        id: q.id || null,
        questionText: q.questionText || q.question_text || q.text,
        type: q.type || 'quiz',
        tipo_contenido: q.tipo_contenido || 'texto',
        url_recurso: q.url_recurso || null,
        question_image_url: q.question_image_url || null,
        time_limit: Number(q.time_limit) || getDefaultQuestionTimeLimit(),
        justification: q.justification || null,
        ..._numericFieldsForSave(q),
        correctWord: q.type === 'word_scramble' ? (q.correctWord || null) : null,
        ..._multipleChoiceFieldsForSave(q),
        options: _bankOptionsForSave(q)
    };
}
