window.TVApp = window.TVApp || {};
window.TVApp.Tolerance = (function () {
    'use strict';

    function toPositiveNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    const TOLERANCE_MODES = ['absolute', 'percentage', 'hybrid', 'relative'];

    /** Campo de tolerancia: primero de la pregunta (snake, camel) y si no, del reveal (camel, snake). */
    function toleranceField(question, revealData, snakeKey, camelKey) {
        const fromQuestion = question ? (question[snakeKey] || question[camelKey]) : undefined;
        if (fromQuestion) return fromQuestion;
        return revealData ? (revealData[camelKey] || revealData[snakeKey]) : undefined;
    }

    function getNumericToleranceConfig(question, revealData) {
        const modeRaw = String(toleranceField(question, revealData, 'tolerance_mode', 'toleranceMode') || '').toLowerCase();
        const mode = TOLERANCE_MODES.indexOf(modeRaw) !== -1 ? modeRaw : 'hybrid';

        const value = toPositiveNumber(toleranceField(question, revealData, 'tolerance_value', 'toleranceValue')) || 25;

        let cap = toPositiveNumber(toleranceField(question, revealData, 'tolerance_cap', 'toleranceCap'));

        if (mode === 'hybrid' && cap === null) {
            cap = 1000;
        }

        return {
            mode: mode,
            value: value,
            cap: cap
        };
    }

    function resolveToleranceWindowForDisplay(correctAnswer, toleranceConfig) {
        const absCorrect = Math.abs(Number(correctAnswer) || 0);
        const percentageTolerance = absCorrect * (toleranceConfig.value / 100);

        if (toleranceConfig.mode === 'absolute') {
            return toleranceConfig.value;
        }

        if (toleranceConfig.mode === 'percentage' || toleranceConfig.mode === 'relative' || toleranceConfig.mode === 'hybrid') {
            return toleranceConfig.cap
                ? Math.min(percentageTolerance, toleranceConfig.cap)
                : percentageTolerance;
        }

        return percentageTolerance;
    }

    function formatToleranceLabel(correctAnswer, question, revealData) {
        const config = getNumericToleranceConfig(question, revealData);
        const effectiveTolerance = resolveToleranceWindowForDisplay(correctAnswer, config);

        if (config.mode === 'absolute') {
            return '±' + effectiveTolerance;
        }

        if (config.mode === 'percentage' || config.mode === 'relative') {
            return '±' + effectiveTolerance.toFixed(2) + ' (' + config.value + '%)';
        }

        return '±' + effectiveTolerance.toFixed(2) + ' (' + config.value + '% hasta máx. ' + config.cap + ')';
    }

    return {
        formatToleranceLabel: formatToleranceLabel
    };
})();
