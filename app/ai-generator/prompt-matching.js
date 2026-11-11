/**
 * @fileoverview Prompt de «Emparejar» (matching) para el generador de IA.
 * prompt-markdown.js compone el Markdown; aquí solo van rol, tarea, reglas y esquema.
 * La IA devuelve los pares en options (option_text / match_value), el formato del
 * JSON de bancos; question-types/matching.js los valida y normaliza.
 * Se pide una candidata de más: los modelos repiten parejas a veces y el parser
 * descarta las que no cumplen (el controlador se queda con las pedidas).
 */

const { composePrompt } = require('./prompt-markdown');
const { MIN_PAIRS, MAX_PAIRS } = require('./question-types/matching');

const MATCHING_EXTRA = 1;

const SCHEMA = `[
  {
    "question_text": "<consigna breve, p. ej. Empareja cada capital con su país>",
    "type": "matching",
    "tipo_contenido": "texto",
    "url_recurso": null,
    "time_limit": 45,
    "options": [
      {"option_text": "<elemento 1>", "match_value": "<pareja del elemento 1>", "is_correct": false, "order_index": 0},
      {"option_text": "<elemento 2>", "match_value": "<pareja del elemento 2>", "is_correct": false, "order_index": 1},
      {"option_text": "<elemento 3>", "match_value": "<pareja del elemento 3>", "is_correct": false, "order_index": 2},
      {"option_text": "<elemento 4>", "match_value": "<pareja del elemento 4>", "is_correct": false, "order_index": 3}
    ]
  }
]`;

const RULES = [
    `Cada pregunta tiene una consigna clara y entre ${MIN_PAIRS} y ${MAX_PAIRS} pares (mejor 4) de datos REALES del tema.`,
    'option_text es el elemento de la izquierda y match_value su ÚNICA pareja correcta.',
    'Todos los option_text son distintos entre sí y todos los match_value son distintos entre sí, para que ningún elemento pueda emparejarse con dos parejas.',
    'Textos cortos (máximo 60 caracteres).',
    'is_correct=false en todas y order_index correlativo desde 0.'
];

/**
 * @param {string} text - Documento o tema
 * @param {number} count - Preguntas pedidas (se pide MATCHING_EXTRA de más)
 * @param {string} dificultad - BAJA | MEDIA | ALTA
 * @param {{ previousQuestions?: string[], mode?: 'document'|'prompt', language?: string }} [options]
 * @returns {string}
 */
function buildMatchingPrompt(text, count, dificultad, options = {}) {
    return composePrompt(text, {
        role: 'Eres un generador experto de preguntas de emparejar. El usuario te indica un tema.',
        task: 'preguntas de emparejar',
        item: 'preguntas',
        count: count + MATCHING_EXTRA,
        dificultad,
        guidance: ['Cada pregunta con pares distintos.'],
        topicGuidance: [
            'Usa tu conocimiento para crear parejas reales del tema (concepto-definición, autor-obra, país-capital, causa-efecto…).'
        ],
        rules: RULES,
        schema: SCHEMA,
        options
    });
}

module.exports = { buildMatchingPrompt, MATCHING_EXTRA };
