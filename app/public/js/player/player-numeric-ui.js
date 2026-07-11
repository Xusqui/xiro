/**
 * @fileoverview Renderizado de preguntas numéricas por aproximación
 */

import {
    getNickname,
    setHaRespondido,
    setCanAnswer,
    setCurrentSlideType
} from './player-state.js?v=20260711194806';
import { enviarRespuestaNumerica } from './player-answer.js?v=20260711194806';
import { getResponsiveFontClass } from './player-question-utils.js?v=20260711194806';

function t(key, fallback, vars) {
    if (typeof window._t === 'function') {
        return window._t(key, vars || null, fallback);
    }
    return String(fallback || key || '');
}

/**
 * Renderizar pregunta tipo "numeric_approximation"
 */
export function renderizarPreguntaNumerica(pregunta) {
    clearOrderState();
    setHaRespondido(false);
    setCanAnswer(true);
    setCurrentSlideType('numeric_approximation');

    const preguntaFontClass = getResponsiveFontClass(pregunta.question_text);
    const hintText = (pregunta.hint_text || pregunta.hint || pregunta.hintText || '').trim()
        || t('player.numeric.hint_fallback', 'El presentador no quiere dar pistas');

    document.body.innerHTML = _tHtml(`
        <div class="h-dvh w-screen flex flex-col bg-slate-900 overflow-hidden">
            <!-- Header fijo -->
            <div class="bg-purple-600 px-3 py-2 text-center shrink-0">
                <p class="text-white font-black text-base uppercase">${getNickname()}</p>
            </div>
            
            <!-- Pregunta -->
            <div class="bg-white p-4 border-b-8 border-purple-600 text-slate-800 text-center min-h-[12vh] max-h-[20vh] flex items-center justify-center shrink-0 overflow-y-auto">
                <h2 class="${preguntaFontClass} font-black uppercase italic hyphens-auto" lang="es">${pregunta.question_text}</h2>
            </div>
            
            <!-- Input numérico -->
            <div class="flex-1 px-4 pt-6 pb-4 flex flex-col items-center justify-start overflow-hidden">
                <div class="bg-indigo-900/50 border border-indigo-400/50 rounded-2xl p-4 mb-4 max-w-md w-full">
                    <p class="text-[10px] font-black uppercase tracking-widest text-cyan-300 mb-1">${t('player.numeric.hint_label', 'Pista')}</p>
                    <p class="text-sm font-semibold text-white leading-relaxed">💡 ${hintText}</p>
                </div>

                <div class="bg-slate-50 rounded-2xl shadow-lg border-2 border-emerald-400 p-8 max-w-md w-full">
                    <label class="block text-center text-xs font-bold text-slate-600 uppercase mb-4 tracking-wide">
                        <i class="fas fa-keyboard mr-2"></i>${t('player.numeric.answer_label', 'Escribe tu respuesta')}
                    </label>
                    
                    <input 
                        type="number" 
                        step="1"
                        id="numeric-answer-input"
                        placeholder="${t('player.numeric.input_placeholder', 'Ej: 123456')}"
                        class="w-full text-4xl font-black text-center text-purple-600 bg-white border-2 border-emerald-300 rounded-xl p-6 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300 transition mb-6"
                        autofocus
                    >
                    
                    <p class="text-center text-xs text-slate-600 mb-6 italic">
                        <i class="fas fa-info-circle mr-1"></i>${t('player.numeric.only_integers', 'Solo números enteros')}
                    </p>
                </div>
            </div>
            
            <!-- Botón enviar -->
            <div class="p-3 bg-slate-900/60 border-t border-white/10">
                <button id="numeric-submit" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-xl shadow-lg transition active:scale-95">
                    <i class="fas fa-paper-plane mr-2"></i>${t('player.numeric.submit', 'Enviar')}
                </button>
            </div>
        </div>
    `);

    const submitButton = document.getElementById('numeric-submit');
    const inputElement = document.getElementById('numeric-answer-input');

    if (submitButton) {
        submitButton.addEventListener('click', () => window.enviarRespuestaNumerica(false));
    }

    if (inputElement) {
        inputElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                window.enviarRespuestaNumerica(false);
            }
        });
    }
}

// Limpieza de estado (función auxiliar)
function clearOrderState() {
    // Placeholder para mantener consistencia con player-order-ui.js
    // Esta función no hace nada pero se proporciona para compatibilidad
}
