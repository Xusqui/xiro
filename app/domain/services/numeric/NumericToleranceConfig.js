/**
 * @fileoverview Configuración y normalización de tolerancia para preguntas numéricas
 */

const NUMERIC_TOLERANCE_MODES = {
    ABSOLUTE: 'absolute',
    PERCENTAGE: 'percentage',
    HYBRID: 'hybrid'
};

const NUMERIC_TOLERANCE_DEFAULTS = {
    mode: NUMERIC_TOLERANCE_MODES.HYBRID,
    value: 25,
    cap: 1000,
    exactBonus: 20
};

function toPositiveNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Normaliza la tolerancia de una pregunta numérica; los valores que falten o no sean válidos toman el valor por
 * defecto. El tope por defecto solo se aplica al modo híbrido.
 * @param {Object} [question={}] - Pregunta con tolerance_mode, tolerance_value y tolerance_cap
 * @returns {{mode: string, value: number, cap: number|null, exactBonus: number}}
 */
function normalizeToleranceConfig(question = {}) {
    const rawMode = String(question.tolerance_mode || '').toLowerCase();
    const mode = Object.values(NUMERIC_TOLERANCE_MODES).includes(rawMode) ? rawMode : NUMERIC_TOLERANCE_DEFAULTS.mode;

    const value = toPositiveNumber(question.tolerance_value) ?? NUMERIC_TOLERANCE_DEFAULTS.value;
    const cap = toPositiveNumber(question.tolerance_cap);

    return {
        mode,
        value,
        cap: cap ?? (mode === NUMERIC_TOLERANCE_MODES.HYBRID ? NUMERIC_TOLERANCE_DEFAULTS.cap : null),
        exactBonus: NUMERIC_TOLERANCE_DEFAULTS.exactBonus
    };
}

module.exports = {
    NUMERIC_TOLERANCE_MODES,
    normalizeToleranceConfig
};
