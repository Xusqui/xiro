/**
 * @fileoverview Renderizado de preguntas tipo multiple_choice (selección múltiple)
 */

import {
    getNickname,
    setHaRespondido,
    setCanAnswer,
    clearOrderState,
    setCurrentSlideType,
    getPendingAnswer,
    getSendingAnswer
} from './player-state.js?v=20260822080605';
import { OPTION_COLORS, getResponsiveFontClass } from './player-question-utils.js?v=20260822080605';
import { setBodyHTML } from './player-streak-ui.js?v=20260822080605';
import { enviarRespuestaMultipleChoice } from './player-answer.js?v=20260822080605';

// Estado de selección múltiple
let selectedIndices = [];
let autoSubmitTimeout = null;
let hasSubmitted = false;

/**
 * Toggle selección de una opción
 * @param {number} index - Índice de la opción
 */
window.toggleSeleccionMultiple = function (index) {
    if (hasSubmitted) return;

    const indexPos = selectedIndices.indexOf(index);

    if (indexPos >= 0) {
        // Deseleccionar
        selectedIndices.splice(indexPos, 1);
    } else {
        // Seleccionar (máximo 6)
        if (selectedIndices.length >= 6) {
            return;
        }
        selectedIndices.push(index);
    }

    // Actualizar UI
    updateOptionUI(index);
    updateEnviarButton();
};

/**
 * Actualiza el estado visual de una opción
 * @param {number} index - Índice de la opción
 */
function updateOptionUI(index) {
    const button = document.querySelector(`[data-index="${index}"]`);
    if (!button) return;

    // Remover overlay previo si existe
    const prevOverlay = button.querySelector('.check-overlay');
    if (prevOverlay) {
        prevOverlay.remove();
    }

    if (selectedIndices.includes(index)) {
        // Crear overlay verde que ocupa toda la casilla
        const overlay = document.createElement('div');
        overlay.className = 'check-overlay absolute inset-0 bg-green-500/30 rounded-xl flex items-center justify-center z-10 pointer-events-none';
        overlay.style.animation = 'fadeIn 0.2s ease-out';
        overlay.innerHTML = _tHtml('<i class="fas fa-check text-white" style="font-size: 8rem; text-shadow: 0 0 20px rgba(34, 197, 94, 0.8), 0 0 40px rgba(34, 197, 94, 0.6), 0 0 60px rgba(34, 197, 94, 0.4), 0 4px 10px rgba(0,0,0,0.3); -webkit-text-stroke: 3px rgba(34, 197, 94, 0.9);"></i>');
        button.appendChild(overlay);
        button.classList.add('ring-4', 'ring-green-400', 'shadow-lg', 'shadow-green-400/50');
    } else {
        // Remover estilo de seleccionado
        button.classList.remove('ring-4', 'ring-green-400', 'shadow-lg', 'shadow-green-400/50');
    }
}

/**
 * Actualiza el estado del botón enviar
 */
function updateEnviarButton() {
    const btn = document.getElementById('btn-enviar-multiple');
    if (!btn) return;

    if (selectedIndices.length > 0) {
        btn.classList.remove('disabled');
        btn.disabled = false;
    } else {
        btn.classList.add('disabled');
        btn.disabled = true;
    }
}

/**
 * Envía la respuesta de selección múltiple
 */
window.enviarRespuestaMultiple = function () {
    if (hasSubmitted) return;
    if (selectedIndices.length === 0) return;
    if (getPendingAnswer() || getSendingAnswer()) return;

    hasSubmitted = true;

    // Cancelar auto-submit si existe
    if (autoSubmitTimeout) {
        clearTimeout(autoSubmitTimeout);
        autoSubmitTimeout = null;
    }

    // Deshabilitar botones inmediatamente
    const buttons = document.querySelectorAll('.btn-multiplechoice');
    buttons.forEach(btn => btn.disabled = true);

    const enviarBtn = document.getElementById('btn-enviar-multiple');
    if (enviarBtn) {
        enviarBtn.disabled = true;
        enviarBtn.classList.add('disabled');
        enviarBtn.textContent = _t('ENVIANDO...');
    }

    // Usar la función estándar de envío
    enviarRespuestaMultipleChoice([...selectedIndices], false);
};

