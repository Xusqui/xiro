/**
 * @fileoverview Prompt de «Encuesta de selección múltiple» (survey_multiple) para el
 * generador de IA. prompt-markdown.js compone el Markdown; aquí solo van rol, tarea,
 * reglas y esquema. Sin respuesta correcta: cada jugador marca todas las opciones que
 * le apliquen, así que las opciones no se excluyen entre sí.
 */

const { composePrompt } = require('./prompt-markdown');
const { MIN_OPTIONS, MAX_OPTIONS } = require('./question-types/survey-multiple');

const SCHEMA = `[
  {
    "question_text": "<pregunta en la que se pueden marcar varias, p. ej. ¿Cuáles de estas herramientas conoces?>",
    "type": "survey_multiple",
    "tipo_contenido": "texto",
    "url_recurso": null,
    "time_limit": 30,
    "options": [
      {"option_text": "<opción 1>", "is_correct": false, "justification": null, "order_index": null},
      {"option_text": "<opción 2>", "is_correct": false, "justification": null, "order_index": null},
      {"option_text": "<opción 3>", "is_correct": false, "justification": null, "order_index": null},
      {"option_text": "<opción 4>", "is_correct": false, "justification": null, "order_index": null}
    ]
  }
]`;

const RULES = [
    'Cada pregunta admite VARIAS respuestas a la vez (¿cuáles conoces?, ¿cuáles has usado?, ¿qué te interesa?), sin respuesta correcta.',
    `Entre ${MIN_OPTIONS} y ${MAX_OPTIONS} opciones distintas que NO se excluyan entre sí.`,
    'Textos cortos (máximo 60 caracteres).',
    'Todas con is_correct=false y justification=null.'
];

/**
 * @param {string} text - Documento o tema
 * @param {number} count - Preguntas pedidas
 * @param {string} _dificultad - BAJA | MEDIA | ALTA (no aplica a encuestas, se ignora)
 * @param {{ previousQuestions?: string[], mode?: 'document'|'prompt', language?: string }} [options]
 * @returns {string}
 */
function buildSurveyMultiplePrompt(text, count, _dificultad, options = {}) {
    return composePrompt(text, {
        role: 'Eres un generador experto de encuestas. El usuario te indica un tema.',
        task: 'preguntas de encuesta de selección múltiple (opinión o experiencia, sin respuesta correcta, el jugador marca todas las que quiera)',
        item: 'preguntas',
        count,
        topicGuidance: ['Usa tu conocimiento para crear preguntas reales sobre el tema.'],
        rules: RULES,
        schema: SCHEMA,
        options
    });
}

module.exports = { buildSurveyMultiplePrompt };
