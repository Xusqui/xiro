/**
 * @fileoverview UI del juego del presentador
 * Renderizado de preguntas, comentarios, timer, y QR
 */

import { getTotalPlayers, getPlayersData } from './presenter-state.js?v=20260922172926';
import { adjustTextSize, adjustQuestionTitleSize, removeFloatingCards as removeCards, showAbandonButton, showTerminateButton } from './presenter-utils.js?v=20260922172926';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260922172926';
import { showChamaleonOverlay } from './presenter-chamaleon.js?v=20260922172926';
import { describeQuestion, questionHtml } from './presenter-question-view.js?v=20260922172926';
import { fitMatchingText } from './presenter-matching-layout.js?v=20260922172926';
import { ensureQuestionAudioPlays, startQuestionCountdown } from './presenter-question-timer.js?v=20260922172926';

export { removeCards as removeFloatingCards };

/**
 * Mostrar código QR del juego
 */
export function mostrarQR(sessionIdParam) {
    if (!sessionIdParam) return;
    const baseUrl = window.location.protocol + '//' + window.location.host;
    const url = `${baseUrl}/jugador.html?session=${encodeURIComponent(sessionIdParam)}`;

    const qrCanvas = document.getElementById('qr-canvas');
    const qrLink = document.getElementById('qr-link');

    // Acceso sin QR: misma página que el QR (dominio al vuelo, nada fijo) y
    // el ID de sesión que se escribe en ella
    const joinHost = document.getElementById('join-host');
    if (joinHost) joinHost.textContent = `${window.location.host}/jugador.html`;
    const joinSession = document.getElementById('join-session');
    if (joinSession) joinSession.textContent = sessionIdParam;

    // Resolución interna fija (calidad). El tamaño visible lo controla CSS.
    const qrResolution = 800;

    qrCanvas.innerHTML = _tHtml('');

    const qr = new QRCodeStyling({
        width: qrResolution,
        height: qrResolution,
        data: url,
        image: '/images/minilogo.svg',
        margin: 0,
        dotsOptions: {
            color: '#85362c',
            type: 'rounded'
        },
        backgroundOptions: {
            color: '#ffffff'
        },
        imageOptions: {
            crossOrigin: 'anonymous',
            margin: 4,
            imageSize: 0.22
        },
        cornersSquareOptions: {
            color: '#38c015',
            type: 'extra-rounded'
        },
        cornersDotOptions: {
            color: '#38c015',
            type: 'dot'
        }
    });

    // Intentar generar SVG, con fallback a canvas
    qr.getRawData('svg')
        .then((svgBlob) => svgBlob.text())
        .then((svgMarkup) => {
            qrCanvas.innerHTML = _tHtml(svgMarkup);
            const svgElement = qrCanvas.querySelector('svg');
            if (svgElement) {
                svgElement.style.width = '100%';
                svgElement.style.height = '100%';
                svgElement.style.display = 'block';
            }
        })
        .catch(() => {
            // Fallback a canvas si SVG falla
            qrCanvas.innerHTML = _tHtml('');
            qr.append(qrCanvas);
        });

    // [DISABLED] Efecto hover - comentado para facilitar re-activación
    // qrCanvas.style.cursor = 'pointer';
    // qrLink.style.cursor = 'pointer';

    const _openPlayerWindow = () => {
        const width = 430;
        const height = 932;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        window.open(
            url,
            '_blank',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
        console.log('🔗 Abriendo jugador en ventana popup:', url);
    };

    // [DISABLED] Abrir ventana popup del jugador - comentado para facilitar re-activación
    // qrCanvas.onclick = _openPlayerWindow;
    // qrLink.onclick = _openPlayerWindow;

    qrLink.innerText = _t(url);
    console.log('📱 QR generado con URL:', url);
}

/**
 * Renderizar pregunta normal
 */
export function renderPregunta(q) {
    removeCards();
    cleanupRevealElements();
    showChamaleonOverlay();

    window.currentSlideType = q?.slide_type || 'question';
    window.currentQuestionType = q?.question_type || null;
    window.currentQuestion = q; // Guardar para reveal-answer

    const view = describeQuestion(q);
    const totalPlayers = Object.keys(getPlayersData()).length || getTotalPlayers();
    const lobbyMain = document.getElementById('lobby-main');
    lobbyMain.style.display = 'flex';
    lobbyMain.innerHTML = _tHtml(questionHtml(q, view, totalPlayers));

    adjustQuestionTitleSize();
    if (view.mostrarOpciones) adjustTextSize();
    if (view.esMatching) fitMatchingText();
    if (view.tieneAudio) ensureQuestionAudioPlays();

    // Mostrar el botón de abandonar y el de terminar
    showAbandonButton();
    showTerminateButton();

    startQuestionCountdown(q.time_limit || 20);
}

/**
 * Re-exportar funciones de otros módulos
 */
export { renderTeamLobby, updatePlayersPanel } from './presenter-players-panel.js?v=20260922172926';
export { renderCommentSlide, renderInfoSlide, renderTextSlide, renderImageSlide, renderTextImageSlide } from './presenter-slides.js?v=20260922172926';
export { renderPodio } from './presenter-podio.js?v=20260922172926';
