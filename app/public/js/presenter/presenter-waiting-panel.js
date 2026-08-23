/**
 * @fileoverview Panel de espera enriquecido para presentador (Opción C)
 */

import { getPlayersData } from './presenter-state.js?v=20260823152650';
import {
    renderCenteredNumericHint,
    removeCenteredNumericHint
} from './presenter-numeric-layout.js?v=20260823152650';
import { getNumericProgressMetrics } from './presenter-progress-metrics.js?v=20260823152650';

let resizeHandler = null;

function isNumericQuestionWaitingState() {
    const btnNext = document.getElementById('btn-next');
    const questionTitle = document.getElementById('question-title');
    const currentQuestion = window.currentQuestion || {};
    return !!questionTitle && currentQuestion.question_type === 'numeric_approximation' && (!btnNext || btnNext.classList.contains('hidden'));
}

function isNumericQuestionWithImage() {
    const currentQuestion = window.currentQuestion || {};
    return currentQuestion.question_type === 'numeric_approximation'
        && currentQuestion.tipo_contenido === 'imagen'
        && !!currentQuestion.url_recurso;
}

function ensurePanel() {
    let panel = document.getElementById('presenter-waiting-panel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'presenter-waiting-panel';
    panel.style.cssText = 'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);width:min(calc(100vw - 24px), 1400px);min-width:320px;z-index:9997;color:#fff;';
    document.body.appendChild(panel);
    return panel;
}

function alignPanelToLobbyMain(panel) {
    const lobbyMain = document.getElementById('lobby-main');
    if (!lobbyMain) {
        panel.style.left = '50%';
        panel.style.width = 'min(calc(100vw - 24px), 1400px)';
        return;
    }

    const rect = lobbyMain.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
        panel.style.left = '50%';
        panel.style.width = 'min(calc(100vw - 24px), 1400px)';
        return;
    }

    const centerX = rect.left + (rect.width / 2);
    const panelWidth = Math.max(320, Math.min(rect.width - 24, 1400));

    panel.style.left = `${centerX}px`;
    panel.style.width = `${panelWidth}px`;
}

function removePanel() {
    const panel = document.getElementById('presenter-waiting-panel');
    if (panel) panel.remove();
    removeCenteredNumericHint();
}

function removeProgressPanelOnly() {
    const panel = document.getElementById('presenter-waiting-panel');
    if (panel) panel.remove();
}

function renderWaitingPanel() {
    if (!isNumericQuestionWaitingState()) {
        removePanel();
        return;
    }

    const currentQuestion = window.currentQuestion || {};
    const hint = (currentQuestion.hint_text || currentQuestion.hint || currentQuestion.hintText || '').trim()
        || 'El presentador no quiere dar pistas';

    renderCenteredNumericHint(hint);

    if (isNumericQuestionWithImage()) {
        removeProgressPanelOnly();
        return;
    }

    const playersData = getPlayersData() || {};
    const { progress } = getNumericProgressMetrics(playersData);

    const panel = ensurePanel();
    panel.style.bottom = '72px';
    alignPanelToLobbyMain(panel);

    panel.innerHTML = _tHtml(`
        <div style="background:linear-gradient(135deg, rgba(15,23,42,0.95), rgba(67,56,202,0.9));border:1px solid rgba(255,255,255,0.18);border-radius:18px;box-shadow:0 20px 45px rgba(0,0,0,0.35);padding:22px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <p style="margin:0;font-size:14px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#cbd5e1;">Progreso de respuestas</p>
                <p style="margin:0;font-size:14px;font-weight:900;color:#f8fafc;">${progress}% contestado</p>
            </div>
            <div style="height:24px;background:rgba(255,255,255,.16);border-radius:999px;overflow:hidden;">
                <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,#22c55e,#f59e0b);transition:width .25s ease;"></div>
            </div>
        </div>
    `);
}

export function startWaitingPanelSync() {
    if (resizeHandler) return;
    renderWaitingPanel();
    resizeHandler = () => renderWaitingPanel();
    window.addEventListener('resize', resizeHandler);
}

export function stopWaitingPanelSync() {
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
    }
    removePanel();
}

export { renderWaitingPanel };

export function hideWaitingPanelNow() {
    removePanel();
}
