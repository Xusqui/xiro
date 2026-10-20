/**
 * @fileoverview Renderizado de preguntas tipo fill_blanks («Completa la frase»).
 * La frase se ve con una casilla por letra en cada hueco; el jugador toca un hueco
 * y escribe con el teclado del móvil (un <input> invisible cubre las casillas). Las
 * pistas destapan letras (primera, última, central) y bajan el valor de la palabra.
 * En equipos cada hueco se comprueba al completarlo: si es correcto se bloquea y
 * aparece a todos; si no, tiembla en rojo y se vacía. Un solo ENVIAR.
 * HTML de la frase en core/fill-blanks-text.js (window.XiroFillBlanks).
 */

import {
    getNickname,
    getHaRespondido,
    setHaRespondido,
    setCanAnswer,
    setCurrentSlideType
} from './player-state.js?v=20260922172926';
import { setBodyHTML } from './player-streak-ui.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';
import * as state from './player-fillblanks-state.js?v=20260922172926';
import {
    joinFillBlanks,
    checkBlank,
    requestHint,
    isTeamFillBlanks
} from './player-fillblanks-team.js?v=20260922172926';

const HINT_COSTS = [30, 60, 75];
const MAX_HINTS = 3;

function fb() {
    return window.XiroFillBlanks;
}

function blankStates() {
    const s = state.getFillBlanksState();
    return s.lengths.map((_, i) => (state.isLocked(i) ? 'fb-blank--ok fb-blank--locked' : ''));
}

function hintButtonHtml(i) {
    const used = state.getFillBlanksState().hints[i];
    const locked = state.isLocked(i);
    const cost = HINT_COSTS[Math.min(used, MAX_HINTS - 1)];
    const exhausted = used >= MAX_HINTS;
    const label = exhausted
        ? _t('player.fillblanks.hint_none', null, 'Sin pistas')
        : _t('player.fillblanks.hint_cost', { pct: cost }, 'Pista −{pct} %');
    return `<button type="button" class="fb-hint-btn" data-hint="${i}" ${locked || exhausted ? 'disabled' : ''}
                aria-label="${escapeHtml(_t('player.fillblanks.hint_aria', { n: i + 1 }, 'Pista para el hueco {n}'))}">
                <span class="fb-hint-btn__num">${i + 1}</span>
                <span class="${exhausted ? '' : 'fb-hint-btn__cost'}">${escapeHtml(label)}</span>
            </button>`;
}

function layoutHtml(pregunta) {
    const s = state.getFillBlanksState();
    const letters = s.lengths.map((_, i) => state.mergedWord(i));
    return `
        <div class="h-dvh w-screen flex flex-col bg-slate-900 overflow-hidden">
            <div class="bg-plum-600 px-3 py-2 text-center shrink-0">
                <p class="text-white font-black text-base uppercase">${escapeHtml(getNickname())}</p>
            </div>
            <div class="fb-play">
                <div class="fb-play__card">
                    ${fb().sanitizeSentenceHtml(pregunta.question_text, s.lengths, { letters, states: blankStates(), sizeClass: 'fb-sentence--player' })}
                </div>
                <p class="fb-play__help">${
    isTeamFillBlanks()
        ? _t(
            'player.fillblanks.help_team',
            null,
            'Toca un hueco y escribe. Cada palabra se comprueba al completarla y vale para todo el equipo.'
        )
        : _t(
            'player.fillblanks.help',
            null,
            'Toca un hueco y escribe la palabra. Envía cuando tengas todas las que sepas.'
        )
}</p>
                <div class="fb-hints">${s.lengths.map((_, i) => hintButtonHtml(i)).join('')}</div>
            </div>
            <div class="px-3 py-2 bg-slate-900/60 border-t border-white/10">
                <button id="fb-submit" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-black uppercase text-base shadow-lg transition active:scale-95">
                    <i class="fas fa-paper-plane mr-2"></i>${_t('player.fillblanks.submit', null, 'Enviar')}
                </button>
            </div>
        </div>
    `;
}

/** Repinta las casillas del hueco i con el estado actual */
function renderBlank(root, i) {
    const blank = root.querySelector(`.fb-blank[data-blank="${i}"]`);
    if (!blank) return;
    const s = state.getFillBlanksState();
    const letters = state.mergedLetters(i);
    const active = state.activePosition(i);
    blank.querySelectorAll('.fb-cell').forEach((cell, pos) => {
        const letter = letters[pos] || '';
        cell.textContent = letter;
        cell.classList.toggle('fb-cell--filled', Boolean(letter) && !s.fixed[i][pos]);
        cell.classList.toggle('fb-cell--hint', Boolean(s.fixed[i][pos]));
        cell.classList.toggle('fb-cell--active', pos === active);
    });
    const locked = state.isLocked(i);
    blank.classList.toggle('fb-blank--ok', locked);
    blank.classList.toggle('fb-blank--locked', locked);
    const input = blank.querySelector('.fb-input');
    if (input) {
        input.maxLength = Math.max(1, state.freeCount(i));
        input.value = s.typed[i];
        input.disabled = locked;
    }
    const button = root.querySelector(`.fb-hint-btn[data-hint="${i}"]`);
    if (button) button.outerHTML = _tHtml(hintButtonHtml(i));
}

function focusBlank(root, i) {
    const input = root.querySelector(`.fb-blank[data-blank="${i}"] .fb-input`);
    if (!input || input.disabled) return false;
    input.focus();
    return true;
}

/**
 * Lleva el foco al siguiente hueco sin completar ni bloquear a partir de `from`
 * (dando la vuelta). Si no queda ninguno, suelta el teclado para que se vea ENVIAR.
 */
