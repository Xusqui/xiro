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

    function mapNumericQuestionForExport(question) {
        const toleranceCapSource = question.toleranceCap ?? question.tolerance_cap;
        const toleranceCap = toleranceCapSource === null || toleranceCapSource === ''
            ? null
            : toNumberOrNull(toleranceCapSource);

        return {
            question_text: question.questionText || question.question_text,
            type: 'numeric_approximation',
            tipo_contenido: question.tipo_contenido || 'texto',
            url_recurso: question.url_recurso || null,
            time_limit: question.time_limit || 20,
            correctAnswer: toNumberOrNull(question.correctAnswer ?? question.correct_answer),
            maxPoints: toNumberOrNull(question.maxPoints ?? question.max_points),
            toleranceMode: question.toleranceMode || question.tolerance_mode || 'hybrid',
            toleranceValue: toNumberOrNull(question.toleranceValue ?? question.tolerance_value) ?? 25,
            toleranceCap,
            hint: question.hint || question.hint_text || null
        };
    }

    function mapQuestionForExport(question) {
        const questionType = normalizeQuestionType(question);

        if (questionType === 'numeric_approximation') {
            return mapNumericQuestionForExport(question);
        }

        if (questionType === 'word_scramble') {
            return {
                question_text: question.questionText || question.question_text,
                type: 'word_scramble',
                tipo_contenido: question.tipo_contenido || 'texto',
                url_recurso: question.url_recurso || null,
                time_limit: question.time_limit || 20,
                correctWord: question.correctWord || question.correct_word || null
            };
        }

        if (questionType === 'multiple_choice') {
            return {
                question_text: question.questionText || question.question_text,
                type: 'multiple_choice',
                tipo_contenido: question.tipo_contenido || 'texto',
                url_recurso: question.url_recurso || null,
                time_limit: question.time_limit || 20,
                mc_points_per_correct: toNumberOrNull(question.mcPointsPerCorrect ?? question.mc_points_per_correct) ?? 10,
                mc_penalty_per_incorrect: toNumberOrNull(question.mcPenaltyPerIncorrect ?? question.mc_penalty_per_incorrect) ?? 10,
                mc_perfect_bonus: toNumberOrNull(question.mcPerfectBonus ?? question.mc_perfect_bonus) ?? 20,
                options: (question.options || []).map((option) => ({
                    option_text: option.optionText,
                    is_correct: !!option.isCorrect,
                    order_index: null,
                    justification: option.justification || null
                }))
            };
        }

        return {
            question_text: question.questionText || question.question_text,
            type: questionType,
            tipo_contenido: question.tipo_contenido || 'texto',
            url_recurso: question.url_recurso || null,
            time_limit: question.time_limit || 20,
            options: (question.options || []).map((option, index) => ({
                option_text: option.optionText,
                is_correct: questionType === 'quiz' ? !!option.isCorrect : false,
                order_index: (questionType === 'order' || questionType === 'matching') ? index : null,
                match_value: questionType === 'matching' ? (option.match_value ?? null) : null,
                justification: questionType === 'order'
                    ? (option.justification || null)
                    : (option.isCorrect ? (option.justification || question.justification || null) : null)
            }))
        };
    }

    function mapQuestionForImport(question) {
        const questionType = normalizeQuestionType(question);

        if (questionType === 'numeric_approximation') {
            return {
                id: null,
                questionText: question.questionText || question.question_text,
                type: questionType,
                tipo_contenido: question.tipo_contenido || 'texto',
                url_recurso: question.url_recurso || null,
                time_limit: question.time_limit || 20,
                correctAnswer: question.correctAnswer ?? question.correct_answer ?? null,
                maxPoints: question.maxPoints ?? question.max_points ?? null,
                toleranceMode: question.toleranceMode || question.tolerance_mode || 'hybrid',
                toleranceValue: question.toleranceValue ?? question.tolerance_value ?? 25,
                toleranceCap: question.toleranceCap ?? question.tolerance_cap ?? 1000,
                hint: question.hint ?? question.hint_text ?? null,
                options: []
            };
        }

        if (questionType === 'word_scramble') {
            return {
                id: null,
                questionText: question.questionText || question.question_text,
                type: 'word_scramble',
                tipo_contenido: question.tipo_contenido || 'texto',
                url_recurso: question.url_recurso || null,
                time_limit: question.time_limit || 20,
                correctWord: question.correctWord || question.correct_word || null,
                correctAnswer: null,
                maxPoints: null,
                toleranceMode: null,
                toleranceValue: null,
                toleranceCap: null,
                hint: null,
                options: []
            };
        }

        if (questionType === 'multiple_choice') {
            return {
                id: null,
                questionText: question.questionText || question.question_text,
                type: 'multiple_choice',
                tipo_contenido: question.tipo_contenido || 'texto',
                url_recurso: question.url_recurso || null,
                time_limit: question.time_limit || 20,
                mc_points_per_correct: toNumberOrNull(question.mcPointsPerCorrect ?? question.mc_points_per_correct) ?? 10,
                mc_penalty_per_incorrect: toNumberOrNull(question.mcPenaltyPerIncorrect ?? question.mc_penalty_per_incorrect) ?? 10,
                mc_perfect_bonus: toNumberOrNull(question.mcPerfectBonus ?? question.mc_perfect_bonus) ?? 20,
                correctAnswer: null,
                maxPoints: null,
                toleranceMode: null,
                toleranceValue: null,
                toleranceCap: null,
                hint: null,
                options: (question.options || []).map((option) => ({
                    optionText: option.optionText || option.option_text,
                    isCorrect: !!option.isCorrect || !!option.is_correct,
                    order_index: null,
                    justification: option.justification || null
                }))
            };
        }

        return {
            id: null,
            questionText: question.questionText || question.question_text,
            type: questionType,
            tipo_contenido: question.tipo_contenido || 'texto',
            url_recurso: question.url_recurso || null,
            time_limit: question.time_limit || 20,
            correctAnswer: null,
            maxPoints: null,
            toleranceMode: null,
            toleranceValue: null,
            toleranceCap: null,
            hint: null,
            options: (question.options || []).map((option, index) => ({
                optionText: option.optionText || option.option_text,
                isCorrect: questionType === 'quiz' ? !!option.isCorrect || !!option.is_correct : false,
                order_index: (questionType === 'order' || questionType === 'matching') ? (option.order_index ?? option.orderIndex ?? index) : null,
                match_value: questionType === 'matching' ? (option.match_value ?? null) : null,
                justification: option.justification || null
            }))
        };
    }

    window.mapQuestionForExport = mapQuestionForExport;
    window.mapQuestionForImport = mapQuestionForImport;
})();