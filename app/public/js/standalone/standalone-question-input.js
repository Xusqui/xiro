/**
 * @fileoverview Renderiza preguntas de tipo "numeric_approximation" y "word_scramble"
 * Estética E INTERACCIÓN igual que player-numeric-ui.js / player-wordscramble-ui.js:
 * el anagrama se responde tocando las letras (no escribiendo), que van rellenando
 * las casillas vacías, con un botón "Borrar" para reiniciar.
 */

'use strict';

globalThis.StandaloneQuestionInput = (() => {
    const { escapeHtml, submitAnswer } = StandaloneQuestionCommon;

    function renderNumeric(container, question, { onSubmitted }) {
        const nickname = escapeHtml(StandaloneState.get().nickname);
        const hint = escapeHtml((question.hint_text || question.hint || '').trim()
            || window.XiroI18n?.t('standalone.game.numeric_hint_fallback') || 'El presentador no quiere dar pistas');

        container.innerHTML = `
            <div class="pl-viewport">
                <div class="pl-nickname-bar"><p>${nickname}</p></div>
                <div class="pl-question-panel"><h2>${escapeHtml(question.question_text)}</h2></div>
                <div class="pl-input-area">
                    <div class="pl-hint-box">
                        <p>${window.XiroI18n?.t('standalone.game.numeric_hint_label') || 'Pista'}</p>
                        <p>💡 ${hint}</p>
                    </div>
                    <div class="pl-numeric-card">
                        <label><i class="fas fa-keyboard"></i> ${window.XiroI18n?.t('standalone.game.numeric_answer_label') || 'Escribe tu respuesta'}</label>
                        <input type="number" step="any" class="input-answer-field pl-numeric-input" placeholder="${window.XiroI18n?.t('standalone.game.numeric_placeholder') || 'Escribe tu respuesta numérica'}">
                        <p class="pl-numeric-note"><i class="fas fa-info-circle"></i> ${window.XiroI18n?.t('standalone.game.numeric_only_integers') || 'Solo números enteros'}</p>
                    </div>
                </div>
                <div class="pl-submit-bar">
                    <button type="button" class="pl-submit-btn" data-standalone-action="submit-input">
                        <i class="fas fa-paper-plane"></i> ${window.XiroI18n?.t('standalone.game.submit') || 'Enviar respuesta'}
                    </button>
                </div>
            </div>
        `;

        const input = container.querySelector('.input-answer-field');
        const btn = container.querySelector('[data-standalone-action="submit-input"]');

        async function submit() {
            const numValue = Number(input.value);
            if (input.value === '' || Number.isNaN(numValue)) return;

            input.disabled = true;
            btn.disabled = true;
            const ack = await submitAnswer({ playerAnswer: numValue }, 'numeric');
            if (ack && ack.ok === false) {
                StandaloneState.get().answered = false;
                input.disabled = false;
                btn.disabled = false;
                return;
            }
            onSubmitted();
        }

        btn.addEventListener('click', submit);
    }

    function renderWordScramble(container, question, { onSubmitted }) {
        // scrambled_letters llega como ARRAY de letras sueltas (incluye letras señuelo
        // de relleno hasta ~10), no como string — ver WordScrambleService.generateScrambledLetters
        // y su uso idéntico en player-wordscramble-ui.js.
        const letters = Array.isArray(question.scrambled_letters) ? question.scrambled_letters : [];
        const nickname = escapeHtml(StandaloneState.get().nickname);
        const wordLength = question.word_length || letters.length;

        const filled = [];
        const usedIndices = new Set();

        function draw() {
            const boxes = Array.from({ length: wordLength }, (_, i) => `
                <div class="pl-scramble-box ${i < filled.length ? 'is-filled' : ''}">${i < filled.length ? escapeHtml(filled[i]) : ''}</div>
            `).join('');

            const tiles = letters.map((letter, idx) => `
                <button type="button" class="pl-scramble-letter" data-standalone-letter data-idx="${idx}" ${usedIndices.has(idx) ? 'disabled' : ''}>${escapeHtml(letter)}</button>
            `).join('');

            container.innerHTML = `
                <div class="pl-viewport">
                    <div class="pl-nickname-bar"><p>${nickname}</p></div>
                    <div class="pl-question-panel"><h2>${escapeHtml(question.question_text)}</h2></div>
                    <div class="pl-input-area">
                        <p class="pl-scramble-hint">${window.XiroI18n?.t('standalone.game.word_length_pre') || 'PALABRA DE'} <strong>${wordLength}</strong> ${window.XiroI18n?.t('standalone.game.letters') || 'LETRAS'}</p>
                        <div class="pl-scramble-boxes" style="grid-template-columns: repeat(${wordLength}, 1fr);">${boxes}</div>
                        <div class="pl-scramble-letters" style="grid-template-columns: repeat(${Math.min(letters.length, 10)}, 1fr);">${tiles}</div>
                    </div>
                    <div class="pl-submit-bar pl-submit-bar-row">
                        <button type="button" class="pl-reset-btn" data-standalone-action="reset-word">
                            <i class="fas fa-undo"></i> ${window.XiroI18n?.t('standalone.game.reset_word') || 'Borrar'}
                        </button>
                        <button type="button" class="pl-submit-btn" data-standalone-action="submit-input">
                            <i class="fas fa-paper-plane"></i> ${window.XiroI18n?.t('standalone.game.submit') || 'Enviar respuesta'}
                        </button>
                    </div>
                </div>
            `;

            container.querySelectorAll('[data-standalone-letter]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = Number(btn.dataset.idx);
                    if (usedIndices.has(idx) || filled.length >= wordLength) return;
                    filled.push(letters[idx]);
                    usedIndices.add(idx);
                    draw();
                });
            });

            container.querySelector('[data-standalone-action="reset-word"]').addEventListener('click', () => {
                filled.length = 0;
                usedIndices.clear();
                draw();
            });

            container.querySelector('[data-standalone-action="submit-input"]').addEventListener('click', () => submit());
        }

        async function submit() {
            const value = filled.join('').trim();
            if (!value) return;

            container.querySelectorAll('button').forEach(el => { el.disabled = true; });
            const ack = await submitAnswer({ playerAnswer: value }, 'word_scramble');
            if (ack && ack.ok === false) {
                StandaloneState.get().answered = false;
                draw();
                return;
            }
            onSubmitted();
        }

        draw();
    }

    return { renderNumeric, renderWordScramble };
})();
