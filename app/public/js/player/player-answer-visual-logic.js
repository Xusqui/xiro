/**
 * @fileoverview Lógica visual compartida para resultados de respuesta en cliente
 */

(function attachPlayerAnswerVisualLogic(root) {
    function isNumericLike(value) {
        if (typeof value === 'number') {
            return Number.isFinite(value);
        }

        if (typeof value !== 'string') {
            return false;
        }

        const normalized = value.trim();
        return normalized !== '' && /^-?\d+(\.\d+)?$/.test(normalized);
    }

    function isNumericApproximationQuestion(currentSlideType, correctAnswer) {
        return currentSlideType === 'numeric_approximation' || isNumericLike(correctAnswer);
    }

    function shouldShowApproximateResult({ isOrder, currentSlideType, data }) {
        return !isOrder
            && isNumericApproximationQuestion(currentSlideType, data?.correctAnswer)
            && data?.correct === false
            && Number(data?.points) > 0;
    }

    function resolveResultColor({ isOrder, isFullyCorrect, isApproximate, isCorrect }) {
        if (isOrder) {
            return isFullyCorrect ? 'bg-green-500' : 'bg-blue-500';
        }

        // Encuesta (sin correcta): ciruela de marca; el azul no estaba en la paleta
        if (isCorrect === null) {
            return 'bg-plum-600';
        }

        if (isCorrect) {
            return 'bg-green-500';
        }

        return isApproximate ? 'bg-yellow-500' : 'bg-red-500';
    }

    const api = {
        isNumericLike,
        isNumericApproximationQuestion,
        shouldShowApproximateResult,
        resolveResultColor
    };

    if (root) {
        root.PlayerAnswerVisualLogic = api;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));
