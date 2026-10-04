/**
 * @fileoverview Layout del presentador para preguntas word_scramble
 * Muestra casillas vacías durante la pregunta y revela la palabra al final
 */

import { escapeHtml, sanitizeResourceUrl } from '../core/sanitize.js?v=20260922172926';

/**
 * Genera el HTML del área de contenido para preguntas word_scramble.
 * Se inserta en el panel del presentador durante la ronda activa.
 * @param {object} q - Objeto pregunta con word_length y question_text
 * @returns {string} HTML del área de contenido
 */
export function renderWordScramblePresenter(q) {
    const wordLength = q.word_length || (q.correct_word ? String(q.correct_word).length : 7);
    const letters = q.scrambled_letters || [];

    const tipoContenido = q.tipo_contenido || 'texto';
    const urlRecurso = q.url_recurso || null;

    let multimediaHTML = '';
    if (tipoContenido === 'imagen' && urlRecurso) {
        multimediaHTML = `
            <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; max-height: 200px;">
                <img src="${sanitizeResourceUrl(urlRecurso)}" alt="Pregunta" style="max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
            </div>`;
    }

    const emptyBoxes = Array.from({ length: wordLength }, () =>
        `<div style="
            width: 3rem; height: 3rem;
            border: 2px solid #fbbf24;
            border-radius: 0.5rem;
            display: flex; align-items: center; justify-content: center;
            font-weight: 900; font-size: 1.25rem;
            color: #fde68a;
            background: rgba(30,41,59,0.7);
        "></div>`
    ).join('');

    const letterTiles = letters.map(letter =>
        `<div style="
            width: 3rem; height: 3rem;
            border: 2px solid #cd81c6;
            border-radius: 0.5rem;
            display: flex; align-items: center; justify-content: center;
            font-weight: 900; font-size: 1.25rem;
            color: #f2ceed;
            background: rgba(121,52,117,0.4);
        ">${letter}</div>`
    ).join('');

    return `
        <div class="flex-1 pb-6 flex items-center justify-center">
            <div class="bg-gradient-to-br from-yellow-500/20 to-amber-500/20 backdrop-blur-lg rounded-3xl p-8 border-2 border-yellow-500 shadow-2xl text-center" style="max-width: 48rem; width: 100%;">
                <p class="text-2xl font-black italic text-yellow-400 mb-4">🔤 ANAGRAMA &nbsp;·&nbsp; <span class="text-white/70 text-xl">Palabra de <span class="text-yellow-300">${Number(wordLength) || 0}</span> letras</span></p>
                ${multimediaHTML}
                <div id="ws-presenter-boxes" style="display: flex; gap: 0.6rem; flex-wrap: wrap; justify-content: center; margin-bottom: 1.5rem;">
                    ${emptyBoxes}
                </div>
                <div style="border-top: 1px solid rgba(251,191,36,0.3); padding: 1rem 0 0.5rem;">
                    <p style="font-size:0.8rem; color:rgba(255,255,255,0.5); margin-bottom:0.75rem; text-transform:uppercase; letter-spacing:0.1em;">${_t('presenter.wordscramble.available_letters', null, 'Letras disponibles')}</p>
                    <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; justify-content: center;">
                        ${letterTiles}
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Rellena las casillas del presentador con la palabra correcta (reveal in-place).
 * @param {string} correctWord - Palabra correcta en mayúsculas
 */
export function revealWordScramble(correctWord) {
    const word = (correctWord || '').toUpperCase();
    const container = document.getElementById('ws-presenter-boxes');
    if (!container) return;

    container.innerHTML = _tHtml(word.split('').map(letter => `
        <div style="
            width: 3rem; height: 3rem;
            border: 2px solid #4ade80;
            border-radius: 0.5rem;
            display: flex; align-items: center; justify-content: center;
            font-weight: 900; font-size: 1.25rem;
            color: #86efac;
            background: rgba(20,83,45,0.6);
        ">${letter}</div>
    `).join(''));
}

/**
 * Genera el HTML del banner fijo de reveal para word_scramble.
 * Se inserta con insertAdjacentHTML al hacer reveal.
 * @param {string} correctWord - Palabra correcta
 * @returns {string} HTML del banner
 */
export function getWordScrambleRevealHTML(correctWord) {
    const word = (correctWord || '').toUpperCase();
    return `
        <div class="justification-card" id="word-scramble-reveal-card" style="
            background: linear-gradient(to right, #f59e0b, #d97706);
            color: white;
            padding: 1rem 1.5rem;
            margin: 0.5rem 0 0.75rem;
            border-radius: 1.5rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            border-bottom: 6px solid rgba(0,0,0,0.2);
        ">
            <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 1.5rem; height: 100%;">
                <div style="background: rgba(255,255,255,0.2); padding: 1rem; border-radius: 1rem; flex-shrink: 0;">
                    <i class="fas fa-check-circle" style="font-size: 2.5rem; color: #fef3c7;"></i>
                </div>
                <div style="flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                    <div>
                        <h3 style="font-size: 1.75rem; font-weight: 900; text-transform: uppercase; font-style: italic; margin: 0 0 0.3rem 0;">${_t('presenter.wordscramble.correct_answer', null, 'Respuesta correcta')}</h3>
                        <p style="font-size: 0.95rem; opacity: 0.9; margin: 0;">${_t('presenter.wordscramble.anagram_label', null, 'Anagrama · Descifra la palabra')}</p>
                    </div>
                    <div style="font-size: 3.2rem; font-weight: 900; color: #fef3c7; line-height: 1; letter-spacing: 0.2em;">${escapeHtml(word)}</div>
                </div>
            </div>
        </div>
    `;
}
