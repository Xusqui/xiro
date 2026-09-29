/**
 * @fileoverview Despacha cada pregunta/slide al renderizador correspondiente,
 * replicando la misma jerarquía de decisión que usa el jugador real
 * (ver app/public/js/player/player-game-flow.js).
 */

'use strict';

globalThis.StandaloneQuestionRouter = (() => {
    const SLIDE_TYPES = new Set(['comment', 'info', 'text', 'image', 'text-image']);

    function isSlide(question) {
        return SLIDE_TYPES.has(question?.slide_type);
    }

    /**
     * @param {HTMLElement} container
     * @param {Object} question - pregunta saneada recibida del servidor
     * @param {{onSubmitted:Function, onContinue:Function}} actions
     */
    function render(container, question, actions) {
        if (isSlide(question)) {
            StandaloneQuestionSlides.render(container, question, actions);
            return;
        }

        switch (question.question_type) {
            case 'order':
                StandaloneQuestionOrder.render(container, question, actions);
                break;
            case 'matching':
                StandaloneQuestionMatching.render(container, question, actions);
                break;
            case 'numeric_approximation':
                StandaloneQuestionInput.renderNumeric(container, question, actions);
                break;
            case 'word_scramble':
                StandaloneQuestionInput.renderWordScramble(container, question, actions);
                break;
            case 'multiple_choice':
                StandaloneQuestionMultipleChoice.render(container, question, actions);
                break;
            default:
                // multiple / quiz / survey / true_false comparten UI de opción única
                StandaloneQuestionChoice.render(container, question, actions);
        }
    }

    return { render, isSlide };
})();
