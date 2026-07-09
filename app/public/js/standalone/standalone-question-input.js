/**
 * @fileoverview Renderiza preguntas de tipo "numeric_approximation" y "word_scramble"
 * (ambas son "escribe tu respuesta en un campo y envía").
 */

'use strict';

globalThis.StandaloneQuestionInput = (() => {
    const { escapeHtml, submitAnswer } = StandaloneQuestionCommon;

    async function _handleSubmit(container, value, typeFields, answerType, onSubmitted) {
        const input = container.querySelector('.input-answer-field');
        const btn = container.querySelector('[data-standalone-action="submit-input"]');
        input.disabled = true;
        btn.disabled = true;

        const ack = await submitAnswer(typeFields, answerType);
        if (ack && ack.ok === false) {
            StandaloneState.get().answered = false;
            input.disabled = false;
            btn.disabled = false;
            return;
        }
        onSubmitted();
    }

    function renderNumeric(container, question, { onSubmitted }) {
        container.innerHTML = `
            <div class="question">
                <h2>${escapeHtml(question.question_text)}</h2>
                <input type="number" step="any" class="input-answer-field" placeholder="${window.XiroI18n?.t('standalone.game.numeric_placeholder') || 'Escribe tu respuesta numérica'}">
                <button type="button" class="btn-primary" data-standalone-action="submit-input">
                    ${window.XiroI18n?.t('standalone.game.submit') || 'Enviar respuesta'}
                </button>
            </div>
        `;

        const input = container.querySelector('.input-answer-field');
        container.querySelector('[data-standalone-action="submit-input"]').addEventListener('click', () => {
            const numValue = Number(input.value);
            if (input.value === '' || Number.isNaN(numValue)) return;
            _handleSubmit(container, numValue, { playerAnswer: numValue }, 'numeric', onSubmitted);
        });
    }

    function renderWordScramble(container, question, { onSubmitted }) {
        // scrambled_letters llega como ARRAY de letras sueltas (incluye letras señuelo
        // de relleno hasta ~10), no como string — ver WordScrambleService.generateScrambledLetters
        // y su uso idéntico en player-wordscramble-ui.js.
        const letters = Array.isArray(question.scrambled_letters) ? question.scrambled_letters : [];
        const scrambled = letters.join(' ');
        container.innerHTML = `
            <div class="question">
                <h2>${escapeHtml(question.question_text)}</h2>
                <p class="scramble-letters">${escapeHtml(scrambled)}</p>
                ${question.word_length ? `<p class="scramble-hint">${question.word_length} ${window.XiroI18n?.t('standalone.game.letters') || 'letras'}</p>` : ''}
                <input type="text" class="input-answer-field" autocomplete="off" placeholder="${window.XiroI18n?.t('standalone.game.word_placeholder') || 'Escribe la palabra'}">
                <button type="button" class="btn-primary" data-standalone-action="submit-input">
                    ${window.XiroI18n?.t('standalone.game.submit') || 'Enviar respuesta'}
                </button>
            </div>
        `;

        const input = container.querySelector('.input-answer-field');
        container.querySelector('[data-standalone-action="submit-input"]').addEventListener('click', () => {
            const value = input.value.trim();
            if (!value) return;
            _handleSubmit(container, value, { playerAnswer: value }, 'word_scramble', onSubmitted);
        });
    }

    return { renderNumeric, renderWordScramble };
})();
