/**
 * @fileoverview Pantalla final del modo Standalone (evento 'game-ended')
 * ranking: [{ name, pts, position, isTeam }]
 */

'use strict';

const StandaloneResults = (() => {
    const { escapeHtml } = StandaloneQuestionCommon;

    function render(container, ranking) {
        const nickname = StandaloneState.get().nickname;
        const list = Array.isArray(ranking) ? ranking : [];
        const own = list.find(r => r.name === nickname) || list[0] || { pts: 0 };

        container.innerHTML = `
            <div class="standalone-results standalone-card">
                <i class="fas fa-trophy trophy-icon"></i>
                <h1>${window.XiroI18n?.t('standalone.game.finished') || '¡Juego Terminado!'}</h1>
                <div class="final-score">
                    <div class="score-number">${own.pts ?? 0}</div>
                    <div class="score-label">${window.XiroI18n?.t('standalone.game.score') || 'Puntos'}</div>
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
