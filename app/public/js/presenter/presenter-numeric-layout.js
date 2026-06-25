/**
 * @fileoverview Helpers de layout para pregunta numérica en presentador
 */

const HINT_OVERLAY_ID = 'presenter-hint-overlay';

function escapeHtml(text = '') {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getResponsiveHintFontSize(hintText = '') {
    const length = hintText.trim().length;

    if (length <= 30) return 'clamp(1.35rem, 2.4vw, 1.9rem)';
    if (length <= 60) return 'clamp(1.15rem, 2vw, 1.6rem)';
    if (length <= 100) return 'clamp(1rem, 1.7vw, 1.35rem)';
    return 'clamp(0.85rem, 1.3vw, 1.1rem)';
}

function getLobbyMainRect() {
    const lobbyMain = document.getElementById('lobby-main');
    if (!lobbyMain) return null;
    const rect = lobbyMain.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    return rect;
}

export function pinNumericInfoPanelUnderQuestion() {
    const numericTitle = Array.from(document.querySelectorAll('p'))
        .find(el => (el.textContent || '').trim() === 'PREGUNTA NUMÉRICA');

    if (!numericTitle) return;

    const infoCard = numericTitle.closest('div.bg-gradient-to-br') || numericTitle.closest('div');
    const wrapper = infoCard?.parentElement;
    if (!infoCard || !wrapper) return;

    wrapper.style.flex = '0 0 auto';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'flex-start';
    wrapper.style.justifyContent = 'center';
    wrapper.style.paddingBottom = '0';
    wrapper.style.marginTop = '-8px';

    infoCard.style.width = 'min(92vw, 1120px)';
    infoCard.style.maxWidth = '1120px';
    infoCard.style.padding = '22px 28px';
}

export function renderCenteredNumericHint(hintText) {
    const safeHint = escapeHtml(hintText || 'El presentador no quiere dar pistas');
    const fontSize = getResponsiveHintFontSize(safeHint);

    let overlay = document.getElementById(HINT_OVERLAY_ID);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = HINT_OVERLAY_ID;
        overlay.style.cssText = 'position:fixed;left:50%;top:100px;transform:translateX(-50%);width:min(calc(100vw - 24px), 1400px);z-index:9996;pointer-events:none;display:flex;align-items:flex-start;justify-content:center;';
        document.body.appendChild(overlay);
    }

    const lobbyRect = getLobbyMainRect();
    if (lobbyRect) {
        const centerX = lobbyRect.left + (lobbyRect.width / 2);
        const width = Math.max(320, Math.min(lobbyRect.width - 24, 1400));
        overlay.style.left = `${centerX}px`;
        overlay.style.width = `${width}px`;
    } else {
        overlay.style.left = '50%';
        overlay.style.width = 'min(calc(100vw - 24px), 1400px)';
    }

    const questionTitle = document.getElementById('question-title');
    const topPx = questionTitle
        ? Math.max(8, Math.round(questionTitle.getBoundingClientRect().bottom + 8))
        : 100;
    overlay.style.top = `${topPx}px`;

    overlay.innerHTML = _tHtml(`
        <div style="width:100%;display:flex;align-items:center;justify-content:center;padding:0 12px;">
            <div style="width:100%;max-width:1120px;background:linear-gradient(135deg, rgba(147,51,234,.88), rgba(79,70,229,.88));border:1px solid rgba(255,255,255,.22);border-radius:14px;box-shadow:0 10px 24px rgba(76,29,149,.45);padding:10px 16px;">
                <p style="margin:0;font-size:${fontSize};font-weight:900;line-height:1.05;color:#f8fafc;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">💡 ${safeHint}</p>
            </div>
        </div>
    `);
}

export function removeCenteredNumericHint() {
    const overlay = document.getElementById(HINT_OVERLAY_ID);
    if (overlay) overlay.remove();
}
