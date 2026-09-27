/**
 * @fileoverview Servicio de generación de PDFs para cuestionarios
 * Genera PDFs con renderizado visual de las preguntas
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');
const { extractCorrectAnswer, generateCorrectAnswerHTML } = require('../application/helpers/CorrectAnswerExtractor');

const PUBLIC_ROOT = '/usr/src/app/public';

/**
 * Ruta absoluta dentro de public/ para una ruta de imagen escrita por un editor,
 * o null si apunta fuera (p. ej. "../../etc/passwd"): evita leer ficheros del
 * servidor e incrustarlos en el PDF.
 */
function resolvePublicPath(relativePath) {
    if (typeof relativePath !== 'string' || !relativePath) return null;
    const abs = path.resolve(PUBLIC_ROOT, relativePath.replace(/^[/\\]+/, ''));
    return abs.startsWith(PUBLIC_ROOT + path.sep) ? abs : null;
}

/**
 * Genera un PDF del cuestionario personalizado con capturas visuales
 * @param {Object} gameData - Datos del juego y preguntas
 * @param {Object} res - Response object de Express
 */
async function generateQuizPDF(gameData, res) {
    const { game, questions } = gameData;

    let browser;
    try {
        const wsEndpoint = process.env.CHROME_WS_ENDPOINT;
        
        if (wsEndpoint) {
            logger.info('Conectando a navegador Chrome remoto (browserless) en: ' + wsEndpoint);
            browser = await puppeteer.connect({
                browserWSEndpoint: wsEndpoint
            });
        } else {
            logger.info('Iniciando Chromium local para PDFs');
            // Iniciar Puppeteer con Chromium instalado localmente (fallback/desarrollo)
            browser = await puppeteer.launch({
                executablePath: '/usr/bin/chromium-browser',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions'
                ],
                headless: true
            });
        }

        const page = await browser.newPage();

        // Configurar viewport a 1280x1024
        await page.setViewport({
            width: 1280,
            height: 1024,
            deviceScaleFactor: 1
        });

        // Generar HTML completo con todas las páginas
        const fullHTML = generateFullPDFHTML(game, questions);

        logger.debug('Generando PDF para:', game.name);
        logger.debug('Total de preguntas:', questions.length);

        // Configurar headers para descarga ANTES de generar el PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(game.name)}.pdf"`);
        res.setHeader('Content-Length', '0'); // Temporal, se actualizará

        await page.setContent(fullHTML, { waitUntil: 'load', timeout: 60000 });

        // Esperar un poco para que las imágenes carguen
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Generar PDF como Buffer
        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            preferCSSPageSize: false,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });

        await browser.close();
        browser = null;

        // Actualizar Content-Length y enviar
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer, 'binary');

    } catch (error) {
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                logger.error('Error cerrando browser:', closeError);
            }
        }
        throw error;
    }
}

/**
 * Genera HTML completo del PDF con todas las páginas
 */
function generateFullPDFHTML(game, questions) {
    const pages = [];

    // Portada
    pages.push(generatePortadaHTML(game, questions));

    // Preguntas y respuestas
    questions.forEach((q, i) => {
        pages.push(generateQuestionHTML(q, i + 1, questions.length));
        if (q.slide_type !== 'comment' && q.slide_type !== 'info' && q.slide_type !== 'text' && q.slide_type !== 'image' && q.slide_type !== 'text-image') {
            pages.push(generateAnswerHTML(q, i + 1));
        }
    });

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(game.name)}</title>
    <style>
        @page {
            size: 1280px 1024px;
            margin: 0;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        .page {
            width: 1280px;
            height: 1024px;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px;
            position: relative;
        }
        .page:last-child {
            page-break-after: avoid;
        }
    </style>
</head>
<body>
    ${pages.join('\n')}
</body>
</html>
    `.trim();
}

/**
 * Genera HTML de la portada
 */
function generatePortadaHTML(game, questions) {
    return `
<div class="page" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    <div style="text-align: center; color: white;">
        <div style="font-size: 72px; font-weight: 900; margin-bottom: 40px; text-shadow: 0 10px 30px rgba(0,0,0,0.3);">
            XIRO!
        </div>
        <div style="font-size: 48px; font-weight: 700; margin-bottom: 30px; max-width: 900px;">
            ${escapeHtml(game.name)}
        </div>
        <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); padding: 20px 40px; border-radius: 20px; display: inline-block; margin-bottom: 20px;">
            <div style="font-size: 24px; font-weight: 600;">PIN: ${escapeHtml(game.pin)}</div>
        </div>
        <div style="font-size: 28px; margin-top: 30px; opacity: 0.9;">
            📝 ${questions.length} ${questions.length === 1 ? 'pregunta' : 'preguntas'}
        </div>
        <div style="font-size: 18px; margin-top: 60px; opacity: 0.7;">
            Generado el ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
    </div>
