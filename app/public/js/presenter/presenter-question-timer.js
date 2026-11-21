/**
 * @fileoverview Cuenta atrás de la pregunta y arranque del audio en el presentador. La cuenta atrás
 * es la fuente de verdad del temporizador informativo del móvil (presenter-timer-sync.js).
 */

import { publishTimerAnchor, RESYNC_EVERY_TICKS } from './presenter-timer-sync.js?v=20261121180000';

// Cuenta en curso: tiempo total y desde cuándo se enseña el número actual (fase del setInterval)
let countdownTotal = 0;
let shownSince = 0;

/** Publica para los móviles lo que enseña ahora la cuenta atrás (también al pausar y reanudar). */
export function publishCurrentCountdown() {
    if (!countdownTotal) return;
    publishTimerAnchor({
        value: window.currentSeconds,
        total: countdownTotal,
        shownSince,
        paused: Boolean(window.timerPaused)
    });
}

/**
 * Reproduce el audio de la pregunta; si el autoplay falla por falta de gesto del
 * usuario, añade un botón para reproducirlo a mano.
 */
export function ensureQuestionAudioPlays() {
    // El autoplay del atributo HTML falla por falta de gesto cuando el control
    // remoto avanza la pregunta sin interacción en el presentador
    const audioEl = document.getElementById('question-audio');
    if (!audioEl) return;

    audioEl.play().catch(() => {
        const container = audioEl.closest('div');
        if (!container || container.querySelector('.audio-play-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'audio-play-btn';
        btn.style.cssText =
            'display:block;width:100%;margin-top:1rem;padding:0.75rem;background:#94438e;color:#fff;border:none;border-radius:0.75rem;font-size:1.25rem;font-weight:900;cursor:pointer;';
        btn.textContent = _t('presenter.game.play_audio', null, '▶ Toca para reproducir el audio');
        btn.onclick = () => {
            audioEl.play();
            btn.remove();
        };
        container.appendChild(btn);
    });
}

/**
 * Reinicia la cuenta atrás de la pregunta (overlay de los 5 últimos segundos incluido).
 * @param {number} seconds - Segundos que quedan
 * @param {number} [total=seconds] - Tiempo de la pregunta (al reconectar quedan menos que el total)
 */
export function startQuestionCountdown(seconds, total = seconds) {
    // CRÍTICO: Limpiar intervalo ANTES de resetear variables
    clearInterval(window.timerInterval);
    window.timerInterval = null;
    window.timerPaused = false;
    window.currentSeconds = seconds;
    countdownTotal = Math.max(seconds, total);
    shownSince = Date.now();
    publishCurrentCountdown();

    const overlay = document.getElementById('countdown-overlay');
    const bigNumber = document.getElementById('big-number');

    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.classList.remove('border-yellow-500', 'bg-yellow-500/20');
        timerEl.classList.add('border-red-800');
        timerEl.innerText = _t(window.currentSeconds);
    }

    let ticks = 0;
    window.timerInterval = setInterval(() => {
        // También en pausa: al reanudar, el siguiente segundo cae en este mismo compás
        shownSince = Date.now();
        if (window.timerPaused) return;

        window.currentSeconds--;
        ticks++;
        if (ticks % RESYNC_EVERY_TICKS === 0 && window.currentSeconds > 0) publishCurrentCountdown();
        if (document.getElementById('timer')) document.getElementById('timer').innerText = _t(window.currentSeconds);

        // Los 5 segundos finales
        if (window.currentSeconds <= 5 && window.currentSeconds > 0) {
            overlay.classList.remove('hidden');
            bigNumber.innerText = _t(window.currentSeconds);
            bigNumber.classList.remove('count-anim');
            void bigNumber.offsetWidth;
            bigNumber.classList.add('count-anim');

            // Con la música sonando, el tic-tac final lo pone ella (bloque de madera)
            const tickSound = window.XiroPresenterMusic?.isPlaying() ? null : document.getElementById('tick-sound');
            if (tickSound) {
                tickSound.currentTime = 0;
                tickSound.play().catch(() => {});
            }
        }

        if (window.currentSeconds <= 0) {
            clearInterval(window.timerInterval);
            overlay.classList.add('hidden');
        }
    }, 1000);
}
