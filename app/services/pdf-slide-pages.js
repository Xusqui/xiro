/**
 * @fileoverview Páginas de diapositiva del PDF de cuestionarios: texto, texto con imagen, imagen,
 * actividad libre (comentario) e información. pdf.service.js elige cuál usar por slide_type.
 */

const fs = require('fs');
const logger = require('../config/logger');
const { escapeHtml, resolvePublicPath, readImageAsDataUri } = require('./pdf-html');
const { generateSlideFooterHTML } = require('./pdf-slide-footer');

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
    ${generateSlideFooterHTML(slide)}
</div>
    `.trim();
}

/**
 * Genera HTML para slide de texto + imagen (dos columnas)
 */
function generateTextImageSlideHTML(slide, index, total) {
    let imageHTML =
        '<div style="color:rgba(255,255,255,.5);font-size:3rem;text-align:center;"><i class="fas fa-image"></i></div>';
    if (slide.slide_image) {
        const imagePath = resolvePublicPath(slide.slide_image);
        try {
            if (imagePath && fs.existsSync(imagePath)) {
                imageHTML = `<img src="${readImageAsDataUri(imagePath)}" style="max-width:100%;max-height:600px;object-fit:contain;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.5);" />`;
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
    ${generateSlideFooterHTML(slide)}
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
                imageHTML = `<img src="${readImageAsDataUri(imagePath)}" style="max-width: 95%; max-height: 700px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.4);" />`;
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
    ${
        slide.slide_title
            ? `
    <div style="margin-bottom: 30px;">
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); display: inline-block; padding: 12px 30px; border-radius: 12px; color: white; font-size: 28px; font-weight: 700;">
            ${escapeHtml(slide.slide_title)}
        </div>
    </div>`
            : ''
    }
    <div style="display: flex; justify-content: center; align-items: center; flex: 1;">
        ${imageHTML}
    </div>
    ${generateSlideFooterHTML(slide)}
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
    ${generateSlideFooterHTML(slide)}
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
    ${generateSlideFooterHTML(slide)}
</div>
    `.trim();
}

module.exports = {
    generateTextSlideHTML,
    generateTextImageSlideHTML,
    generateImageSlideHTML,
    generateCommentSlideHTML,
    generateInfoSlideHTML
};
