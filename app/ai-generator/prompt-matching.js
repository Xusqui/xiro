/**
 * @fileoverview Prompt de «Emparejar» (matching) para el generador de IA.
 * Va aparte de prompt-builder.js (ya al límite de tamaño) y reutiliza sus helpers.
 * La IA devuelve los pares en options (option_text / match_value), el formato del
 * JSON de bancos; question-types/matching.js los valida y normaliza.
 * Se pide una candidata de más: los modelos repiten parejas a veces y el parser
 * descarta las que no cumplen (el controlador se queda con las pedidas).
 */

const builder = require('./prompt-builder');
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

const RULES = `REGLAS: cada pregunta tiene una consigna clara y entre ${MIN_PAIRS} y ${MAX_PAIRS} pares (mejor 4) `
    + 'de datos REALES del tema; option_text es el elemento de la izquierda y match_value su ÚNICA pareja correcta; '
    + 'todos los option_text son distintos entre sí y todos los match_value son distintos entre sí, para que ningún '
    + 'elemento pueda emparejarse con dos parejas; textos cortos (máximo 60 caracteres); is_correct=false en todas '
    + 'y order_index correlativo desde 0';

/**
 * @param {string} text - Documento o tema
 * @param {number} count - Preguntas pedidas (se pide MATCHING_EXTRA de más)
 * @param {string} dificultad - BAJA | MEDIA | ALTA
 * @param {{ previousQuestions?: string[], mode?: 'document'|'prompt', language?: string }} [options]
 * @returns {string}
 */
function buildMatchingPrompt(text, count, dificultad, { previousQuestions = [], mode = 'document', language = 'es' } = {}) {
    const lang = builder.getLanguageName(language);
    const candidates = count + MATCHING_EXTRA;
    const difficulty = builder.DIFICULTAD_INSTRUCCION[dificultad] || 'media';
    const exclusion = builder.getExclusionInstruction(previousQuestions);

    if (mode === 'prompt') {
        const safeText = text.trim().slice(0, builder.MAX_PROMPT_CHARS);
        return `Eres un generador experto de preguntas de emparejar. El usuario te indica un tema.
Genera ${candidates} preguntas de emparejar en ${lang} sobre ese tema, cada una con pares distintos. Dificultad: ${difficulty}.${exclusion}
IMPORTANTE: Usa tu conocimiento para crear parejas reales del tema (concepto-definición, autor-obra, país-capital, causa-efecto…). NO generes preguntas sobre la instrucción.
Responde SOLO con un array JSON:
${SCHEMA}

${RULES}, en ${lang}.
NO copies estos ejemplos. Genera preguntas REALES sobre el siguiente tema:

${safeText}`;
    }

    return `${builder.wrapDocumentInput(builder.getText(text))}

${builder.INJECTION_GUARD}Genera ${candidates} preguntas de emparejar en ${lang}, cada una con pares distintos, sobre el texto anterior, entre las etiquetas user_input. Dificultad: ${difficulty}. ${exclusion}
Responde SOLO con un array JSON:
${SCHEMA}

${RULES}, en ${lang}.
NO copies estos ejemplos. Genera preguntas NUEVAS basadas en ese texto.`;
}

module.exports = { buildMatchingPrompt, MATCHING_EXTRA };