</div>
    `.trim();
}

/**
 * Genera HTML de una pregunta
 */
function generateQuestionHTML(question, index, total) {
    const slideRenderer = {
        'text-image': generateTextImageSlideHTML,
        comment: generateCommentSlideHTML,
        info: generateInfoSlideHTML,
        text: generateTextSlideHTML,
        image: generateImageSlideHTML
    }[question.slide_type];

    if (slideRenderer) {
        return slideRenderer(question, index, total);
    }

    if (question.question_type === 'word_scramble') {
        return generateWordScrambleQuestionHTML(question, index, total);
    }

    if (question.question_type === 'multiple_choice') {
        return generateMultipleChoiceQuestionHTML(question, index, total);
    }

    return generateStandardQuestionHTML(question, index, total);
}

function resolveScrambledLetters(question) {
    let scrambledLetters = question.scrambled_letters || [];
    if (scrambledLetters.length === 0 && question.correct_word) {
        const arr = question.correct_word.toUpperCase().split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        scrambledLetters = arr;
    }
    return scrambledLetters;
}

function buildWordScrambleEmptyBoxes(wordLength) {
    return Array.from({ length: wordLength }, () => `
            <div style="background: rgba(255,255,255,0.15); border: 3px solid rgba(255,255,255,0.5); border-bottom: 5px solid rgba(255,255,255,0.8); width: 62px; height: 62px; border-radius: 10px;">
            </div>
        `).join('');
}

function buildWordScrambleLettersHTML(scrambledLetters) {
    if (scrambledLetters.length === 0) {
        return '<div style="color: rgba(255,255,255,0.75); font-size: 20px; font-style: italic;">(Letras disponibles en el dispositivo del jugador)</div>';
    }

    return scrambledLetters.map(letter => `
                <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; width: 55px; height: 55px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; text-transform: uppercase; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    ${escapeHtml(letter)}
                </div>
            `).join('');
}

function generateWordScrambleQuestionHTML(question, index, total) {
    const wordLength = question.word_length || (question.correct_word ? String(question.correct_word).length : 7);
    const emptyBoxes = buildWordScrambleEmptyBoxes(wordLength);
    const scrambledLetters = resolveScrambledLetters(question);
    const lettersHTML = buildWordScrambleLettersHTML(scrambledLetters);

    return `
<div class="page" style="background: linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Pregunta ${index} de ${total}
    </div>
    <div style="width: 100%; max-width: 1100px; text-align: center;">
        <div style="margin-bottom: 22px;">
            <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); display: inline-block; padding: 12px 30px; border-radius: 12px; color: white; font-size: 22px; font-weight: 700;">
                🔤 ANAGRAMA &mdash; Palabra de ${wordLength} letras
            </div>
        </div>
        <div style="background: rgba(255,255,255,0.95); padding: 35px 45px; border-radius: 24px; margin-bottom: 26px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);">
            <div style="font-size: ${(question.question_text || '').length > 150 ? '28px' : '32px'}; font-weight: 700; color: #1e293b; line-height: 1.4;">
                ${escapeHtml(question.question_text)}
            </div>
        </div>
        <div style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                ${emptyBoxes}
            </div>
        </div>
        <div>
            <div style="color: rgba(255,255,255,0.8); font-size: 18px; font-weight: 600; margin-bottom: 14px; letter-spacing: 1px;">LETRAS DISPONIBLES</div>
            <div style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
                ${lettersHTML}
            </div>
        </div>
    </div>