function focusNextOpenBlank(root, from) {
    const total = state.getFillBlanksState().lengths.length;
    for (let step = 0; step < total; step++) {
        const i = (from + step) % total;
        if (!state.isComplete(i) && focusBlank(root, i)) return;
    }
    const active = document.activeElement;
    if (active?.classList.contains('fb-input')) active.blur();
}

function applyHint(root, hint) {
    state.addHintLetter(hint.blankIndex, hint.position, hint.letter, hint.hintCount);
    renderBlank(root, hint.blankIndex);
    // La pista puede completar la palabra: seguir escribiendo en el siguiente hueco
    if (state.isComplete(hint.blankIndex) && !isTeamFillBlanks()) focusNextOpenBlank(root, hint.blankIndex + 1);
}

function lockBlankUi(root, blankIndex, word) {
    state.lockBlank(blankIndex, word);
    renderBlank(root, blankIndex);
    navigator.vibrate?.(30);
    focusNextOpenBlank(root, blankIndex + 1);
}

function rejectBlankUi(root, i) {
    const blank = root.querySelector(`.fb-blank[data-blank="${i}"]`);
    state.setTyped(i, '');
    if (!blank) return;
    blank.classList.add('fb-blank--wrong');
    setTimeout(() => {
        blank.classList.remove('fb-blank--wrong');
        renderBlank(root, i);
    }, 450);
}

/** Palabra completa en equipos: el servidor la comprueba */
function maybeCheck(root, i) {
    if (!isTeamFillBlanks() || !state.isComplete(i) || state.isLocked(i)) return;
    checkBlank(i, state.mergedWord(i)).then(ack => {
        if (!ack?.ok || state.isLocked(i)) return;
        if (ack.correct) lockBlankUi(root, i, ack.word);
        else rejectBlankUi(root, i);
    });
}

function bindBlank(root, blank) {
    const i = Number(blank.dataset.blank);
    const input = document.createElement('input');
    input.className = 'fb-input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'characters';
    input.spellcheck = false;
    input.setAttribute('inputmode', 'text');
    input.setAttribute('aria-label', _t('player.fillblanks.blank_aria', { n: i + 1 }, 'Hueco {n}'));
    blank.appendChild(input);
    renderBlank(root, i);

    input.addEventListener('input', () => {
        // Solo letras (con tildes: el servidor las normaliza), en mayúsculas
        const clean = input.value.replace(/[^A-Za-zÀ-ɏ]/g, '').toUpperCase();
        state.setTyped(i, clean);
        renderBlank(root, i);
        if (!state.isComplete(i)) return;
        // Palabra completa: en equipos la comprueba el servidor (y bloquea o vacía);
        // en individual se sigue escribiendo en el siguiente hueco
        if (isTeamFillBlanks()) maybeCheck(root, i);
        else focusNextOpenBlank(root, i + 1);
    });
    input.addEventListener('focus', () => blank.classList.add('fb-blank--focus'));
    input.addEventListener('blur', () => blank.classList.remove('fb-blank--focus'));
    input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const next = root.querySelector(`.fb-blank[data-blank="${i + 1}"] .fb-input`);
        if (next && !next.disabled) next.focus();
        else input.blur();
    });
    blank.addEventListener('click', () => {
        if (!input.disabled) input.focus();
    });
}

function bindHints(root) {
    root.querySelector('.fb-hints').addEventListener('click', event => {
        const button = event.target.closest('.fb-hint-btn');
        if (!button || button.disabled || button.dataset.pending) return;
        const i = Number(button.dataset.hint);
        button.dataset.pending = '1';
        requestHint(i).then(ack => {
            delete button.dataset.pending;
            if (ack?.ok) applyHint(root, ack);
        });
    });
}

function bindTeam(root) {
    joinFillBlanks({
        onSolved: data => {
            if (root.isConnected && !state.isLocked(data.blankIndex)) lockBlankUi(root, data.blankIndex, data.word);
        },
        onHint: data => {
            if (root.isConnected) applyHint(root, data);
        },
        onSubmitted: data => window.enviarRespuestaFillBlanks(false, data.words),
        onSync: ack => {
            if (!root.isConnected) return;
            (ack.hints || []).forEach(h =>
                h.letters.forEach(l => applyHint(root, { blankIndex: h.blankIndex, ...l, hintCount: h.hintCount }))
            );
            (ack.solved || []).forEach(s => lockBlankUi(root, s.blankIndex, s.word));
            // El equipo ya envió mientras este jugador estaba fuera: envía lo mismo (si no lo hizo ya)
            if (ack.submitted && !getHaRespondido()) window.enviarRespuestaFillBlanks(false, ack.submitted.words);
        }
    });
}

/**
 * Renderiza la interfaz de pregunta tipo fill_blanks
 */
export function renderizarPreguntaFillBlanks(pregunta) {
    setHaRespondido(false);
    setCanAnswer(true);
    setCurrentSlideType('question');

    const lengths = Array.isArray(pregunta.fb_lengths) ? pregunta.fb_lengths : [];
    state.startFillBlanks(`xiro_fb_${pregunta.id}_${lengths.join('-')}`, pregunta.question_text, lengths);

    setBodyHTML(layoutHtml(pregunta));
    const root = document.body;
    root.querySelectorAll('.fb-blank').forEach(blank => bindBlank(root, blank));
    bindHints(root);
    bindTeam(root);
    document.getElementById('fb-submit').addEventListener('click', () => window.enviarRespuestaFillBlanks(false));

    // Empezar a escribir sin tocar nada: foco en el primer hueco libre (iOS solo abre el
    // teclado tras un gesto del usuario; en ese caso basta con tocar la frase)
    focusNextOpenBlank(root, 0);
}
