window.TVApp = window.TVApp || {};
window.TVApp.RenderQuestion = (function () {
    'use strict';

    const getEl = window.TVApp.Utils.getEl;
    const clearCache = window.TVApp.Utils.clearCache;
    const escapeHtml = window.TVApp.Utils.escapeHtml;
    const playQuestionAudio = window.TVApp.Audio.playQuestionAudio;
    const playTick = window.TVApp.Audio.playTick;

    function countdownLoop() {
        const state = window.TVApp.State;
        if (state.timerPaused) {
            state.rafHandle = requestAnimationFrame(countdownLoop);
            return;
        }

        const now = Date.now();
        const elapsed = now - state.lastTimerUpdate;

        // Solo actualizar cada 1000ms
        if (elapsed >= 1000) {
            state.currentSeconds--;
            state.lastTimerUpdate = now;
            state.isDirty = true;

            const timerEl = getEl('timer');
            if (timerEl) timerEl.textContent = _t(state.currentSeconds);

            const overlay = getEl('countdown-overlay');
            const bigNumber = getEl('countdown-number');

            if (state.currentSeconds <= 5 && state.currentSeconds > 0 && overlay && bigNumber) {
                overlay.classList.remove('hidden');
                bigNumber.textContent = _t(state.currentSeconds);
                playTick();
            }

            if (state.currentSeconds <= 0) {
                if (overlay) overlay.classList.add('hidden');
                cancelAnimationFrame(state.rafHandle);
                state.rafHandle = null;
                return;
            }
        }

        state.rafHandle = requestAnimationFrame(countdownLoop);
    }

    function renderPregunta(q) {
        const state = window.TVApp.State;
        state.currentQuestion = q;
        const colors = ['option-red', 'option-blue', 'option-yellow', 'option-green', 'option-purple', 'option-pink'];
        const tipoContenido = q.tipo_contenido || 'texto';
        const urlRecurso = q.url_recurso || null;
        const tieneImagen = tipoContenido === 'imagen' && urlRecurso;
        const tieneAudio = tipoContenido === 'audio' && urlRecurso;
        const esNumericaAproximacion = q.question_type === 'numeric_approximation';
        const esWordScramble = q.question_type === 'word_scramble';
        const mostrarOpciones = !tieneImagen && !esNumericaAproximacion && !esWordScramble;

        let optionsHTML = '';
        if (mostrarOpciones) {
            for (let i = 0; i < q.options.length; i++) {
                const opt = q.options[i];
                optionsHTML += '<div id="opt-' + i + '" class="option ' + colors[i] + '"><span class="option-number">' + (i + 1) + '</span><span>' + escapeHtml(opt.optionText) + '</span></div>';
            }
        }

        let multimediaHTML = '';
        if (tieneImagen) {
            multimediaHTML = '<div style="display:flex;align-items:center;justify-content:center;margin:20px 0;max-height:500px"><img src="' + urlRecurso + '" alt="Pregunta" style="max-width:100%;max-height:500px;object-fit:contain;border-radius:15px"></div>';
        } else if (tieneAudio) {
            multimediaHTML = '<div style="background-color:rgba(8,145,178,0.2);padding:20px;border-radius:15px;margin:20px 0;border:2px solid #0891b2"><div style="text-align:center;margin-bottom:15px"><span style="font-size:48px">🔊</span><p style="font-size:20px;font-weight:bold;margin:10px 0">AUDIO EN REPRODUCCIÓN</p><p style="font-size:14px;color:#a5f3fc">Escucha atentamente</p></div><audio id="question-audio-player" controls style="width:100%;max-width:500px;margin:0 auto;display:block"><source src="' + urlRecurso + '" type="audio/mpeg"><source src="' + urlRecurso + '" type="audio/wav"><source src="' + urlRecurso + '" type="audio/ogg">Tu navegador no soporta audio.</audio></div>';
            setTimeout(function () { playQuestionAudio(urlRecurso); }, 200);
        }

        const questionTimeLimit = q.time_limit || 30;
        let answerAreaHTML = '';
        if (esNumericaAproximacion) {
            if (!tieneImagen) {
                const hintText = q.hint_text || q.hint || q.hintText || '';
                let hintHTML = '';
                if (hintText && String(hintText).trim() !== '') {
                    hintHTML = '<div style="margin-top:14px;padding:12px 14px;background:rgba(15,23,42,0.45);border:1px solid rgba(16,185,129,0.35);border-radius:10px;text-align:left;max-width:800px;margin-left:auto;margin-right:auto"><div style="font-size:12px;color:#a7f3d0;font-weight:bold;margin-bottom:6px">💡 Pista</div><div style="font-size:14px;color:#e2e8f0;line-height:1.35">' + escapeHtml(hintText) + '</div></div>';
                }
                answerAreaHTML = '<div id="numeric-placeholder" style="text-align:center;padding:40px 20px;background:rgba(16,185,129,0.1);border-radius:15px;margin:20px 0;border:2px solid #10b981"><div style="font-size:18px;color:#a5f3fc;font-weight:bold;margin-bottom:10px">📝 RESPUESTA NUMÉRICA</div><div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:15px">Los jugadores escriben un número entero</div><div style="font-size:20px;font-weight:bold;color:#10b981">La respuesta correcta se mostrará al revelar</div><div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:10px">Puntos máximos: ' + (q.max_points || 0) + '</div>' + hintHTML + '</div>';
            }
        } else if (esWordScramble) {
            if (!tieneImagen) {
                const wordLength = q.word_length || (q.correct_word ? String(q.correct_word).length : 7);
                let emptyBoxes = '';
                for (let b = 0; b < wordLength; b++) {
                    emptyBoxes += '<div style="display:inline-flex;align-items:center;justify-content:center;width:2.5rem;height:2.5rem;border:2px solid #fbbf24;border-radius:0.5rem;font-size:1.2rem;font-weight:900;color:#fde68a;background:rgba(30,41,59,0.7);margin:2px"></div>';
                }
                answerAreaHTML = '<div id="word-scramble-placeholder" style="text-align:center;padding:30px 20px;background:rgba(245,158,11,0.1);border-radius:15px;margin:20px 0;border:2px solid #f59e0b"><div style="font-size:18px;color:#fbbf24;font-weight:bold;margin-bottom:10px">🔤 ANAGRAMA</div><div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:15px">Palabra de <strong style="color:#fde68a">' + wordLength + '</strong> letras</div><div style="display:flex;flex-wrap:wrap;justify-content:center;margin:15px 0" id="ws-tv-boxes">' + emptyBoxes + '</div><div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:10px">La respuesta correcta se mostrará al revelar</div></div>';
            }
        } else {
            answerAreaHTML = (mostrarOpciones ? '<div class="options-grid" id="options-grid">' + optionsHTML + '</div>' : '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.6);font-style:italic;font-size:18px">📱 Los jugadores ven las opciones en sus dispositivos</div>');
        }

        const isTrivial = window.isTrivialGame;
        const isLast = state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1;
        const nxtText = (isLast && !isTrivial) ? 'Ver Ránking ★' : 'Siguiente →';
        const mainHtml = '<div class="question-container"><div class="question-header"><table><tr><td style="width:150px"><img src="/images/logo.svg" style="max-width:100px"></td><td style="text-align:center"><div class="timer" id="timer" data-tv-action="toggle-pause-timer" style="cursor:pointer" title="Clic para pausar/reanudar">' + questionTimeLimit + '</div></td><td style="text-align:right;font-size:18px;font-weight:bold">RESPUESTAS: <span id="ans-count">0</span> / <span id="ans-total">' + state.totalPlayers + '</span></td></tr></table></div><div class="question-text">' + escapeHtml(q.question_text) + '</div>' + multimediaHTML + answerAreaHTML + '<button id="btn-next" data-tv-action="next-question" class="btn btn-secondary btn-next hidden">' + nxtText + '</button></div>';

        getEl('main-container').innerHTML = _tHtml(mainHtml);
        clearCache();

        state.currentSeconds = questionTimeLimit;
        state.timerPaused = false;

        window.TVApp.RenderSlides.resetTimers(); // Detiene cualquier timer previo

        state.lastTimerUpdate = Date.now();
        state.isDirty = true;
        state.rafHandle = requestAnimationFrame(countdownLoop);
    }

    return {
        renderPregunta: renderPregunta
    };
})();