</div>
    `.trim();
}

function buildOptionsHTML(options, letterGradient) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    return options.map((opt, idx) => {
        const optionText = opt.text || opt.option_text || '';

        return `
            <div style="background: white; padding: 20px 30px; border-radius: 16px; margin-bottom: 12px; font-size: 22px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; align-items: center;">
                <div style="background: linear-gradient(135deg, ${letterGradient}); color: white; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 24px; margin-right: 20px; flex-shrink: 0;">
                    ${letters[idx]}
                </div>
                <div style="flex: 1;">${escapeHtml(optionText)}</div>
            </div>
        `;
    }).join('');
}

function generateMultipleChoiceQuestionHTML(question, index, total) {
    const optionsHTML = buildOptionsHTML(question.options || [], '#06b6d4 0%, #0891b2 100%');

    return `
<div class="page" style="background: linear-gradient(135deg, #0e7490 0%, #06b6d4 50%, #22d3ee 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Pregunta ${index} de ${total}
    </div>
    <div style="width: 100%; max-width: 1100px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); display: inline-block; padding: 12px 30px; border-radius: 12px; color: white; font-size: 24px; font-weight: 700; margin-bottom: 25px;">
                ✓ SELECCIÓN MÚLTIPLE &mdash; Pueden haber varias respuestas correctas
            </div>
        </div>
        <div style="background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); padding: 35px 45px; border-radius: 24px; margin-bottom: 25px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);">
            <div style="font-size: ${(question.question_text || '').length > 150 ? '28px' : '32px'}; font-weight: 700; color: #1e293b; line-height: 1.4; text-align: center;">
                ${escapeHtml(question.question_text)}
            </div>
        </div>
        <div style="margin-top: 20px;">
            ${optionsHTML}
        </div>
    </div>
</div>
    `.trim();
}

function generateImageMultimediaHTML(question) {
    const imagePath = resolvePublicPath(question.url_recurso);

    try {
        if (!imagePath || !fs.existsSync(imagePath)) {
            logger.debug('Imagen no encontrada:', imagePath);
            return '';
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const imageBase64 = imageBuffer.toString('base64');
        const ext = path.extname(imagePath).toLowerCase();
        const mimeType = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';

        logger.debug('Imagen convertida a base64:', imagePath);
        return `
                        <div style="margin: 30px 0; max-height: 400px; display: flex; justify-content: center;">
                            <img src="data:${mimeType};base64,${imageBase64}" style="max-width: 90%; max-height: 400px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);" />
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

function generateStandardQuestionHTML(question, index, total) {
    logger.debug(`Pregunta ${index}:`, {
        id: question.question_id,
        tipo_contenido: question.tipo_contenido,
        url_recurso: question.url_recurso
    });

    const multimediaHTML = generateMultimediaHTML(question);
    const optionsHTML = buildOptionsHTML(question.options || [], '#667eea 0%, #764ba2 100%');

    return `
<div class="page" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Pregunta ${index} de ${total}
    </div>
    <div style="width: 100%; max-width: 1100px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); display: inline-block; padding: 12px 30px; border-radius: 12px; color: white; font-size: 24px; font-weight: 700; margin-bottom: 25px;">
                PREGUNTA
            </div>
        </div>
        <div style="background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); padding: 35px 45px; border-radius: 24px; margin-bottom: 25px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);">
            <div style="font-size: ${(question.question_text || '').length > 150 ? '28px' : '32px'}; font-weight: 700; color: #1e293b; line-height: 1.4; text-align: center;">
                ${escapeHtml(question.question_text)}
            </div>
        </div>
        ${multimediaHTML}
        <div style="margin-top: 20px;">
            ${optionsHTML}
        </div>
    </div>
</div>
    `.trim();
}

/**
 * Genera HTML para slide de texto (título + cuerpo)
 */
