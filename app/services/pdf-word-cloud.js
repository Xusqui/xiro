/**
 * @fileoverview Página PDF de una pregunta word_cloud («Nube de palabras»): enunciado y cuántas
 * palabras puede enviar cada jugador. No tiene respuesta correcta, así que no lleva página de respuesta.
 */

const WordCloudView = require('../public/js/core/word-cloud-view');

/**
 * @param {Object} question - Pregunta con question_text y max_words
 * @param {number} index - Número de pregunta (base 1)
 * @param {number} total - Total de preguntas
 * @param {function(string): string} escapeHtml
 * @returns {string} HTML de la página
 */
function generateWordCloudQuestionHTML(question, index, total, escapeHtml) {
    const max = WordCloudView.remaining(question.max_words, 0);
    const rule = max === 1 ? '1 palabra' : `hasta ${max} palabras`;
    return `
<div class="page" style="background: linear-gradient(135deg, #312e81 0%, #4338ca 50%, #6366f1 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Pregunta ${index} de ${total}
    </div>
    <div style="width: 100%; max-width: 1100px; text-align: center;">
        <div style="background: rgba(255,255,255,0.2); display: inline-block; padding: 10px 24px; border-radius: 12px; color: white; font-size: 20px; font-weight: 700; margin-bottom: 30px;">
            NUBE DE PALABRAS &mdash; ${rule}
        </div>
        <div style="background: rgba(255,255,255,0.95); padding: 40px 45px; border-radius: 24px; color: #1e293b; font-size: ${(question.question_text || '').length > 150 ? '28px' : '34px'}; font-weight: 700; line-height: 1.4;">
            ${escapeHtml(question.question_text || '')}
        </div>
        <div style="margin-top: 24px; color: rgba(255,255,255,0.8); font-size: 18px;">
            Sin respuesta correcta: las palabras de todos los jugadores forman una nube.
        </div>
    </div>
</div>
    `.trim();
}

module.exports = { generateWordCloudQuestionHTML };
