/**
 * @fileoverview Bloque multimedia (imagen incrustada en base64, audio o vídeo) de una página de pregunta
 * del PDF de cuestionarios.
 */

const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');
const { escapeHtml, resolvePublicPath, readImageAsDataUri } = require('./pdf-html');

function generateImageMultimediaHTML(question) {
    const imagePath = resolvePublicPath(question.url_recurso);

    try {
        if (!imagePath || !fs.existsSync(imagePath)) {
            logger.debug('Imagen no encontrada:', imagePath);
            return '';
        }

        const dataUri = readImageAsDataUri(imagePath);

        logger.debug('Imagen convertida a base64:', imagePath);
        return `
                        <div style="margin: 30px 0; max-height: 400px; display: flex; justify-content: center;">
                            <img src="${dataUri}" style="max-width: 90%; max-height: 400px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);" />
                        </div>
                    `;
    } catch (err) {
        logger.error('Error leyendo imagen:', err.message);
        return '';
    }
}

function generateAudioMultimediaHTML(question) {
    const audioFileName = path.basename(question.url_recurso);

    return `
                <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); padding: 30px; border-radius: 20px; margin: 30px 0; text-align: center;">
                    <div style="font-size: 64px; margin-bottom: 20px;">🔊</div>
                    <div style="font-size: 24px; font-weight: 700; color: white; margin-bottom: 10px;">ARCHIVO DE AUDIO</div>
                    <div style="background: rgba(0,0,0,0.2); padding: 15px 25px; border-radius: 12px; display: inline-block;">
                        <div style="font-size: 20px; font-weight: 600; color: white; font-family: monospace;">${escapeHtml(audioFileName)}</div>
                    </div>
                </div>
            `;
}

function generateVideoMultimediaHTML(question) {
    return `
                <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); padding: 25px; border-radius: 20px; margin: 30px 0; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🎥</div>
                    <div style="font-size: 20px; font-weight: 600; color: white;">${escapeHtml(question.url_recurso)}</div>
                </div>
            `;
}

/**
 * HTML del recurso multimedia de la pregunta (imagen, audio o vídeo) para el PDF.
 * @param {Object} question - Pregunta con tipo_contenido y url_recurso
 * @returns {string} HTML; vacío si no tiene recurso
 */
function generateMultimediaHTML(question) {
    if (!question.tipo_contenido || !question.url_recurso) {
        return '';
    }

    if (question.tipo_contenido === 'imagen') {
        return generateImageMultimediaHTML(question);
    }
    if (question.tipo_contenido === 'audio') {
        return generateAudioMultimediaHTML(question);
    }
    if (question.tipo_contenido === 'video') {
        return generateVideoMultimediaHTML(question);
    }
    return '';
}

module.exports = { generateMultimediaHTML };