function generateTextSlideHTML(slide, index, total) {
    return `
<div class="page" style="background: radial-gradient(circle at 15% 20%, rgba(56,189,248,0.25), transparent 35%), radial-gradient(circle at 85% 15%, rgba(244,114,182,0.22), transparent 32%), radial-gradient(circle at 50% 85%, rgba(251,191,36,0.2), transparent 38%), linear-gradient(135deg, #312e81 0%, #6d28d9 45%, #1d4ed8 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Texto ${index} de ${total}
    </div>
    <div style="text-align: center; width: 100%; max-width: 1050px;">
        <div style="font-size: 80px; margin-bottom: 30px;">📝</div>
        <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); display: inline-block; padding: 15px 40px; border-radius: 16px; color: white; font-size: 32px; font-weight: 700; margin-bottom: 20px;">
            DIAPOSITIVA DE TEXTO
        </div>
        <div style="color: rgba(255,255,255,0.85); font-size: 20px; font-style: italic; margin-bottom: 40px;">
            (Título + contenido)
        </div>
        <div style="background: rgba(0,0,0,0.32); backdrop-filter: blur(10px); padding: 50px 60px; border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align:left; border:1px solid rgba(255,255,255,0.15);">
            <div style="font-size: 40px; font-weight: 800; color: #312e81; line-height: 1.2; margin-bottom: 20px;">
                <span style="color:#ffffff">${escapeHtml(slide.slide_title)}</span>
            </div>
            <div style="font-size: 26px; font-weight: 600; color: #f8fafc; line-height: 1.5; white-space: pre-line;">
                ${escapeHtml(slide.slide_body)}
            </div>
        </div>
    </div>
</div>
    `.trim();
}

/**
 * Genera HTML para slide de texto + imagen (dos columnas)
 */
function generateTextImageSlideHTML(slide, index, total) {
    let imageHTML = '<div style="color:rgba(255,255,255,.5);font-size:3rem;text-align:center;"><i class="fas fa-image"></i></div>';
    if (slide.slide_image) {
        const imagePath = resolvePublicPath(slide.slide_image);
        try {
            if (imagePath && fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                const imageBase64 = imageBuffer.toString('base64');
                const ext = path.extname(imagePath).toLowerCase();
                const mimeType = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
                imageHTML = `<img src="data:${mimeType};base64,${imageBase64}" style="max-width:100%;max-height:600px;object-fit:contain;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.5);" />`;
            }
        } catch (err) {
            logger.error('Error leyendo imagen para slide text-image:', err.message);
        }
    }

    const pos = slide.slide_image_position || 'right';
    const textCol = `
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px;">
            <div style="font-size:40px;font-weight:900;color:#fff;line-height:1.2;text-transform:uppercase;">
                ${escapeHtml(slide.slide_title)}
            </div>
            <div style="background:rgba(0,0,0,.32);padding:30px 36px;border-radius:20px;border:1px solid rgba(255,255,255,.15);">
                <div style="font-size:26px;font-weight:600;color:#f1f5f9;line-height:1.5;white-space:pre-line;">
                    ${escapeHtml(slide.slide_body)}
                </div>
            </div>
        </div>`;
    const imgCol = `<div style="flex:1;display:flex;align-items:center;justify-content:center;">${imageHTML}</div>`;
    const leftCol = pos === 'left' ? imgCol : textCol;
    const rightCol = pos === 'left' ? textCol : imgCol;

    return `
<div class="page" style="background:radial-gradient(circle at 15% 20%,rgba(56,189,248,.25),transparent 35%),radial-gradient(circle at 85% 15%,rgba(244,114,182,.22),transparent 32%),radial-gradient(circle at 50% 85%,rgba(251,191,36,.2),transparent 38%),linear-gradient(135deg,#312e81 0%,#6d28d9 45%,#1d4ed8 100%);">
    <div style="position:absolute;top:30px;right:40px;color:rgba(255,255,255,.7);font-size:18px;font-weight:600;">
        Texto+Imagen ${index} de ${total}
    </div>
    <div style="display:flex;gap:40px;width:100%;max-width:1160px;height:800px;align-items:stretch;">
        ${leftCol}
        ${rightCol}
    </div>
</div>
    `.trim();
}

/**
 * Genera HTML de la respuesta
 */
function generateAnswerHTML(question, index) {
    const correctAnswer = extractCorrectAnswer(question);
    const answerHTML = generateCorrectAnswerHTML(correctAnswer);

    return `
<div class="page" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Pregunta ${index} - RESPUESTA
    </div>
    <div style="width: 100%; max-width: 1100px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: rgba(255,255,255,0.25); backdrop-filter: blur(10px); display: inline-block; padding: 12px 30px; border-radius: 12px; color: white; font-size: 24px; font-weight: 700; margin-bottom: 25px;">
                ✓ RESPUESTA CORRECTA
            </div>
        </div>
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); padding: 25px 35px; border-radius: 20px; margin-bottom: 35px;">
            <div style="font-size: 22px; color: rgba(255,255,255,0.95); font-style: italic; text-align: center; line-height: 1.5;">
                ${escapeHtml(question.question_text)}
            </div>
        </div>
        ${answerHTML}
    </div>
</div>
    `.trim();
}

