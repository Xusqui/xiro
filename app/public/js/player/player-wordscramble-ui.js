/**
 * @fileoverview Renderizado de preguntas tipo word_scramble
 * Muestra letras mezcladas y casillas para descifrar la palabra
 */

import {
    getNickname,
    setHaRespondido,
    setCanAnswer,
    setCurrentSlideType
} from './player-state.js?v=20260628203632';
import { enviarRespuestaWordScramble } from './player-answer.js?v=20260628203632';
import { getResponsiveFontClass } from './player-question-utils.js?v=20260628203632';
import { setBodyHTML } from './player-streak-ui.js?v=20260628203632';

let wsFilledLetters = [];
let wsUsedIndices = new Set();

/**
 * Devuelve la palabra actualmente formada por el jugador
 */
export function getWordScrambleAnswer() {
    return wsFilledLetters.join('');
}

/**
 * Renderiza la interfaz de pregunta tipo word_scramble
 */
export function renderizarPreguntaWordScramble(pregunta) {
    wsFilledLetters = [];
    wsUsedIndices = new Set();
    window._wsAnswer = '';
    setHaRespondido(false);
    setCanAnswer(true);
    setCurrentSlideType('question');

    const wordLength = pregunta.word_length || 7;
    const letters = pregunta.scrambled_letters || [];
    const preguntaFontClass = getResponsiveFontClass(pregunta.question_text);

    const tipoContenido = pregunta.tipo_contenido || 'texto';
    const urlRecurso = pregunta.url_recurso || null;
    const tieneImagen = tipoContenido === 'imagen' && urlRecurso;
    const tieneAudio = tipoContenido === 'audio' && urlRecurso;

    let multimediaHTML = '';
    if (tieneImagen) {
        multimediaHTML = `
            <div class="bg-slate-800 px-2 py-2 flex items-center justify-center shrink-0" style="max-height: 25vh;">
                <img src="${urlRecurso}" alt="Imagen" class="max-w-full max-h-full object-contain rounded-lg shadow-lg">
            </div>`;
    } else if (tieneAudio) {
        multimediaHTML = `
            <div class="bg-purple-800/40 px-3 py-2 flex items-center justify-center shrink-0">
                <p class="text-white/70 text-xs italic flex items-center gap-2">
                    <i class="fas fa-volume-mute"></i>
                    ${_t('player.common.audio_main_screen', null, 'Audio solo en pantalla principal')}
                </p>
            </div>`;
    }

    const emptyBoxes = Array.from({ length: wordLength }, (_, i) =>
        `<div id="ws-box-${i}" class="ws-box border-2 border-purple-400 rounded-lg flex items-center justify-center font-black text-purple-200 bg-slate-800/70 transition-all duration-200"
            style="width:100%; aspect-ratio:1/1; font-size: clamp(0.85rem, 3.5vw, 1.5rem);"
        ></div>`
    ).join('');

    // Una sola fila de 10 letras al 90% del ancho de pantalla
    const letterButtons = letters.map((letter, i) =>
        `<button id="ws-letter-${i}" data-idx="${i}" data-letter="${letter}"
            class="ws-letter bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black rounded-xl shadow-md transition-all duration-150 border-b-4 border-purple-800"
            style="width:100%; aspect-ratio:1/1; font-size: clamp(0.85rem, 3.5vw, 1.5rem);"
        >${letter}</button>`
    ).join('');

    setBodyHTML(`
        <div class="h-dvh w-screen flex flex-col bg-slate-900 overflow-hidden">
            <!-- Header -->
            <div class="bg-purple-600 px-3 py-2 text-center shrink-0">
                <p class="text-white font-black text-base uppercase">${getNickname()}</p>
            </div>

            ${multimediaHTML}

            <!-- Definición (texto de pregunta) -->
            <div class="bg-white p-4 border-b-8 border-purple-600 text-slate-800 text-center ${tieneImagen ? 'min-h-[8vh] max-h-[12vh]' : 'min-h-[12vh] max-h-[22vh]'} flex items-center justify-center shrink-0 overflow-y-auto">
                <h2 class="${preguntaFontClass} font-black uppercase italic hyphens-auto" lang="es">${pregunta.question_text}</h2>
            </div>

            <!-- Área principal -->
            <div class="flex-1 flex flex-col items-center justify-around px-4 py-2 overflow-hidden">
                <!-- Etiqueta longitud -->
                <p class="font-black uppercase tracking-widest text-cyan-300" style="font-size: clamp(1.2rem, 5vw, 2rem);">
                    ${_t('player.wordscramble.word_length_pre', null, 'PALABRA DE')} <span class="text-yellow-300">${wordLength}</span> ${_t('player.wordscramble.word_length_post', null, 'LETRAS')}
                </p>

                <!-- Casillas vacías -->
                <div id="ws-boxes"
                    style="
                        display: grid;
                        grid-template-columns: repeat(${wordLength}, 1fr);
                        gap: clamp(2px, 1vw, 6px);
                        width: 90vw;
                    ">
                    ${emptyBoxes}
                </div>

                <!-- Letras mezcladas: 1 fila de 10 al 90% del ancho -->
                <div id="ws-letters"
                    style="
                        display: grid;
                        grid-template-columns: repeat(10, 1fr);
                        gap: clamp(2px, 1vw, 6px);
                        width: 90vw;
                    ">
                    ${letterButtons}
                </div>
            </div>

            <!-- Botones Reset + Enviar -->
            <div class="p-3 bg-slate-900/60 border-t border-white/10 flex gap-3">
                <button id="ws-reset" class="flex-1 bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-black uppercase text-base shadow-lg transition active:scale-95">
                    <i class="fas fa-undo mr-2"></i>${_t('player.wordscramble.reset', null, 'Borrar')}
                </button>
                <button id="ws-submit" class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-base shadow-lg transition active:scale-95">
                    <i class="fas fa-paper-plane mr-2"></i>${_t('player.wordscramble.submit', null, 'Enviar')}
                </button>
            </div>
        </div>
    `);

    // Letter click: fills the next available box
    document.querySelectorAll('.ws-letter').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const letter = btn.dataset.letter;
            if (wsUsedIndices.has(idx)) return;
            if (wsFilledLetters.length >= wordLength) return;

            wsFilledLetters.push(letter);
            wsUsedIndices.add(idx);
            btn.classList.add('opacity-30', 'pointer-events-none');

            const boxEl = document.getElementById(`ws-box-${wsFilledLetters.length - 1}`);
            if (boxEl) {
                boxEl.textContent = _t(letter);
                boxEl.classList.add('border-purple-300', 'text-white');
            }
            window._wsAnswer = wsFilledLetters.join('');
        });
    });

    // Reset click: clears all boxes and re-enables letter buttons
    document.getElementById('ws-reset').addEventListener('click', () => {
        wsFilledLetters = [];
        wsUsedIndices = new Set();
        window._wsAnswer = '';

        for (let i = 0; i < wordLength; i++) {
            const box = document.getElementById(`ws-box-${i}`);
            if (box) {
                box.textContent = _t('');
                box.classList.remove('border-purple-300', 'text-white');
            }
        }
        document.querySelectorAll('.ws-letter').forEach(btn => {
            btn.classList.remove('opacity-30', 'pointer-events-none');
        });
    });

    // Submit click
    document.getElementById('ws-submit').addEventListener('click', () => {
        window.enviarRespuestaWordScramble(false);
    });
}
