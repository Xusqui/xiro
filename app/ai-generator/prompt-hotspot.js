/**
 * @fileoverview Prompt de «Toca la imagen» (hotspot) para el generador de IA. prompt-markdown.js
 * compone el Markdown; aquí solo van rol, tarea, reglas y esquema. La IA no marca el área: escribe
 * el enunciado y una búsqueda en inglés para encontrar la imagen en Wikimedia Commons.
 */

'use strict';

const { composePrompt } = require('./prompt-markdown');
const { MAX_QUERY_LENGTH } = require('./question-types/hotspot');

const SCHEMA = `[
  {
    "question_text": "<orden de señalar una zona, p. ej. Señala en el mapa la provincia de Soria>",
    "type": "hotspot",
    "time_limit": 20,
    "image_query": "<búsqueda en inglés de la imagen, p. ej. Provinces of Spain map>"
  }
]`;

const RULES = [
    'Cada pregunta pide al jugador TOCAR una zona concreta de una imagen: un mapa, un diagrama, un esquema anatómico, un cuadro o una foto.',
    'La zona debe estar claramente delimitada en una imagen típica de ese tema (una provincia, un hueso, un órgano, una pieza) y no ser diminuta.',
    'El enunciado empieza por «Señala…», «Toca…» o similar y nombra la imagen (en el mapa, en el esquema…).',
    `image_query: de 2 a 5 palabras EN INGLÉS para buscar la imagen en Wikimedia Commons (máximo ${MAX_QUERY_LENGTH} caracteres); varias preguntas pueden compartir la misma imagen.`,
    'image_query va siempre en inglés aunque el resto del texto vaya en otro idioma.'
];

/**
 * @param {string} text - Documento o tema
 * @param {number} count - Preguntas pedidas
 * @param {string} _dificultad - BAJA | MEDIA | ALTA (no cambia la mecánica, se ignora)
 * @param {{ previousQuestions?: string[], mode?: 'document'|'prompt', language?: string }} [options]
 * @returns {string}
 */
function buildHotspotPrompt(text, count, _dificultad, options = {}) {
    return composePrompt(text, {
        role: 'Eres un generador experto de preguntas de localizar zonas en imágenes. El usuario te indica un tema.',
        task: 'preguntas de «toca la imagen» (el jugador señala una zona de un mapa, esquema o imagen)',
        item: 'preguntas',
        count,
        topicGuidance: ['Usa tu conocimiento para elegir zonas reales y reconocibles del tema.'],
        rules: RULES,
        schema: SCHEMA,
        options
    });
}

module.exports = { buildHotspotPrompt };