/**
 * Genera HTML para slide de imagen
 */
function generateImageSlideHTML(slide, index, total) {
    let imageHTML = '';
    if (slide.slide_image) {
        const imagePath = resolvePublicPath(slide.slide_image);
        try {
            if (imagePath && fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                const imageBase64 = imageBuffer.toString('base64');
                const ext = path.extname(imagePath).toLowerCase();
                const mimeType = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
                imageHTML = `<img src="data:${mimeType};base64,${imageBase64}" style="max-width: 95%; max-height: 700px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.4);" />`;
            } else {
                imageHTML = `<div style="color: rgba(255,255,255,0.7); font-size: 20px; font-style: italic;">Imagen no encontrada: ${escapeHtml(slide.slide_image)}</div>`;
            }
        } catch (err) {
            logger.error('Error leyendo imagen para slide:', err.message);
            imageHTML = `<div style="color: rgba(255,255,255,0.7); font-size: 20px; font-style: italic;">Error cargando imagen</div>`;
        }
    }

    return `
<div class="page" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); display: flex; flex-direction: column; align-items: center; justify-content: center;">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Imagen ${index} de ${total}
    </div>
    ${slide.slide_title ? `
    <div style="margin-bottom: 30px;">
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); display: inline-block; padding: 12px 30px; border-radius: 12px; color: white; font-size: 28px; font-weight: 700;">
            ${escapeHtml(slide.slide_title)}
        </div>
    </div>` : ''}
    <div style="display: flex; justify-content: center; align-items: center; flex: 1;">
        ${imageHTML}
    </div>
</div>
    `.trim();
}

/**
 * Genera HTML para slide de comentario (actividad libre)
 */
function generateCommentSlideHTML(slide, index, total) {
    return `
<div class="page" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Actividad ${index} de ${total}
    </div>
    <div style="text-align: center; width: 100%; max-width: 1000px;">
        <div style="font-size: 80px; margin-bottom: 30px;">💬</div>
        <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); display: inline-block; padding: 15px 40px; border-radius: 16px; color: white; font-size: 32px; font-weight: 700; margin-bottom: 20px;">
            ACTIVIDAD LIBRE
        </div>
        <div style="color: rgba(255,255,255,0.85); font-size: 20px; font-style: italic; margin-bottom: 40px;">
            (Puntos asignados manualmente)
        </div>
        <div style="background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); padding: 50px 60px; border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <div style="font-size: 36px; font-weight: 600; color: #92400e; line-height: 1.5;">
                ${escapeHtml(slide.comment_text)}
            </div>
        </div>
        <div style="margin-top: 40px; color: rgba(255,255,255,0.8); font-size: 18px; font-style: italic;">
            💡 Ejemplos: Pictionary, imitaciones, actuaciones, etc.
        </div>
    </div>
</div>
    `.trim();
}

/**
 * Genera HTML para slide informativo
 */
function generateInfoSlideHTML(slide, index, total) {
    return `
<div class="page" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Info ${index} de ${total}
    </div>
    <div style="text-align: center; width: 100%; max-width: 1000px;">
        <div style="font-size: 80px; margin-bottom: 30px;">ℹ️</div>
        <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); display: inline-block; padding: 15px 40px; border-radius: 16px; color: white; font-size: 32px; font-weight: 700; margin-bottom: 20px;">
            INFORMACIÓN
        </div>
        <div style="color: rgba(255,255,255,0.85); font-size: 20px; font-style: italic; margin-bottom: 40px;">
            (Solo informativo - sin puntos)
        </div>
        <div style="background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); padding: 50px 60px; border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <div style="font-size: 36px; font-weight: 600; color: #1e40af; line-height: 1.5;">
                ${escapeHtml(slide.comment_text)}
            </div>
        </div>
        <div style="margin-top: 40px; color: rgba(255,255,255,0.8); font-size: 18px; font-style: italic;">
            ℹ️ Este slide solo se muestra, no requiere respuesta
        </div>
    </div>
</div>
    `.trim();
}

/**
 * Escapa HTML para evitar inyección
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Sanitiza el nombre del archivo
 */
function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-z0-9áéíóúñü\s_-]/gi, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);
}

module.exports = { generateQuizPDF };

