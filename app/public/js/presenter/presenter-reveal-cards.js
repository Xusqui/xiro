/**
 * @fileoverview Tarjetas HTML del reveal del presentador: ranking, justificación,
 * orden correcto y parejas del matching.
 */

import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

const RANKING_SIZE = 5;

function rankingItemsHtml(ranking) {
    return ranking.slice(0, RANKING_SIZE).map((p, i) => {
        const bgColor = i === 0 ? 'background: rgba(251, 191, 36, 0.3); border: 2px solid rgb(251, 191, 36);' : 'background: rgba(255, 255, 255, 0.1);';
        return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-radius: 0.75rem; ${bgColor}">
                <span style="font-weight: 900; font-size: 1.125em; text-transform: uppercase;">${i + 1}. ${escapeHtml(p.name)}</span>
                <span style="font-weight: 900; font-size: 1.25em;">${p.pts}</span>
            </div>`;
    }).join('');
}

/**
 * Tarjeta "Top" con los 5 primeros del ranking (sin el HOST).
 * @param {Array} ranking
 * @param {{top: string, sideCss: string, title: string, emptyMessage?: string}} layout
 */
export function rankingCardHtml(ranking, { top, sideCss, title, emptyMessage }) {
    const players = ranking.filter(p => p.name !== 'HOST');
    const items = players.length === 0 && emptyMessage
        ? `<div style="text-align: center; color: rgba(255, 255, 255, 0.7); font-style: italic;">${emptyMessage}</div>`
        : rankingItemsHtml(players);

    return `
        <div id="ranking-card" style="
            position: fixed;
            top: ${top};
            ${sideCss}
            background: linear-gradient(135deg, rgb(148, 67, 142), rgb(37, 99, 235));
            color: white;
            border-radius: 1.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            padding: 1.5rem;
            border: 4px solid white;
            width: 24rem;
            z-index: 9998;
        ">
            <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                <i class="fas fa-trophy" style="color: #fbbf24; font-size: 2em; margin-right: 0.75rem;"></i>
                <h3 style="font-size: 1.5em; font-weight: 900; text-transform: uppercase; font-style: italic;">${title}</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${items}
            </div>
        </div>
    `;
}

export function justificationCardHtml(justification) {
    return `
        <div class="justification-card" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 200px;
            background: linear-gradient(to right, #94438e, #2563eb);
            color: white;
            padding: 3rem 2rem;
            box-shadow: 0 10px 50px rgba(0,0,0,0.3);
            border-bottom: 8px solid white;
            z-index: 9999;
            min-height: 180px;
            font-size: 1.5rem;
        ">
            <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 2rem; height: 100%;">
                <div style="background-color: rgba(255, 255, 255, 0.2); padding: 1.5rem; border-radius: 1.5rem; flex-shrink: 0;">
                    <i class="fas fa-lightbulb" style="font-size: 2.67em; color: #fde047;"></i>
                </div>
                <div style="flex: 1;">
                    <h3 style="font-size: 1.33em; font-weight: 900; text-transform: uppercase; font-style: italic; margin-bottom: 1rem; letter-spacing: 0.05em;">${_t('presenter.reveal.why_correct', null, '¿Por qué es correcta?')}</h3>
                    <p style="font-size: 1em; font-weight: 500; line-height: 1.5;">${escapeHtml(justification)}</p>
                </div>
            </div>
        </div>
    `;
}

export function renderOrderReveal(correctOrder, options = {}) {
    const existing = document.getElementById('order-reveal-card');
    if (existing) existing.remove();

    const topOffset = options.topOffset || '7.5rem';

    const items = correctOrder.map((item, index) => {
        const text = item?.text || '';
        const justification = item?.justification || '';

        return `
            <div style="display:flex; align-items:center; gap:0.75rem; background: rgba(255,255,255,0.12); border: 2px solid rgba(255,255,255,0.3); border-radius: 1rem; padding: 0.75rem 1rem;">
                <span style="background: rgba(0,0,0,0.35); width: 2.25em; height: 2.25em; flex-shrink: 0; border-radius: 9999px; display:flex; align-items:center; justify-content:center; font-weight: 900;">${index + 1}</span>
                <div style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1;">
                    <span style="font-weight: 800; text-transform: uppercase; font-style: italic;">${escapeHtml(text)}</span>
                    ${justification ? `<span style="font-size: 0.875em; opacity: 0.85; font-weight: 500;">${escapeHtml(justification)}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    const html = `
        <div id="order-reveal-card" style="position: fixed; top: ${topOffset}; left: 50%; transform: translateX(-50%); width: 520px; max-width: 80vw; background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(127,84,141,0.95)); color: white; border-radius: 2rem; border: 4px solid white; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); padding: 1.5rem; z-index: 9998;">
            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom: 1rem;">
                <i class="fas fa-sort-amount-down" style="font-size: 1.75em; color: #a7f3d0;"></i>
                <h3 style="font-size: 1.5em; font-weight: 900; text-transform: uppercase; font-style: italic; margin: 0;">${_t('presenter.reveal.correct_order', null, 'Orden correcto')}</h3>
            </div>
            <div style="display:flex; flex-direction: column; gap: 0.75rem;">${items}</div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', _tHtml(html));
}

export function renderMatchingReveal(correctMatches, options = {}) {
    const existing = document.getElementById('matching-reveal-card');
    if (existing) existing.remove();

    const topOffset = options.topOffset || '7.5rem';

    const rows = correctMatches.map((pair) => `
        <div style="display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; gap:0.5rem; background: rgba(255,255,255,0.12); border: 2px solid rgba(255,255,255,0.3); border-radius: 1rem; padding: 0.6rem 0.75rem;">
            <span style="font-weight: 800; text-transform: uppercase; font-style: italic; text-align:right;">${escapeHtml(pair.leftText)}</span>
            <span style="color: #fde047; font-size: 1.2em; font-weight: 900; flex-shrink: 0;">↔</span>
            <span style="font-weight: 800; text-transform: uppercase; font-style: italic; text-align:left;">${escapeHtml(pair.rightText)}</span>
        </div>
    `).join('');

    const html = `
        <div id="matching-reveal-card" style="position: fixed; top: ${topOffset}; left: 50%; transform: translateX(-50%); width: 560px; max-width: 82vw; background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(180,83,9,0.9)); color: white; border-radius: 2rem; border: 4px solid white; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); padding: 1.5rem; z-index: 9998;">
            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom: 1rem;">
                <i class="fas fa-columns" style="font-size: 1.75em; color: #fde047;"></i>
                <h3 style="font-size: 1.5em; font-weight: 900; text-transform: uppercase; font-style: italic; margin: 0;">${_t('presenter.reveal.correct_pairs', null, 'Pares correctos')}</h3>
            </div>
            <div style="display:flex; flex-direction: column; gap: 0.6rem;">${rows}</div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', _tHtml(html));
}