/**
 * Renderizar pregunta con selección múltiple
 * @param {Object} pregunta - Datos de la pregunta
 */
export function renderizarPreguntaMultipleChoice(pregunta) {
    clearOrderState();
    selectedIndices = [];
    hasSubmitted = false;
    autoSubmitTimeout = null;

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

    // HTML de multimedia
    let multimediaHTML = '';
    if (tieneImagen) {
        multimediaHTML = `
            <div class="bg-slate-800 px-2 py-2 flex items-center justify-center shrink-0" style="max-height: 25vh;">
                <img src="${urlRecurso}" alt="Imagen" class="max-w-full max-h-full object-contain rounded-lg shadow-lg">
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
        <style>
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.8); }
                to { opacity: 1; transform: scale(1); }
            }
        </style>
        <div class="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
            <div class="bg-purple-600 px-3 py-2 text-center shrink-0">
                <p class="text-white font-black text-base uppercase">${getNickname()}</p>
            </div>
            ${multimediaHTML}
            <div class="bg-white p-4 border-b-8 border-purple-600 text-slate-800 text-center ${tieneImagen ? 'min-h-[8vh]' : 'min-h-[12vh]'} ${tieneImagen ? 'max-h-[12vh]' : 'max-h-[20vh]'} flex flex-col items-center justify-center shrink-0 overflow-y-auto">
                <h2 class="${preguntaFontClass} font-black uppercase italic hyphens-auto" lang="es">${pregunta.question_text}</h2>
                ${tieneImagenEnunciado ? `<img src="${questionImageUrl}" alt="" class="mt-2 max-h-[150px] max-w-full object-contain rounded-lg shadow mx-auto">` : ''}
            </div>
            <div class="bg-purple-700 px-3 py-1 text-center shrink-0">
                <p class="text-white text-xs font-bold uppercase tracking-wide">
                    ✓ Selección Múltiple (puedes marcar varias)
                </p>
            </div>
            <div class="grid grid-cols-2 gap-1.5 flex-1 p-1.5 bg-slate-200 overflow-hidden" style="grid-template-rows: repeat(${pregunta.options.length > 4 ? 3 : 2}, minmax(0, 1fr));">
                ${pregunta.options.map((opt, i) => {
        const fontClass = getResponsiveFontClass(opt.optionText);
        return `
                    <button 
                        data-index="${i}"
                        data-player-action="toggle-multiple"
                        data-answer-index="${i}"
                        class="btn-multiplechoice btn-glass-3d ${colores[i]} rounded-xl flex flex-col items-center justify-center p-1.5 overflow-hidden transition-all duration-200 ease-out relative">
                        <span class="absolute top-2 left-2 font-black text-white/50 text-xl italic">${i + 1}</span>
                        ${opt.option_image_url ? `<img src="${opt.option_image_url}" alt="" class="max-h-[80px] max-w-[80px] object-contain rounded-lg mb-1 shrink-0">` : ''}
                        <span class="btn-text text-white font-bold ${fontClass} uppercase px-1 break-words hyphens-auto leading-tight text-center" lang="es">${opt.optionText}</span>
                    </button>
                `
    }).join('')}
            </div>
            <div class="bg-slate-900 p-3 shrink-0">
                <button 
                    id="btn-enviar-multiple"
                    data-player-action="send-multiple"
                    disabled
                    class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-black text-lg py-4 rounded-xl shadow-lg transition-all disabled">
                    ENVIAR RESPUESTA
                </button>
            </div>
        </div>
    `);

    // Auto-submit al acabar el tiempo
    const timeLimit = (pregunta.time_limit || 30) * 1000;
    autoSubmitTimeout = setTimeout(() => {
        if (!hasSubmitted && selectedIndices.length > 0) {
            enviarRespuestaMultiple();
        }
    }, timeLimit);
}
