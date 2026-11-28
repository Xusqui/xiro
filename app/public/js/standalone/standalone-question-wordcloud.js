/**
 * @fileoverview Renderiza preguntas de tipo "word_cloud" (Nube de palabras) en el modo individual:
 * el enunciado y una casilla por cada palabra posible (HTML en core/word-cloud-view.js). El botón
 * Enviar manda en un solo mensaje las casillas rellenadas; con eso la pregunta se da por
 * respondida, aunque no se hayan usado todas las casillas.
 */

'use strict';

globalThis.StandaloneQuestionWordCloud = (() => {
    const { escapeHtml, submitAnswer } = StandaloneQuestionCommon;

    function translated(key, fallback) {
        return window.XiroI18n?.t(key) || fallback;
    }

    function viewLabels() {
        return {
            placeholder: translated('standalone.game.wordcloud_placeholder', 'Escribe una palabra'),
            send: translated('standalone.game.wordcloud_send', 'Enviar'),
            upTo: translated('standalone.game.wordcloud_up_to', 'Puedes enviar hasta {n} palabras'),
            done: translated('standalone.game.wordcloud_done', 'Palabras enviadas')
        };
    }

    function render(container, question, { onSubmitted }) {
        const sentWords = [];
        let finished = false;

        function draw() {
            const inputHtml = window.XiroWordCloudView.inputHtml({
                maxWords: question.max_words,
                sentWords,
                finished,
                labels: viewLabels()
            });
            container.innerHTML = `
                <div class="pl-viewport">
                    <div class="pl-nickname-bar"><p>${escapeHtml(StandaloneState.get().nickname)}</p></div>
                    <div class="pl-question-panel"><h2>${escapeHtml(question.question_text)}</h2></div>
                    <div class="pl-input-area">${inputHtml}<p class="wc-notice" data-wc-notice role="status" aria-live="polite"></p></div>
                </div>
            `;
            bind();
        }

        function notice(key, fallback) {
            const element = container.querySelector('[data-wc-notice]');
            if (element) element.textContent = translated(key, fallback);
        }

        async function send(rawValues) {
            const text = window.XiroWordCloudText;
            const words = rawValues.filter(value => text.isValidWord(value)).map(value => text.cleanWord(value));
            if (words.length === 0) {
                notice('standalone.game.wordcloud_nothing', 'Escribe al menos una palabra');
                return;
            }
            const ack = await submitAnswer({ words }, 'word_cloud');
            if (!ack || ack.ok === false) {
                notice('standalone.game.wordcloud_error', 'No se pudo enviar. Inténtalo de nuevo');
                return;
            }
            sentWords.push(...(ack.wordCloud?.accepted || words));
            finished = true;
            draw();
            onSubmitted();
        }

        function bind() {
            const form = container.querySelector('[data-wc-form]');
            const inputs = container.querySelectorAll('[data-wc-input]');
            if (!form || inputs.length === 0) return;
            form.addEventListener('submit', event => {
                event.preventDefault();
                send(Array.from(inputs, input => input.value));
            });
        }

        draw();
    }

    return { render };
})();
