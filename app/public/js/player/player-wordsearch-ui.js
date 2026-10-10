/**
 * @fileoverview Renderizado de preguntas tipo word_search (Sopa de letras).
 * Rejilla 10x10 con dos formas de marcar una palabra: arrastrar de la primera
 * a la última letra, o tocar la primera y después la última. Las palabras
 * acertadas se pintan con el color de su ficha; al encontrar todas se envía.
 * Geometría e interacción en core/word-search-grid.js (window.XiroWordSearch).
 */

import { getNickname, setHaRespondido, setCanAnswer, setCurrentSlideType } from './player-state.js?v=20260922172926';
import { getResponsiveFontClass } from './player-question-utils.js?v=20260922172926';
import { setBodyHTML } from './player-streak-ui.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';
import { startWordSearch, getFoundFlags, addFoundWord, addHint, hasHint } from './player-wordsearch-state.js?v=20260922172926';
import { socket } from './player-socket-config.js?v=20260922172926';
import { joinTeamWordSearch, shareFoundWord } from './player-wordsearch-team.js?v=20260922172926';

function ws() {
    return window.XiroWordSearch;
}

/** Pista a demanda: el servidor dice dónde empieza la palabra y la anota (vale la mitad). */
function requestHint(event, board, wordList) {
    const chip = event.target.closest('.ws-word--hint');
    if (!chip) return;
    const index = Number(chip.dataset.wordIndex);
    if (getFoundFlags()[index] || hasHint(index) || chip.dataset.pending) return;

    chip.dataset.pending = '1';
    socket.emit('word-search-hint', { wordIndex: index }, (ack) => {
        delete chip.dataset.pending;
        if (!ack?.ok) return;
        addHint(index, ack.row, ack.col);
        ws().markHint(board, wordList, index, [ack.row, ack.col]);
    });
}

function layoutHtml(pregunta, grid, words) {
    const fontClass = getResponsiveFontClass(pregunta.question_text);
    return `
        <div class="h-dvh w-screen flex flex-col bg-slate-900 overflow-hidden">
            <div class="bg-plum-600 px-3 py-2 text-center shrink-0">
                <p class="text-white font-black text-base uppercase">${escapeHtml(getNickname())}</p>
            </div>
            <div class="bg-white p-3 border-b-8 border-plum-600 text-slate-800 text-center max-h-[20vh] flex items-center justify-center shrink-0 overflow-y-auto">
                <h2 class="${fontClass} font-black uppercase italic hyphens-auto" lang="es">${escapeHtml(pregunta.question_text)}</h2>
            </div>
            <div class="ws-play">
                <div id="ws-board" class="ws-play__board">${ws().gridHtml(grid, 'wsg--player', _t('common.wordsearch.grid_label', null, 'Sopa de letras'))}</div>
                <p class="ws-play__help">${_t('player.wordsearch.hint_help', null, 'Pista: toca una palabra (vale la mitad)')}</p>
                <div id="ws-word-list" class="ws-words">${ws().chipsHtml(words, _t('player.wordsearch.hint_aria', null, 'Pista:'))}</div>
            </div>
            <div class="p-3 bg-slate-900/60 border-t border-white/10 flex items-center gap-3">
                <p class="text-white font-black text-lg shrink-0"><span id="ws-progress">0</span>/${words.length}</p>
                <button id="ws-finish" class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-base shadow-lg transition active:scale-95">
                    <i class="fas fa-paper-plane mr-2"></i>${_t('player.wordsearch.finish', null, 'Terminar')}
                </button>
            </div>
        </div>
    `;
}

function updateProgress() {
    const count = getFoundFlags().filter(Boolean).length;
    const el = document.getElementById('ws-progress');
    if (el) el.textContent = String(count);
    return count;
}

function paintFound(board, wordList, sel) {
    const cells = ws().cellsBetween(sel.r1, sel.c1, sel.r2, sel.c2) || [];
    ws().paintCells(board, cells, ws().colorFor(sel.index));
    ws().paintChip(wordList, sel.index);
}

function finishIfComplete(total) {
    if (updateProgress() === total) window.enviarRespuestaWordSearch(false);
}

/** Equipos: palabras y pistas de los compañeros aparecen en esta rejilla. */
function bindTeam(board, wordList, words) {
    joinTeamWordSearch({
        onFound: (data) => {
            const sel = { r1: data.r1, c1: data.c1, r2: data.r2, c2: data.c2, index: Number(data.wordIndex) };
            if (!board.isConnected || !words[sel.index] || getFoundFlags()[sel.index]) return;
            addFoundWord(sel);
            paintFound(board, wordList, sel);
            navigator.vibrate?.(30);
            finishIfComplete(words.length);
        },
        onHint: (data) => {
            const index = Number(data.wordIndex);
            if (!board.isConnected || hasHint(index)) return;
            addHint(index, data.row, data.col);
            ws().markHint(board, wordList, index, [data.row, data.col]);
        }
    });
}

/**
 * Renderiza la interfaz de pregunta tipo word_search
 */
export function renderizarPreguntaWordSearch(pregunta) {
    setHaRespondido(false);
    setCanAnswer(true);
    setCurrentSlideType('question');

    const grid = Array.isArray(pregunta.ws_grid) ? pregunta.ws_grid : [];
    const words = Array.isArray(pregunta.ws_words) ? pregunta.ws_words : [];
    // La clave incluye la rejilla: cada partida genera una sopa distinta
    const state = startWordSearch(`xiro_ws_${pregunta.id}_${grid.join('')}`, words);

    setBodyHTML(layoutHtml(pregunta, grid, words));

    const board = document.getElementById('ws-board');
    const wordList = document.getElementById('ws-word-list');

    // Reconexión a la misma pregunta: repintar lo ya encontrado y las pistas
    state.found.forEach(sel => paintFound(board, wordList, sel));
    state.hints.forEach(h => ws().markHint(board, wordList, h.index, [h.row, h.col]));
    updateProgress();

    wordList.addEventListener('click', (event) => requestHint(event, board, wordList));
    bindTeam(board, wordList, words);

    ws().bindSelection(board, {
        grid,
        words,
        getFoundFlags,
        onFound: (selection, _cells, index) => {
            addFoundWord(selection);
            shareFoundWord(selection);
            ws().paintChip(wordList, index);
            navigator.vibrate?.(30);
            finishIfComplete(words.length);
        }
    });

    document.getElementById('ws-finish').addEventListener('click', () => {
        window.enviarRespuestaWordSearch(false);
    });
}
