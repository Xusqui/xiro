/**
 * @fileoverview Renderiza preguntas tipo "word_search" (Sopa de letras) en Standalone.
 * Contrato: { answerType:'word_search', found: [{r1,c1,r2,c2}] } — coordenadas de
 * las palabras marcadas; el servidor vuelve a leer las letras de su rejilla.
 * Interacción idéntica a player-wordsearch-ui.js (core/word-search-grid.js):
 * arrastrar o tocar inicio y final. Al encontrar todas se envía sola, y al
 * agotarse el tiempo se envía lo encontrado hasta entonces.
 */

'use strict';

globalThis.StandaloneQuestionWordSearch = (() => {
    const { escapeHtml, submitAnswer } = StandaloneQuestionCommon;
    // Margen para que el envío automático llegue antes de que el servidor cierre la pregunta
    const AUTO_SUBMIT_MARGIN_MS = 400;
    let autoSubmitTimer = null;

    function _t(key, fallback) {
        const value = window.XiroI18n?.t(key);
        return value && value !== key ? value : fallback;
    }

    function render(container, question, { onSubmitted }) {
        const WS = window.XiroWordSearch;
        const grid = Array.isArray(question.ws_grid) ? question.ws_grid : [];
        const words = Array.isArray(question.ws_words) ? question.ws_words : [];
        const found = [];
        const flags = words.map(() => false);
        let sent = false;

        container.innerHTML = `
            <div class="pl-viewport">
                <div class="pl-nickname-bar"><p>${escapeHtml(StandaloneState.get().nickname)}</p></div>
                <div class="pl-question-panel"><h2>${escapeHtml(question.question_text)}</h2></div>
                <div class="ws-play">
                    <div id="sa-ws-board" class="ws-play__board">${WS.gridHtml(grid, 'wsg--player', _t('common.wordsearch.grid_label', 'Sopa de letras'))}</div>
                    <p class="ws-play__help">${_t('standalone.game.wordsearch_hint_help', 'Pista: toca una palabra (vale la mitad)')}</p>
                    <div id="sa-ws-words" class="ws-words">${WS.chipsHtml(words, _t('standalone.game.wordsearch_hint_aria', 'Pista:'))}</div>
                </div>
                <div class="pl-submit-bar">
                    <button type="button" class="pl-submit-btn" data-standalone-action="submit-wordsearch">
                        ${_t('standalone.game.wordsearch_finish', 'Terminar')} (<span id="sa-ws-progress">0</span>/${words.length})
                    </button>
                </div>
            </div>
        `;

        async function send() {
            // El envío automático no debe llegar a otra pregunta
            if (sent || StandaloneState.get().currentQuestion !== question) return;
            sent = true;
            clearTimeout(autoSubmitTimer);
            container.querySelectorAll('button').forEach(el => { el.disabled = true; });
            const ack = await submitAnswer({ found: found.map(({ r1, c1, r2, c2 }) => ({ r1, c1, r2, c2 })) }, 'word_search');
            if (ack && ack.ok === false) {
                sent = false;
                StandaloneState.get().answered = false;
                container.querySelectorAll('button').forEach(el => { el.disabled = false; });
                return;
            }
            onSubmitted();
        }

        const wordList = container.querySelector('#sa-ws-words');
        const board = container.querySelector('#sa-ws-board');
        const hinted = new Set();

        // Pista a demanda: el servidor dice dónde empieza la palabra (vale la mitad)
        wordList.addEventListener('click', async (event) => {
            const chip = event.target.closest && event.target.closest('.ws-word--hint');
            if (!chip || sent) return;
            const index = Number(chip.dataset.wordIndex);
            if (flags[index] || hinted.has(index)) return;
            hinted.add(index);
            const ack = await StandaloneSocket.requestWordSearchHint(index);
            if (!ack || !ack.ok) {
                hinted.delete(index);
                return;
            }
            WS.markHint(board, wordList, index, [ack.row, ack.col]);
        });

        WS.bindSelection(board, {
            grid,
            words,
            getFoundFlags: () => flags,
            onFound: (selection, _cells, index) => {
                if (sent) return;
                flags[index] = true;
                found.push(selection);
                WS.paintChip(wordList, index);
                container.querySelector('#sa-ws-progress').textContent = String(found.length);
                if (found.length === words.length) send();
            }
        });

        container.querySelector('[data-standalone-action="submit-wordsearch"]').addEventListener('click', send);

        clearTimeout(autoSubmitTimer);
        if (typeof question.time_limit === 'number' && question.time_limit > 0) {
            autoSubmitTimer = setTimeout(send, Math.max(0, question.time_limit * 1000 - AUTO_SUBMIT_MARGIN_MS));
        }
    }

    /** Mensaje de la pantalla de resultado (lo usa standalone-reveal.js). */
    function resultMessage(data, pointsPill) {
        const details = data.wordSearchDetails || {};
        const words = Array.isArray(details.words) ? details.words : [];
        const flags = Array.isArray(details.wordsFound) ? details.wordsFound : [];
        const chips = words.map((word, i) => {
            const hinted = flags[i] && Boolean(details.hintedWords?.[i]);
            const style = flags[i] ? ` style="${window.XiroWordSearch.chipStyle(i)}"` : '';
            const label = escapeHtml(`${word} ${flags[i] ? '✓' : '✗'}${hinted ? ' ½' : ''}`);
            return `<span class="ws-word ${flags[i] ? 'is-found' : 'is-missed'}${hinted ? ' is-hinted' : ''}" role="listitem" aria-label="${label}"${style}>${escapeHtml(word)}</span>`;
        }).join('');
        const summary = _t('standalone.game.wordsearch_found', '{n} de {total} palabras')
            .replace('{n}', String(details.foundCount || 0))
            .replace('{total}', String(details.totalWords || words.length));

        return `
            <i class="fas fa-magnifying-glass pl-reveal-icon"></i>
            <h2>${escapeHtml(summary)}</h2>
            <div class="ws-words" role="list" style="margin:12px 0;">${chips}</div>
            ${pointsPill(data.points)}
        `;
    }

    return { render, resultMessage };
})();
