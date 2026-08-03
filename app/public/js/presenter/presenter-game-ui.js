/**
 * @fileoverview UI del juego del presentador
 * Renderizado de preguntas, comentarios, timer, y QR
 */

import { getIsTeamMode, getTeamConfig, getTotalPlayers, getCurrentQuestionIndex, getTotalQuestions, getPlayersData } from './presenter-state.js?v=20260803120424';
import { adjustTextSize, adjustQuestionTitleSize, removeFloatingCards as removeCards, showAbandonButton, showTerminateButton } from './presenter-utils.js?v=20260803120424';
import { getTeamColorStyle } from './presenter-team-config.js?v=20260803120424';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260803120424';
import { renderWordScramblePresenter } from './presenter-wordscramble-layout.js?v=20260803120424';
import { showChamaleonOverlay } from './presenter-chamaleon.js?v=20260803120424';

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

    const openPlayerWindow = () => {
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
    // qrCanvas.onclick = openPlayerWindow;
    // qrLink.onclick = openPlayerWindow;

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

    const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];

    const tipoContenido = q.tipo_contenido || 'texto';
    const urlRecurso = q.url_recurso || null;
    const questionImageUrl = q.question_image_url || null;
    const tieneImagen = tipoContenido === 'imagen' && urlRecurso;
    const tieneAudio = tipoContenido === 'audio' && urlRecurso;
    const tieneImagenEnunciado = !tieneImagen && questionImageUrl;
    const esNumericaAproximacion = q.question_type === 'numeric_approximation';
    const esWordScramble = q.question_type === 'word_scramble';
    const esMultipleChoice = q.question_type === 'multiple_choice';

    const mostrarOpciones = !tieneImagen && !esNumericaAproximacion && !esWordScramble;

    const totalPlayers = Object.keys(getPlayersData()).length || getTotalPlayers();
    const lobbyMain = document.getElementById('lobby-main');
    lobbyMain.style.display = 'flex';
    lobbyMain.innerHTML = _tHtml(`
        <div class="h-full w-full flex flex-col">
            <div class="grid items-center mb-6" style="grid-template-columns: 1fr auto 1fr;">
                <div class="flex items-center gap-3 justify-self-start">
                    <img src="/images/minilogo.svg" class="w-16">
                </div>    
                <div class="flex items-center gap-3 justify-self-center">
                    <div id="timer" data-presenter-action="toggle-timer" class="w-16 h-16 rounded-full border-4 border-red-800 flex items-center justify-center text-3xl font-black italic cursor-pointer hover:scale-110 transition-all duration-200" title="Clic para pausar/reanudar">${q.time_limit || 20}</div>
                    <button id="btn-reveal-answer" data-presenter-action="reveal-answer" class="bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/35 rounded-2xl px-5 py-3 font-black text-white uppercase tracking-wide transition shadow-xl">
                        ${_t('presenter.game.reveal_answer', null, 'Revelar respuesta')}
                    </button>
                </div>
                <div class="text-2xl font-black italic text-red-800 justify-self-end" style="margin-right: 7rem;">${_t('presenter.game.answers_label', null, 'RESPUESTAS:')} <span id="ans-count">0</span> / <span id="ans-total">${totalPlayers}</span></div>
            </div>
            
            <h1 id="question-title" class="font-black text-center uppercase italic mb-${tieneImagen && !esWordScramble ? '4' : '8'} drop-shadow-lg" style="line-height: 1.2;">${q.question_text}</h1>
            
            ${esMultipleChoice ? `
                <div class="flex justify-center mb-4">
                    <div class="bg-purple-600 text-white px-6 py-2 rounded-full font-bold text-lg uppercase tracking-wide shadow-lg border-2 border-white/30">
                        ${_t('presenter.game.multiple_choice_label', null, '✓ Selección Múltiple')}
                    </div>
                </div>
            ` : ''}
            
            ${tieneImagen && !esWordScramble ? `
                <div class="flex-1 flex items-center justify-center mb-6 px-6">
                    <img src="${urlRecurso}" alt="Pregunta" class="max-w-full max-h-full object-contain rounded-3xl shadow-2xl" style="max-height: calc(100vh - 300px);">
                </div>
            ` : tieneAudio ? `
                <div class="flex justify-center mb-6">
                    <div class="bg-purple-600/20 backdrop-blur-lg rounded-3xl p-8 border-2 border-red-800 shadow-2xl">
                        <div class="flex items-center gap-4 mb-4">
                            <i class="fas fa-volume-up text-6xl text-purple-400"></i>
                            <div class="text-white">
                                <p class="text-2xl font-black italic">${_t('presenter.game.audio_playing', null, 'AUDIO EN REPRODUCCIÓN')}</p>
                                <p class="text-sm text-purple-300">${_t('presenter.game.listen_carefully', null, 'Escucha atentamente')}</p>
                            </div>
                        </div>
                        <audio id="question-audio" autoplay controls class="w-full">
                            <source src="${urlRecurso}" type="audio/mpeg">
                            ${_t('presenter.game.no_audio_support', null, 'Tu navegador no soporta audio.')}
                        </audio>
                    </div>
                </div>
            ` : ''}
            
            ${tieneImagenEnunciado ? `
                <div class="flex justify-center mb-4">
                    <img src="${questionImageUrl}" alt="Imagen enunciado" class="max-h-52 object-contain rounded-2xl shadow-xl border-2 border-white/20">
                </div>
            ` : ''}
            
            <div id="options-grid" class="grid grid-cols-2 gap-4 flex-1 pb-14 ${!mostrarOpciones ? 'hidden' : ''}" style="grid-auto-rows: minmax(0, 1fr); min-height: 0;">
                ${q.options.map((opt, i) => `
                    <div id="opt-${i}" class="${colors[i]} relative rounded-[30px] p-6 flex items-center shadow-2xl border-b-8 border-black/20 h-full transition-all duration-500">
                        <span class="bg-black/20 w-16 h-16 rounded-xl flex items-center justify-center text-4xl font-black mr-6 border-2 border-white/20 italic text-white">${i + 1}</span>
                        ${opt.option_image_url ? `<img src="${opt.option_image_url}" alt="" class="max-h-[120px] max-w-[120px] object-contain rounded-xl mr-3 shrink-0">` : ''}
                        <span class="option-text font-black uppercase text-white break-words" style="flex: 1; overflow-wrap: break-word; hyphens: auto; line-height: 1.1;">${opt.optionText}</span>
                    </div>
                `).join('')}
            </div>
            
            ${esNumericaAproximacion && !tieneImagen ? `
                <div class="flex-1 pb-6 flex items-center justify-center">
                    <div class="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-lg rounded-3xl p-12 border-2 border-green-500 shadow-2xl text-center">
                        <div class="text-6xl mb-4">🔢</div>
                        <p class="text-2xl font-black italic text-green-400 mb-2">${_t('presenter.game.numeric_question', null, 'PREGUNTA NUMÉRICA')}</p>
                        <p class="text-xl text-white/80 mb-4">${_t('presenter.game.players_write_number', null, 'Los jugadores escriben un número entero')}</p>
                        <div class="mt-6 pt-6 border-t border-green-500/30">
                            <p class="text-sm text-white/70 mb-2">${_t('presenter.game.answer_on_reveal', null, 'La respuesta correcta se mostrará al revelar')}</p>
                            <p class="text-xs text-white/50 mt-2">${_t('presenter.game.points_by_proximity', null, 'Los puntos se calculan según proximidad')}</p>
                        </div>
                    </div>
                </div>
            ` : esWordScramble ? renderWordScramblePresenter(q) : !mostrarOpciones ? `
                <div class="pb-14 text-center">
                    <p class="text-white/60 text-2xl italic">
                        <i class="fas fa-mobile-alt mr-2"></i>
                        ${_t('presenter.game.players_see_devices', null, 'Los jugadores ven las opciones en sus dispositivos')}
                    </p>
                </div>
            ` : ''}
            
            <button id="btn-next" data-presenter-action="next-question" class="hidden fixed bottom-10 right-10 bg-white text-slate-900 px-10 py-5 rounded-3xl font-black text-2xl shadow-2xl hover:bg-purple-600 hover:text-white transition italic uppercase" style="z-index: 10000;">
                ${window.isTrivialGame ? _t('presenter.game.next_round', null, 'Siguiente Ronda') : (getCurrentQuestionIndex() >= getTotalQuestions() - 1 ? _t('presenter.game.view_ranking', null, 'Ver Ránking') : _t('presenter.game.next_question', null, 'Siguiente Pregunta'))}
                <i class="fas ${window.isTrivialGame ? 'fa-rotate-right' : (getCurrentQuestionIndex() >= getTotalQuestions() - 1 ? 'fa-trophy' : 'fa-chevron-right')} ml-2"></i>
            </button>
        </div>`);

    adjustQuestionTitleSize();
    if (mostrarOpciones) adjustTextSize();

    // Forzar reproducción cuando el autoplay del atributo HTML falla por falta de gesto
    // (ocurre cuando el control remoto avanza la pregunta sin interacción en el presentador)
    if (tieneAudio) {
        const audioEl = document.getElementById('question-audio');
        if (audioEl) {
            audioEl.play().catch(() => {
                const container = audioEl.closest('div');
                if (!container || container.querySelector('.audio-play-btn')) return;
                const btn = document.createElement('button');
                btn.className = 'audio-play-btn';
                btn.style.cssText = 'display:block;width:100%;margin-top:1rem;padding:0.75rem;background:#7c3aed;color:#fff;border:none;border-radius:0.75rem;font-size:1.25rem;font-weight:900;cursor:pointer;';
                btn.textContent = _t('presenter.game.play_audio', null, '▶ Toca para reproducir el audio');
                btn.onclick = () => { audioEl.play(); btn.remove(); };
                container.appendChild(btn);
            });
        }
    }

    // Mostrar el botón de abandonar y el de terminar
    showAbandonButton();
    showTerminateButton();

    // CRÍTICO: Limpiar intervalo ANTES de resetear variables
    clearInterval(window.timerInterval);
    window.timerInterval = null;
    window.timerPaused = false;
    window.currentSeconds = q.time_limit || 20;

    const overlay = document.getElementById('countdown-overlay');
    const bigNumber = document.getElementById('big-number');

    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.classList.remove('border-yellow-500', 'bg-yellow-500/20');
        timerEl.classList.add('border-red-800');
        timerEl.innerText = _t(window.currentSeconds);
    }

    window.timerInterval = setInterval(() => {
        if (window.timerPaused) return;

        window.currentSeconds--;
        if (document.getElementById('timer')) document.getElementById('timer').innerText = _t(window.currentSeconds);

        // Los 5 segundos finales
        if (window.currentSeconds <= 5 && window.currentSeconds > 0) {
            overlay.classList.remove('hidden');
            bigNumber.innerText = _t(window.currentSeconds);
            bigNumber.classList.remove('count-anim');
            void bigNumber.offsetWidth;
            bigNumber.classList.add('count-anim');

            const tickSound = document.getElementById('tick-sound');
            if (tickSound) {
                tickSound.currentTime = 0;
                tickSound.play().catch(() => { });
            }
        }

        if (window.currentSeconds <= 0) {
            clearInterval(window.timerInterval);
            overlay.classList.add('hidden');
        }
    }, 1000);
}

/**
 * Re-exportar funciones de otros módulos
 */
export { renderTeamLobby, updatePlayersPanel } from './presenter-players-panel.js?v=20260803120424';
export { renderCommentSlide, renderInfoSlide, renderTextSlide, renderImageSlide, renderTextImageSlide } from './presenter-slides.js?v=20260803120424';
export { renderPodio } from './presenter-podio.js?v=20260803120424';
