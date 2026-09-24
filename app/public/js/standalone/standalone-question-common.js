/**
 * @fileoverview Helpers compartidos por los renderizadores de pregunta de Standalone
 */

'use strict';

globalThis.StandaloneQuestionCommon = (() => {
    let timerIntervalId = null;

    /**
     * Detiene la cuenta atrás visual en curso, si la hay. Debe llamarse antes
     * de renderizar una reveal/resultados o al terminar la partida, para no
     * dejar un setInterval huérfano actualizando un nodo ya descartado.
     */
    function clearQuestionTimer() {
        if (timerIntervalId) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
        }
    }

    /**
     * Pinta un reloj con cuenta atrás (misma estética que el timer circular
     * del presentador, ver presenter-game-ui.js), justo debajo de la barra
     * morada del nickname — igual que lo vería el presentador en su pantalla,
     * ya que en Standalone no hay una pantalla separada para eso. Es
     * puramente visual: el servidor es quien decide cuándo revelar la
     * respuesta al agotarse question.time_limit (ver TimerManager.startTimer).
     * @param {HTMLElement} container
     * @param {number} timeLimit - segundos
     */
    function startQuestionTimer(container, timeLimit) {
        clearQuestionTimer();
        if (typeof timeLimit !== 'number' || timeLimit <= 0) return;

        let seconds = Math.round(timeLimit);
        const el = document.createElement('div');
        el.id = 'standalone-question-timer';
        el.className = 'mx-auto mt-3 mb-1 w-16 h-16 shrink-0 rounded-full border-4 border-red-800 bg-black/40 flex items-center justify-center text-3xl font-black italic text-white shadow-lg';
        el.textContent = String(seconds);

        const nicknameBar = container.querySelector('.pl-nickname-bar');
        if (nicknameBar) {
            nicknameBar.after(el);
        } else {
            container.appendChild(el);
        }

        timerIntervalId = setInterval(() => {
            seconds -= 1;

            if (seconds <= 0) {
                el.textContent = '0';
                clearQuestionTimer();
                return;
            }

            el.textContent = String(seconds);
            if (seconds <= 5) {
                el.classList.remove('border-red-800');
                el.classList.add('border-yellow-500', 'bg-yellow-500/20');
            }
        }, 1000);
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            '\'': '&#039;'
        };
        return String(text ?? '').replace(/[&<>"']/g, m => map[m]);
    }

    function generateRequestId() {
        return `standalone_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function lockAnswering(container) {
        if (!container) return;
        container.querySelectorAll('[data-standalone-answer]').forEach(el => {
            el.disabled = true;
            el.classList.add('is-locked');
        });
    }

    function optionText(option) {
        return option?.optionText || option?.text || option?.option_text || '';
    }

    /**
     * Construye el bloque multimedia de una pregunta (imagen o audio incrustado)
     * más la imagen pequeña de enunciado, igual que player-quiz-ui.js /
     * player-multiplechoice-ui.js. A diferencia del jugador real (que solo
     * avisa "audio en pantalla principal" porque el presentador es quien lo
     * reproduce), en Standalone no hay una pantalla separada — así que el
     * audio SÍ debe sonar aquí, igual que en presenter-game-ui.js.
     */
    function buildQuestionMedia(question) {
        const tipoContenido = question.tipo_contenido || 'texto';
        const urlRecurso = question.url_recurso || null;
        const questionImageUrl = question.question_image_url || null;
        const tieneImagen = tipoContenido === 'imagen' && !!urlRecurso;
        const tieneAudio = tipoContenido === 'audio' && !!urlRecurso;
        const tieneImagenEnunciado = !tieneImagen && !!questionImageUrl;

        let mediaBlock = '';
        if (tieneImagen) {
            mediaBlock = `<div class="pl-question-media"><img src="${escapeHtml(urlRecurso)}" alt="" class="pl-question-media-img"></div>`;
        } else if (tieneAudio) {
            mediaBlock = `
                <div class="pl-question-media pl-audio-card">
                    <i class="fas fa-volume-up"></i>
                    <audio id="standalone-question-audio" autoplay controls>
                        <source src="${escapeHtml(urlRecurso)}" type="audio/mpeg">
                    </audio>
                </div>
            `;
        }

        const statementImageHtml = tieneImagenEnunciado
            ? `<img src="${escapeHtml(questionImageUrl)}" alt="" class="pl-question-statement-img">`
            : '';

        return { mediaBlock, statementImageHtml, hasAudio: tieneAudio };
    }

    /**
     * Fuerza la reproducción del audio de la pregunta (el atributo autoplay
     * puede ser bloqueado por el navegador sin gesto previo del usuario);
     * si falla, añade un botón para reproducirlo manualmente — igual que
     * presenter-game-ui.js.
     */
    function wireQuestionAudio(container) {
        const audioEl = container.querySelector('#standalone-question-audio');
        if (!audioEl) return;

        audioEl.play().catch(() => {
            const wrapper = container.querySelector('.pl-audio-card');
            if (!wrapper || wrapper.querySelector('.pl-audio-play-btn')) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pl-audio-play-btn';
            btn.textContent = window.XiroI18n?.t('standalone.game.play_audio') || '▶ Toca para reproducir el audio';
            btn.addEventListener('click', () => {
                audioEl.play();
                btn.remove();
            });
            wrapper.appendChild(btn);
        });
    }

    /**
     * Construye el payload común (pin/sessionId/nickname/requestId) y envía la
     * respuesta vía StandaloneSocket. `typeFields` aporta las claves propias
     * del tipo de pregunta (index/order/matches/playerAnswer/selectedIndices).
     * @returns {Promise<Object>} ack del servidor
     */
    async function submitAnswer(typeFields, answerType) {
        const state = StandaloneState.get();
        state.answered = true;

        const payload = {
            pin: state.pin,
            sessionId: state.sessionId,
            nickname: state.nickname,
            requestId: generateRequestId(),
            ...(answerType ? { answerType } : {}),
            ...typeFields
        };

        return StandaloneSocket.submitAnswer(payload);
    }

    return {
        escapeHtml,
        generateRequestId,
        lockAnswering,
        optionText,
        submitAnswer,
        buildQuestionMedia,
        wireQuestionAudio,
        startQuestionTimer,
        clearQuestionTimer
    };
})();
