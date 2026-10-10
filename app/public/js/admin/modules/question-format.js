/**
 * @fileoverview Formateo compartido de preguntas para export/import en admin
 */

(function () {
    function normalizeQuestionType(question) {
        return question.type || question.question_type || 'quiz';
    }

    function toNumberOrNull(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function questionText(question) {
        return question.questionText || question.question_text;
    }

    /** Multimedia y tiempo, comunes a todos los tipos (en export e import). */
    function mediaFields(question) {
        return {
            tipo_contenido: question.tipo_contenido || 'texto',
            url_recurso: question.url_recurso || null,
            time_limit: question.time_limit || getDefaultQuestionTimeLimit()
        };
    }

    function multipleChoiceScoring(question) {
        return {
            mc_points_per_correct: toNumberOrNull(question.mcPointsPerCorrect ?? question.mc_points_per_correct) ?? 10,
            mc_penalty_per_incorrect: toNumberOrNull(question.mcPenaltyPerIncorrect ?? question.mc_penalty_per_incorrect) ?? 10,
            mc_perfect_bonus: toNumberOrNull(question.mcPerfectBonus ?? question.mc_perfect_bonus) ?? 20
        };
    }

    /** Campos de la pregunta numérica, vacíos en el resto de tipos (import). */
    const EMPTY_NUMERIC_FIELDS = {
        correctAnswer: null,
        maxPoints: null,
        toleranceMode: null,
        toleranceValue: null,
        toleranceCap: null,
        hint: null
    };

    // ===== EXPORT =====

    function exportToleranceCap(question) {
        const source = question.toleranceCap ?? question.tolerance_cap;
        return source === null || source === '' ? null : toNumberOrNull(source);
    }

    function mapNumericQuestionForExport(question) {
        return {
            question_text: questionText(question),
            type: 'numeric_approximation',
            ...mediaFields(question),
            correctAnswer: toNumberOrNull(question.correctAnswer ?? question.correct_answer),
            maxPoints: toNumberOrNull(question.maxPoints ?? question.max_points),
            toleranceMode: question.toleranceMode || question.tolerance_mode || 'hybrid',
            toleranceValue: toNumberOrNull(question.toleranceValue ?? question.tolerance_value) ?? 25,
            toleranceCap: exportToleranceCap(question),
            hint: question.hint || question.hint_text || null
        };
    }

    function mapWordScrambleForExport(question) {
        return {
            question_text: questionText(question),
            type: 'word_scramble',
            ...mediaFields(question),
            correctWord: question.correctWord || question.correct_word || null
        };
    }

    function mapMultipleChoiceForExport(question) {
        return {
            question_text: questionText(question),
            type: 'multiple_choice',
            ...mediaFields(question),
            ...multipleChoiceScoring(question),
            options: (question.options || []).map((option) => ({
                option_text: option.optionText,
                is_correct: !!option.isCorrect,
                order_index: null,
                justification: option.justification || null
            }))
        };
    }

    /** Justificación de una opción: la suya en ordenar; en el resto, solo la correcta. */
    function exportOptionJustification(option, question, questionType) {
        if (questionType === 'order') return option.justification || null;
        return option.isCorrect ? (option.justification || question.justification || null) : null;
    }

    /** Tipos cuyas opciones guardan su posición (en sopa de letras, el orden de las palabras). */
    function isOrderedType(questionType) {
        return questionType === 'order' || questionType === 'matching' || questionType === 'word_search';
    }

    /** Quiz, encuesta, ordenar, emparejar y sopa de letras. */
    function mapOptionsQuestionForExport(question, questionType) {
        const ordered = isOrderedType(questionType);
        return {
            question_text: questionText(question),
            type: questionType,
            ...mediaFields(question),
            options: (question.options || []).map((option, index) => ({
                option_text: option.optionText,
                is_correct: questionType === 'quiz' ? !!option.isCorrect : false,
                order_index: ordered ? index : null,
                match_value: questionType === 'matching' ? (option.match_value ?? null) : null,
                justification: exportOptionJustification(option, question, questionType)
            }))
        };
    }

    const EXPORT_BY_TYPE = {
        numeric_approximation: mapNumericQuestionForExport,
        word_scramble: mapWordScrambleForExport,
        multiple_choice: mapMultipleChoiceForExport
    };

    function mapQuestionForExport(question) {
        const questionType = normalizeQuestionType(question);
        const mapper = Object.hasOwn(EXPORT_BY_TYPE, questionType) ? EXPORT_BY_TYPE[questionType] : null;
        return mapper ? mapper(question) : mapOptionsQuestionForExport(question, questionType);
    }

    // ===== IMPORT =====

    function importBase(question, type) {
        return { id: null, questionText: questionText(question), type, ...mediaFields(question) };
    }

    function mapNumericQuestionForImport(question) {
        return {
            ...importBase(question, 'numeric_approximation'),
            correctAnswer: question.correctAnswer ?? question.correct_answer ?? null,
            maxPoints: question.maxPoints ?? question.max_points ?? null,
            toleranceMode: question.toleranceMode || question.tolerance_mode || 'hybrid',
            toleranceValue: question.toleranceValue ?? question.tolerance_value ?? 25,
            toleranceCap: question.toleranceCap ?? question.tolerance_cap ?? 1000,
            hint: question.hint ?? question.hint_text ?? null,
            options: []
        };
    }

    function mapWordScrambleForImport(question) {
        return {
            ...importBase(question, 'word_scramble'),
            correctWord: question.correctWord || question.correct_word || null,
            ...EMPTY_NUMERIC_FIELDS,
            options: []
        };
    }

    function mapMultipleChoiceForImport(question) {
        return {
            ...importBase(question, 'multiple_choice'),
            ...multipleChoiceScoring(question),
            ...EMPTY_NUMERIC_FIELDS,
            options: (question.options || []).map((option) => ({
                optionText: option.optionText || option.option_text,
                isCorrect: !!option.isCorrect || !!option.is_correct,
                order_index: null,
                justification: option.justification || null
            }))
        };
    }

    function mapOptionsQuestionForImport(question, questionType) {
        const ordered = isOrderedType(questionType);
        return {
            ...importBase(question, questionType),
            ...EMPTY_NUMERIC_FIELDS,
            options: (question.options || []).map((option, index) => ({
                optionText: option.optionText || option.option_text,
                isCorrect: questionType === 'quiz' ? !!option.isCorrect || !!option.is_correct : false,
                order_index: ordered ? (option.order_index ?? option.orderIndex ?? index) : null,
                match_value: questionType === 'matching' ? (option.match_value ?? null) : null,
                justification: option.justification || null
            }))
        };
    }

    const IMPORT_BY_TYPE = {
        numeric_approximation: mapNumericQuestionForImport,
        word_scramble: mapWordScrambleForImport,
        multiple_choice: mapMultipleChoiceForImport
    };

    function mapQuestionForImport(question) {
        const questionType = normalizeQuestionType(question);
        const mapper = Object.hasOwn(IMPORT_BY_TYPE, questionType) ? IMPORT_BY_TYPE[questionType] : null;
        return mapper ? mapper(question) : mapOptionsQuestionForImport(question, questionType);
    }

    window.mapQuestionForExport = mapQuestionForExport;
    window.mapQuestionForImport = mapQuestionForImport;
})();
