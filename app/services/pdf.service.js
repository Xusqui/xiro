/**
 * @fileoverview Servicio de generación de PDFs para cuestionarios
 * Genera PDFs con renderizado visual de las preguntas. Aquí se monta el documento y se elige la
 * página de cada elemento; las páginas viven en services/pdf-*.js.
 */

const puppeteer = require('puppeteer-core');
const logger = require('../config/logger');
const { generateWordSearchQuestionHTML } = require('./pdf-word-search');
const { generateFillBlanksQuestionHTML } = require('./pdf-fill-blanks');
const { prepareWordSearchQuestion } = require('../domain/services/WordSearchService');
const { generateVideoSlideHTML } = require('./pdf-video-slide');
const { generateCanvasSlideHTML } = require('./pdf-canvas-slide');
const { escapeHtml, resolvePublicPath, wrapPdfDocument } = require('./pdf-html');
const {
    generateWordScrambleQuestionHTML,
    generateMultipleChoiceQuestionHTML,
    generateStandardQuestionHTML
} = require('./pdf-question-pages');
const {
    generateTextSlideHTML,
    generateTextImageSlideHTML,
    generateImageSlideHTML,
    generateCommentSlideHTML,
    generateInfoSlideHTML
} = require('./pdf-slide-pages');
const { generateAnswerHTML } = require('./pdf-answer-page');

function openBrowser() {
    const wsEndpoint = process.env.CHROME_WS_ENDPOINT;

    if (wsEndpoint) {
        logger.info('Conectando a navegador Chrome remoto (browserless) en: ' + wsEndpoint);
        return puppeteer.connect({
            browserWSEndpoint: wsEndpoint
        });
    }

    logger.info('Iniciando Chromium local para PDFs');
    // Iniciar Puppeteer con Chromium instalado localmente (fallback/desarrollo)
    return puppeteer.launch({
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

/**
 * Genera un PDF del cuestionario personalizado con capturas visuales
 * @param {Object} gameData - Datos del juego y preguntas
 * @param {Object} res - Response object de Express
 */
async function generateQuizPDF(gameData, res) {
    const { game, questions } = gameData;

    let browser;
    try {
        browser = await openBrowser();

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

function hasAnswerPage(q) {
    return (
        q.slide_type !== 'comment' &&
        q.slide_type !== 'info' &&
        q.slide_type !== 'text' &&
        q.slide_type !== 'image' &&
        q.slide_type !== 'text-image' &&
        q.slide_type !== 'video' &&
        q.slide_type !== 'canvas' &&
        q.slide_type !== 'howto'
    );
}

/**
 * Genera HTML completo del PDF con todas las páginas
 */
function generateFullPDFHTML(game, questions) {
    const pages = [];

    // Portada
    pages.push(generatePortadaHTML(game, questions));

    // Preguntas y respuestas
    questions.forEach((rawQuestion, i) => {
        // Sopa de letras: una sola rejilla para la pregunta y su solución
        const q = rawQuestion.question_type === 'word_search' ? prepareWordSearchQuestion(rawQuestion) : rawQuestion;
        pages.push(generateQuestionHTML(q, i + 1, questions.length));
        if (hasAnswerPage(q)) {
            pages.push(generateAnswerHTML(q, i + 1));
        }
    });

    return wrapPdfDocument(game.name, pages);
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
        image: generateImageSlideHTML,
        video: generateVideoSlideHTML,
        canvas: (q, i, t) => generateCanvasSlideHTML(q, i, t, resolvePublicPath),
        howto: (q, i, t) =>
            generateInfoSlideHTML(
                { ...q, comment_text: 'Instrucciones: cómo responder una Sopa de letras (animación en pantalla)' },
                i,
                t
            )
    }[question.slide_type];

    if (slideRenderer) {
        return slideRenderer(question, index, total);
    }

    if (question.question_type === 'word_scramble') {
        return generateWordScrambleQuestionHTML(question, index, total);
    }

    if (question.question_type === 'multiple_choice' || question.question_type === 'survey_multiple') {
        return generateMultipleChoiceQuestionHTML(question, index, total);
    }

    if (question.question_type === 'word_search') {
        return generateWordSearchQuestionHTML(question, index, total, escapeHtml);
    }

    if (question.question_type === 'fill_blanks') {
        return generateFillBlanksQuestionHTML(question, index, total, escapeHtml);
    }

    return generateStandardQuestionHTML(question, index, total);
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
