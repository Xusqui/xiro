/**
 * @fileoverview Presenter — Trivial winner overlay
 *
 * Shows a fullscreen blurred overlay with "¡TENEMOS GANADOR!" and a
 * "Ver Podio" button. Does NOT reveal who won — that is shown when the
 * presenter clicks the button and renderPodio() runs.
 *
 * Public API:
 *   showTrivialWinnerOverlay(ranking) — mounts the overlay on document.body
 */

import { renderPodio } from './presenter-game-ui.js?v=20260827184252';

const OVERLAY_ID = 'trivial-winner-overlay';
const BTN_ID = 'trivial-winner-podium-btn';

const OVERLAY_STYLE = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'display:flex', 'align-items:center', 'justify-content:center',
    'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
    'background:rgba(15,23,42,0.82)',
    'animation:fadeIn 0.5s ease',
].join(';');

const CARD_STYLE = [
    'background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%)',
    'border:2px solid rgba(251,191,36,0.5)',
    'border-radius:24px',
    'padding:clamp(32px,5vw,64px) clamp(28px,5vw,72px)',
    'max-width:min(560px,90vw)',
    'width:100%',
    'text-align:center',
    'box-shadow:0 32px 80px rgba(0,0,0,0.7),0 0 60px rgba(251,191,36,0.15)',
    'display:flex', 'flex-direction:column', 'align-items:center', 'gap:28px',
].join(';');

const TITLE_STYLE = [
    'color:#fbbf24',
    'font-size:clamp(1.8rem,4vw,3rem)',
    'font-weight:900',
    'letter-spacing:-0.5px',
    'text-shadow:0 0 40px rgba(251,191,36,0.6)',
    'line-height:1.2',
    'text-transform:uppercase',
].join(';');

const BTN_STYLE = [
    'background:linear-gradient(135deg,#d97706,#fbbf24)',
    'color:#0f172a',
    'border:none',
    'border-radius:14px',
    'padding:16px 48px',
    'font-size:clamp(1rem,2vw,1.3rem)',
    'font-weight:900',
    'cursor:pointer',
    'letter-spacing:0.5px',
    'box-shadow:0 8px 24px rgba(217,119,6,0.5)',
    'transition:transform 0.15s',
    'text-transform:uppercase',
].join(';');

/**
 * Mounts the winner overlay on document.body.
 * Pressing "Ver Podio" removes the overlay and calls renderPodio(ranking).
 * @param {Array} ranking — ranking array from trivial-winner event
 */
export function showTrivialWinnerOverlay(ranking) {
    // Remove any stale overlay (edge case: duplicate event)
    removeWinnerOverlay();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = OVERLAY_STYLE;

    overlay.innerHTML = _tHtml(`
        <div style="${CARD_STYLE}">
            <div style="font-size:clamp(4rem,10vw,7rem);line-height:1">🏆</div>
            <div style="${TITLE_STYLE}">¡Tenemos ganador!</div>
            <button id="${BTN_ID}" style="${BTN_STYLE}">
                ${_t('presenter.game.view_ranking', null, 'Ver Ránking')}
            </button>
        </div>`);

    document.body.appendChild(overlay);

    const podiumBtn = document.getElementById(BTN_ID);
    podiumBtn.addEventListener('mouseenter', () => {
        podiumBtn.style.transform = 'scale(1.05)';
    });
    podiumBtn.addEventListener('mouseleave', () => {
        podiumBtn.style.transform = 'scale(1)';
    });
    podiumBtn.addEventListener('click', () => {
        removeWinnerOverlay();
        if (ranking?.length > 0) renderPodio(ranking);
    });
}

/** Returns true when the winner overlay is currently visible. */
export function isWinnerOverlayActive() {
    return !!document.getElementById(OVERLAY_ID);
}

/** Removes the overlay if present. */
export function removeWinnerOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
}
