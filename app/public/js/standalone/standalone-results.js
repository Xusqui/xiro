/**
 * @fileoverview Pantalla final del modo Standalone (evento 'game-ended')
 * ranking: [{ name, pts, position, isTeam }]
 */

'use strict';

const StandaloneResults = (() => {
    const { escapeHtml } = StandaloneQuestionCommon;

    // Escala de nota discreta (0-10 continuo → etiqueta), estilo académico español.
    const GRADE_BANDS = [
        { min: 9, key: 'standalone.game.grade_sobresaliente', fallback: 'Sobresaliente' },
        { min: 7, key: 'standalone.game.grade_notable', fallback: 'Notable' },
        { min: 5, key: 'standalone.game.grade_aprobado', fallback: 'Aprobado' },
        { min: 0, key: 'standalone.game.grade_suspenso', fallback: 'Suspenso' }
    ];

    function computeGrade(pts, maxPossibleScore) {
        const ratio = maxPossibleScore > 0 ? Math.max(0, Math.min(1, pts / maxPossibleScore)) : 0;
        const continuous = Math.round(ratio * 10 * 10) / 10;
        const band = GRADE_BANDS.find(b => continuous >= b.min);
        return { continuous, band };
    }

    function renderScoreSummary(pts, maxPossibleScore) {
        if (!Number.isFinite(maxPossibleScore) || maxPossibleScore <= 0) {
            return `
                <div class="score-number">${pts}</div>
                <div class="score-label">${window.XiroI18n?.t('standalone.game.score') || 'Puntos'}</div>
            `;
        }

        const { continuous, band } = computeGrade(pts, maxPossibleScore);
        const gradeLabel = window.XiroI18n?.t(band.key) || band.fallback;

        return `
            <div class="score-number">${pts}</div>
            <div class="score-label">
                ${window.XiroI18n?.t('standalone.game.score_of_max', { score: pts, max: maxPossibleScore })
                    || `${pts} Puntos de un máximo de ${maxPossibleScore}`}
            </div>
            <div class="score-grade">
                <span class="score-grade-number">${continuous.toFixed(1)}/10</span>
                <span class="score-grade-label">${escapeHtml(gradeLabel)}</span>
            </div>
        `;
    }

    function render(container, ranking) {
        const nickname = StandaloneState.get().nickname;
        const maxPossibleScore = StandaloneState.get().maxPossibleScore;
        const list = Array.isArray(ranking) ? ranking : [];
        const own = list.find(r => r.name === nickname) || list[0] || { pts: 0 };

        container.innerHTML = `
            <div class="standalone-results standalone-card">
                <i class="fas fa-trophy trophy-icon"></i>
                <h1>${window.XiroI18n?.t('standalone.game.finished') || '¡Juego Terminado!'}</h1>
                <div class="final-score">
                    ${renderScoreSummary(own.pts ?? 0, maxPossibleScore)}
                </div>
                <button data-standalone-action="back-to-lobby" class="btn-primary">
                    ${window.XiroI18n?.t('standalone.game.play_again') || 'Jugar de nuevo'}
                </button>
            </div>
        `;

        container.querySelector('[data-standalone-action="back-to-lobby"]')
            .addEventListener('click', () => {
                StandaloneSocket.abandonAndDisconnect();
                window.location.href = '/standalone.html';
            });
    }

    return { render };
})();
