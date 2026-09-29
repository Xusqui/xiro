/**
 * @fileoverview Player — Trivial winner screen
 *
 * Shown when the trivial-winner event arrives on the player side.
 * Does NOT reveal who won — the winner is announced via the standard
 * player-final-position event (player-results.js) that arrives right after.
 *
 * Public API:
 *   showTrivialWinnerScreen() — renders the waiting screen in #game-area
 */

function getRoot() {
    return document.getElementById('game-area')
        || document.getElementById('jugador-content')
        || document.getElementById('main-container')
        || document.body;
}

const SCREEN_STYLE = [
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'height:100%', 'gap:20px', 'padding:32px',
    'background:#0f172a', 'border-radius:16px', 'text-align:center',
].join(';');

const TITLE_STYLE = [
    'color:#fbbf24',
    'font-size:clamp(1.4rem,5vw,2rem)',
    'font-weight:900',
    'text-shadow:0 0 30px rgba(251,191,36,0.6)',
    'text-transform:uppercase',
].join(';');

const SUB_STYLE = [
    'color:#94a3b8',
    'font-size:0.95rem',
].join(';');

/**
 * Renders a "¡Juego terminado!" screen without revealing who won.
 * The result screen is shown shortly after by player-final-position.
 */
export function showTrivialWinnerScreen() {
    getRoot().innerHTML = _tHtml(`
        <div style="${SCREEN_STYLE}">
            <div style="font-size:4rem">🏆</div>
            <div style="${TITLE_STYLE}">${_t('player.results.game_over', null, '¡Juego Terminado!')}</div>
            <div style="${SUB_STYLE}">${_t('player.results.calculating', null, 'Calculando resultados...')}</div>
        </div>`);
}
