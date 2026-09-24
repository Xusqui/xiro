window.TVApp = window.TVApp || {};
window.TVApp.Tolerance = (function () {
    'use strict';

    function toPositiveNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function getNumericToleranceConfig(question, revealData) {
        const modeRaw = String(
            (question && (question.tolerance_mode || question.toleranceMode))
            || (revealData && (revealData.toleranceMode || revealData.tolerance_mode))
            || ''
        ).toLowerCase();

        const mode = (modeRaw === 'absolute' || modeRaw === 'percentage' || modeRaw === 'hybrid' || modeRaw === 'relative')
            ? modeRaw
            : 'hybrid';

        const value = toPositiveNumber(
            (question && (question.tolerance_value || question.toleranceValue))
            || (revealData && (revealData.toleranceValue || revealData.tolerance_value))
        ) || 25;

        let cap = toPositiveNumber(
            (question && (question.tolerance_cap || question.toleranceCap))
            || (revealData && (revealData.toleranceCap || revealData.tolerance_cap))
        );

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
