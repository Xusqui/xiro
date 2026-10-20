/**
 * @fileoverview Layout del presentador para preguntas fill_blanks («Completa la frase»).
 * Durante la pregunta proyecta la frase con una casilla vacía por letra (los jugadores
 * ven lo mismo en el móvil); al revelar, las letras de cada palabra giran al aparecer,
 * hueco a hueco, y bajo cada uno sale el porcentaje de jugadores que lo acertó.
 * HTML de la frase en core/fill-blanks-text.js (window.XiroFillBlanks).
 */

const WORD_STEP_MS = 550;
const CELL_STEP_MS = 70;

function fb() {
    return window.XiroFillBlanks;
}

/** Longitudes de los huecos (pregunta preparada o del banco) */
function blankLengths(q) {
    if (Array.isArray(q.fb_lengths)) return q.fb_lengths;
    if (Array.isArray(q.fb_words)) return q.fb_words.map(w => w.length);
    return fb()
        ? fb()
            .wordsFromOptions(q.options)
            .map(w => w.length)
        : [];
}

/**
 * HTML del área de la pregunta: la frase con casillas en una tarjeta.
 * @param {object} q - Pregunta con question_text (marcadores) y fb_lengths
 * @returns {string}
 */
export function renderFillBlanksPresenter(q) {
    if (!fb()) return '';
    return `
        <div id="fb-stage" class="flex-1 flex items-center justify-center pb-14 px-6" style="min-height: 0;">
            <div class="fb-stage-card">
                ${fb().sanitizeSentenceHtml(q.question_text, blankLengths(q), { sizeClass: 'fb-sentence--stage' })}
            </div>
        </div>`;
}

/** Porcentaje de jugadores que acertó el hueco `index` (null si nadie respondió) */
export function correctPercent(stats, index) {
    const answers = stats?.answers || 0;
    if (answers === 0) return null;
    return Math.round(((stats.counts?.[index] || 0) / answers) * 100);
}

function paintBlank(stage, index, word, percent, animate) {
    const blank = stage.querySelector(`.fb-blank[data-blank="${index}"]`);
    if (!blank) return;
    blank.querySelectorAll('.fb-cell').forEach((cell, pos) => {
        cell.textContent = word.charAt(pos);
        if (animate) {
            cell.style.animationDelay = `${pos * CELL_STEP_MS}ms`;
            cell.classList.add('fb-cell--reveal');
        }
    });
    blank.classList.add('fb-blank--ok');
    if (percent !== null) {
        blank.insertAdjacentHTML('beforeend', `<span class="fb-stat">${percent}%</span>`);
    }
}

/**
 * Revela las palabras de cada hueco y cuántos las acertaron.
 * @param {{ text: string, words: string[], lengths: number[], stats?: { answers: number, counts: number[] } }} fillBlanks
 */
export function revealFillBlanksOnStage(fillBlanks) {
    const stage = document.getElementById('fb-stage');
    if (!stage || !fillBlanks || !Array.isArray(fillBlanks.words)) return;

    const sentence = stage.querySelector('.fb-sentence');
    if (sentence && fillBlanks.stats?.answers) sentence.classList.add('fb-sentence--revealed');

    const animate = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    fillBlanks.words.forEach((word, index) => {
        const percent = correctPercent(fillBlanks.stats, index);
        if (!animate) {
            paintBlank(stage, index, word, percent, false);
            return;
        }
        setTimeout(() => paintBlank(stage, index, word, percent, true), index * WORD_STEP_MS);
    });
}
