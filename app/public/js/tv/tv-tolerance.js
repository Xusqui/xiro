window.TVApp = window.TVApp || {};
window.TVApp.Tolerance = (function () {
    'use strict';

    function toPositiveNumber(value) {
        var parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function getNumericToleranceConfig(question, revealData) {
        var modeRaw = String(
            (question && (question.tolerance_mode || question.toleranceMode))
            || (revealData && (revealData.toleranceMode || revealData.tolerance_mode))
            || ''
        ).toLowerCase();

        var mode = (modeRaw === 'absolute' || modeRaw === 'percentage' || modeRaw === 'hybrid' || modeRaw === 'relative')
            ? modeRaw
            : 'hybrid';

        var value = toPositiveNumber(
            (question && (question.tolerance_value || question.toleranceValue))
            || (revealData && (revealData.toleranceValue || revealData.tolerance_value))
        ) || 25;

        var cap = toPositiveNumber(
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
        var absCorrect = Math.abs(Number(correctAnswer) || 0);
        var percentageTolerance = absCorrect * (toleranceConfig.value / 100);

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
        var config = getNumericToleranceConfig(question, revealData);
        var effectiveTolerance = resolveToleranceWindowForDisplay(correctAnswer, config);

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
