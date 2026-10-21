/**
 * @fileoverview Prompt de «Encuesta de selección múltiple» (survey_multiple) para el
 * generador de IA. Va aparte de prompt-builder.js (ya al límite de tamaño) y reutiliza
 * sus helpers. Sin respuesta correcta: cada jugador marca todas las opciones que le
 * apliquen, así que las opciones no se excluyen entre sí.
 */

const builder = require('./prompt-builder');
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

const RULES =
    `REGLAS: cada pregunta admite VARIAS respuestas a la vez (¿cuáles conoces?, ¿cuáles has usado?, ¿qué te interesa?), ` +
    `sin respuesta correcta; entre ${MIN_OPTIONS} y ${MAX_OPTIONS} opciones distintas que NO se excluyan entre sí; ` +
    'textos cortos (máximo 60 caracteres); todas con is_correct=false y justification=null';

/**
 * @param {string} text - Documento o tema
 * @param {number} count - Preguntas pedidas
 * @param {string} dificultad - BAJA | MEDIA | ALTA (no aplica a encuestas, se ignora)
 * @param {{ previousQuestions?: string[], mode?: 'document'|'prompt', language?: string }} [options]
 * @returns {string}
 */
function buildSurveyMultiplePrompt(
    text,
    count,
    dificultad,
    { previousQuestions = [], mode = 'document', language = 'es' } = {}
) {
    const lang = builder.getLanguageName(language);
    const exclusion = builder.getExclusionInstruction(previousQuestions);

    if (mode === 'prompt') {
        const safeText = text.trim().slice(0, builder.MAX_PROMPT_CHARS);
        return `Eres un generador experto de encuestas. El usuario te indica un tema.
Genera ${count} preguntas de encuesta de selección múltiple (opinión o experiencia, sin respuesta correcta, el jugador marca todas las que quiera) en ${lang} sobre ese tema.${exclusion}
IMPORTANTE: Usa tu conocimiento para crear preguntas reales sobre el tema. NO generes preguntas sobre la instrucción.
Responde SOLO con un array JSON:
${SCHEMA}

${RULES}, en ${lang}.
NO copies estos ejemplos. Genera preguntas REALES sobre el siguiente tema:

${safeText}`;
    }

    return `${builder.wrapDocumentInput(builder.getText(text))}

${builder.INJECTION_GUARD}Genera ${count} preguntas de encuesta de selección múltiple (opinión o experiencia, sin respuesta correcta, el jugador marca todas las que quiera) en ${lang} sobre el texto anterior, entre las etiquetas user_input. ${exclusion}
Responde SOLO con un array JSON:
${SCHEMA}

${RULES}, en ${lang}.
NO copies estos ejemplos. Genera preguntas NUEVAS basadas en ese texto.`;
}

module.exports = { buildSurveyMultiplePrompt };
