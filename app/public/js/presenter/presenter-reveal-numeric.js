/**
 * @fileoverview Reveal de preguntas de aproximación numérica en el presentador:
 * cálculo de la tolerancia mostrada y tarjeta con la respuesta correcta.
 */

import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

function toPositiveNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getNumericToleranceConfig(question = {}) {
    const modeRaw = String(question.tolerance_mode ?? question.toleranceMode ?? '').toLowerCase();
    const mode = modeRaw === 'absolute' || modeRaw === 'percentage' || modeRaw === 'hybrid' || modeRaw === 'relative'
        ? modeRaw
        : 'hybrid';

    const value = toPositiveNumber(question.tolerance_value ?? question.toleranceValue) ?? 25;
    const cap = toPositiveNumber(question.tolerance_cap ?? question.toleranceCap);

    return {
        mode,
        value,
        cap: cap ?? (mode === 'hybrid' ? 1000 : null)
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

function formatNumericToleranceLabel(correctAnswer, question = {}) {
    const toleranceConfig = getNumericToleranceConfig(question);
    const effectiveTolerance = resolveToleranceWindowForDisplay(correctAnswer, toleranceConfig);

    if (toleranceConfig.mode === 'absolute') {
        return `±${effectiveTolerance}`;
    }

    if (toleranceConfig.mode === 'percentage' || toleranceConfig.mode === 'relative') {
        return `±${effectiveTolerance.toFixed(2)} (${toleranceConfig.value}%)`;
    }

    return `±${effectiveTolerance.toFixed(2)} (${toleranceConfig.value}% hasta máx. ${toleranceConfig.cap})`;
}

/**
 * Tarjeta superior con la respuesta correcta, la tolerancia y los puntos máximos.
 * Los datos de la pregunta tienen prioridad sobre los del payload del servidor.
 */
export function numericRevealCardHtml(question, data) {
    const correctAnswer = question?.correct_answer ?? data.correctAnswer ?? '?';
    const maxPoints = question?.max_points ?? data.maxPoints ?? 0;
    const toleranceQuestion = {
        ...(question || {}),
        tolerance_mode: question?.tolerance_mode ?? data.toleranceMode,
        tolerance_value: question?.tolerance_value ?? data.toleranceValue,
        tolerance_cap: question?.tolerance_cap ?? data.toleranceCap
    };
    const toleranceLabel = formatNumericToleranceLabel(correctAnswer, toleranceQuestion);

    return `
        <div class="justification-card" id="numeric-reveal-card" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 200px;
            background: linear-gradient(to right, #10b981, #059669);
            color: white;
            padding: 2rem 2rem;
            box-shadow: 0 10px 50px rgba(0,0,0,0.3);
            border-bottom: 8px solid white;
            z-index: 9999;
            min-height: 140px;
        ">
            <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 1.5rem; height: 100%;">
                <div style="background-color: rgba(255, 255, 255, 0.2); padding: 1rem; border-radius: 1rem; flex-shrink: 0;">
                    <i class="fas fa-check-circle" style="font-size: 2.5rem; color: #ecfccb;"></i>
                </div>
                <div style="flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                    <div>
                        <h3 style="font-size: 1.75rem; font-weight: 900; text-transform: uppercase; font-style: italic; margin: 0 0 0.3rem 0;">${_t('presenter.reveal.correct_answer', null, 'Respuesta correcta')}</h3>
                        <p style="font-size: 0.95rem; opacity: 0.9; margin: 0;">${_t('presenter.reveal.tolerance', null, 'Tolerancia:')} ${escapeHtml(toleranceLabel)} ${_t('presenter.reveal.max_points', null, '· Puntos máximos:')} ${escapeHtml(maxPoints)}</p>
                    </div>
                    <div style="font-size: 3.2rem; font-weight: 900; color: #fef08a; line-height: 1;">${escapeHtml(correctAnswer)}</div>
                </div>
            </div>
        </div>
    `;
}
