/**
 * @fileoverview Despacha cada pregunta/slide al renderizador correspondiente,
 * replicando la misma jerarquía de decisión que usa el jugador real
 * (ver app/public/js/player/player-game-flow.js).
 */

'use strict';

globalThis.StandaloneQuestionRouter = (() => {
    const SLIDE_TYPES = new Set(['comment', 'info', 'text', 'image', 'text-image', 'video', 'canvas', 'howto']);

    function isSlide(question) {
        return SLIDE_TYPES.has(question?.slide_type);
    }

    // Pantalla de cada tipo de pregunta (core/question-types.js; el contrato
    // __tests__/question-types.contract.test.js exige una para cada tipo). Los renderizadores
    // se leen al llamar: son globales de otros <script> que pueden cargarse después.
    const QUESTION_RENDERERS = Object.freeze({
        quiz: (c, q, a) => StandaloneQuestionChoice.render(c, q, a),
        survey: (c, q, a) => StandaloneQuestionChoice.render(c, q, a),
        order: (c, q, a) => StandaloneQuestionOrder.render(c, q, a),
        matching: (c, q, a) => StandaloneQuestionMatching.render(c, q, a),
        numeric_approximation: (c, q, a) => StandaloneQuestionInput.renderNumeric(c, q, a),
        hotspot: (c, q, a) => StandaloneQuestionHotspot.render(c, q, a),
        word_scramble: (c, q, a) => StandaloneQuestionInput.renderWordScramble(c, q, a),
        multiple_choice: (c, q, a) => StandaloneQuestionMultipleChoice.render(c, q, a),
        survey_multiple: (c, q, a) => StandaloneQuestionMultipleChoice.renderSurvey(c, q, a),
        word_cloud: (c, q, a) => StandaloneQuestionWordCloud.render(c, q, a),
        word_search: (c, q, a) => StandaloneQuestionWordSearch.render(c, q, a),
        fill_blanks: (c, q, a) => StandaloneQuestionFillBlanks.render(c, q, a)
    });

    /**
     * @param {string} questionType
     * @returns {boolean} Si el tipo tiene pantalla propia
     */
    function hasQuestionRenderer(questionType) {
        return typeof questionType === 'string' && Object.prototype.hasOwnProperty.call(QUESTION_RENDERERS, questionType);
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
        // Sin tipo o con uno desconocido: la pantalla de opción única, como el quiz
        const renderQuestion = hasQuestionRenderer(question.question_type)
            ? QUESTION_RENDERERS[question.question_type]
            : QUESTION_RENDERERS.quiz;
        renderQuestion(container, question, actions);
    }

    return { render, isSlide, hasQuestionRenderer };
})();
