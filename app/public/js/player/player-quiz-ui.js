/**
 * @fileoverview Renderizado de preguntas tipo quiz y encuesta
 */

import {
    getNickname,
    setHaRespondido,
    setCanAnswer,
    clearOrderState,
    setCurrentSlideType
} from './player-state.js?v=20260828162521';
import { OPTION_COLORS, getResponsiveFontClass } from './player-question-utils.js?v=20260828162521';
import { setBodyHTML } from './player-streak-ui.js?v=20260828162521';
import { escapeHtml, sanitizeResourceUrl } from '../core/sanitize.js?v=20260828162521';

/**
 * Renderizar pregunta con opciones
 */
export function renderizarPregunta(pregunta) {
    clearOrderState();
    setHaRespondido(false);
    setCanAnswer(true);
    setCurrentSlideType('question');

    const colores = OPTION_COLORS;
    const preguntaFontClass = getResponsiveFontClass(pregunta.question_text);

    // Detectar contenido multimedia
    const tipoContenido = pregunta.tipo_contenido || 'texto';
    const urlRecurso = pregunta.url_recurso || null;
    const questionImageUrl = pregunta.question_image_url || null;
    const tieneImagen = tipoContenido === 'imagen' && urlRecurso;
    const tieneAudio = tipoContenido === 'audio' && urlRecurso;
    const tieneImagenEnunciado = !tieneImagen && questionImageUrl;
    const safeNickname = escapeHtml(getNickname());
    const safeQuestionText = escapeHtml(pregunta?.question_text || '');
    const safeUrlRecurso = sanitizeResourceUrl(urlRecurso || '');
    const safeQuestionImageUrl = sanitizeResourceUrl(questionImageUrl || '');

    // HTML de multimedia
    let multimediaHTML = '';
    if (tieneImagen) {
        multimediaHTML = `
            <div class="bg-slate-800 px-2 py-2 flex items-center justify-center shrink-0" style="max-height: 25vh;">
                <img src="${safeUrlRecurso}" alt="Imagen" class="max-w-full max-h-full object-contain rounded-lg shadow-lg">
            </div>`;
    } else if (tieneAudio) {
        multimediaHTML = `
            <div class="bg-purple-800/40 px-3 py-2 flex items-center justify-center shrink-0">
                <p class="text-white/70 text-xs italic flex items-center gap-2">
                    <i class="fas fa-volume-mute"></i>
                    ${_t('player.common.audio_main_screen', null, 'Audio solo en pantalla principal')}
                </p>
            </div>`;
    }

    setBodyHTML(`
                <div class="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
                    <div class="bg-purple-600 px-3 py-2 text-center shrink-0">
                        <p class="text-white font-black text-base uppercase">${safeNickname}</p>
                    </div>
                    ${multimediaHTML}
                    <div class="bg-white p-4 border-b-8 border-purple-600 text-slate-800 text-center ${tieneImagen ? 'min-h-[8vh]' : 'min-h-[12vh]'} ${tieneImagen ? 'max-h-[12vh]' : 'max-h-[20vh]'} flex flex-col items-center justify-center shrink-0 overflow-y-auto">
                        <h2 class="${preguntaFontClass} font-black uppercase italic hyphens-auto" lang="es">${safeQuestionText}</h2>
                        ${tieneImagenEnunciado ? `<img src="${safeQuestionImageUrl}" alt="" class="mt-2 max-h-[150px] max-w-full object-contain rounded-lg shadow mx-auto">` : ''}
                    </div>
                    <div class="grid grid-cols-2 gap-1.5 flex-1 p-1.5 bg-slate-200 overflow-hidden" style="grid-template-rows: repeat(${pregunta.options.length > 4 ? 3 : 2}, minmax(0, 1fr));">
                        ${pregunta.options.map((opt, i) => {
        const fontClass = getResponsiveFontClass(opt.optionText);
        const safeOptionText = escapeHtml(opt.optionText || '');
        const safeOptImg = opt.option_image_url ? sanitizeResourceUrl(opt.option_image_url) : null;
        return `
                            <button data-player-action="send-answer" data-answer-index="${i}" class="btn-glass-3d ${colores[i]} rounded-xl flex flex-col items-center justify-center p-1.5 relative overflow-hidden transition-all active:scale-95">
                                <span class="absolute top-2 left-2 font-black text-white/50 text-xl italic">${i + 1}</span>
                                ${safeOptImg ? `<img src="${safeOptImg}" alt="" class="max-h-[80px] max-w-[80px] object-contain rounded-lg mb-1 shrink-0">` : ''}
                                <span class="btn-text text-white font-bold ${fontClass} uppercase px-1 break-words hyphens-auto leading-tight text-center" lang="es">${safeOptionText}</span>
                            </button>
                        `
    }).join('')}
                    </div>
                </div>`);
}
