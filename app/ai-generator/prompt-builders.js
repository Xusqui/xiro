/**
 * @fileoverview Prompt de la IA para cada tipo de pregunta. El contrato
 * __tests__/question-types.contract.test.js exige uno por cada tipo del catálogo
 * (public/js/core/question-types.js).
 * @module ai-generator/prompt-builders
 */

'use strict';

const prompts = require('./prompt-builder');
const { buildFillBlanksPrompt } = require('./prompt-fill-blanks');
const { buildWordSearchPrompt } = require('./prompt-word-search');
const { buildMatchingPrompt } = require('./prompt-matching');
const { buildSurveyMultiplePrompt } = require('./prompt-survey-multiple');
const { buildHotspotPrompt } = require('./prompt-hotspot');
const { buildWordCloudPrompt } = require('./prompt-word-cloud');

const PROMPT_BUILDERS = Object.freeze({
    quiz: prompts.buildQuizPrompt,
    survey: prompts.buildSurveyPrompt,
    numeric_approximation: prompts.buildNumericPrompt,
    order: prompts.buildOrderPrompt,
    word_scramble: prompts.buildWordScramblePrompt,
    multiple_choice: prompts.buildMultipleChoicePrompt,
    fill_blanks: buildFillBlanksPrompt,
    word_search: buildWordSearchPrompt,
    matching: buildMatchingPrompt,
    survey_multiple: buildSurveyMultiplePrompt,
    word_cloud: buildWordCloudPrompt,
    hotspot: buildHotspotPrompt
});

/**
 * Tipos que la IA sabe generar, en el orden del formulario de generación.
 * @returns {string[]}
 */
function promptTypes() {
    return Object.keys(PROMPT_BUILDERS);
}

/**
 * Constructor del prompt del tipo, o null si la IA no lo genera.
 * @param {string} type
 * @returns {Function|null}
 */
function getPromptBuilder(type) {
    return Object.prototype.hasOwnProperty.call(PROMPT_BUILDERS, type) ? PROMPT_BUILDERS[type] : null;
}

module.exports = { promptTypes, getPromptBuilder };
