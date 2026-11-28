/**
 * @fileoverview Prompt de «Nube de palabras» (word_cloud) para el generador de IA.
 * prompt-markdown.js compone el Markdown; aquí solo van rol, tarea, reglas y esquema.
 * Pregunta abierta: cada jugador escribe palabras muy cortas y no hay opciones.
 */

const { composePrompt } = require('./prompt-markdown');

const SCHEMA = `[
  {
    "question_text": "<pregunta abierta que admita muchas respuestas de una palabra, p. ej. ¿Qué palabra te viene a la cabeza al pensar en el verano?>",
    "type": "word_cloud",
    "tipo_contenido": "texto",
    "url_recurso": null,
    "time_limit": 30,
    "max_words": 1,
    "options": []
  }
]`;

const RULES = [
    'Cada pregunta es abierta: cada jugador escribe una palabra o una expresión muy corta (máximo 20 caracteres), sin respuesta correcta.',
    'Pide asociaciones, opiniones o experiencias que admitan muchas respuestas distintas, no datos con una única solución.',
    'max_words es un entero de 1 a 5: cuántas palabras puede enviar cada jugador (1 si no hay motivo para más).',
    'options siempre es [] y no hay justificación.'
];

/**
 * @param {string} text - Documento o tema
 * @param {number} count - Preguntas pedidas
 * @param {string} _dificultad - BAJA | MEDIA | ALTA (no aplica a preguntas abiertas, se ignora)
 * @param {{ previousQuestions?: string[], mode?: 'document'|'prompt', language?: string }} [options]
 * @returns {string}
 */
function buildWordCloudPrompt(text, count, _dificultad, options = {}) {
    return composePrompt(text, {
        role: 'Eres un generador experto de dinámicas de grupo. El usuario te indica un tema.',
        task: 'preguntas abiertas para una nube de palabras (asociaciones u opiniones de una palabra, sin respuesta correcta)',
        item: 'preguntas',
        count,
        topicGuidance: ['Usa tu conocimiento para crear preguntas reales sobre el tema.'],
        rules: RULES,
        schema: SCHEMA,
        options
    });
}

module.exports = { buildWordCloudPrompt };
