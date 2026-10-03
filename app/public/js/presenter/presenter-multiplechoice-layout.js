/**
 * @fileoverview Layout para preguntas tipo multiple_choice en el presentador
 */

import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

/**
 * Renderiza pregunta de selección múltiple en el presentador
 * Durante la pregunta, se muestra igual que quiz (grid de opciones)
 * 
 * @param {Object} question - Datos de la pregunta
 * @returns {void} - Usa renderPregunta() que ya maneja el grid
 */
export function renderMultipleChoicePresenter(_question) {
    // Durante la pregunta, múltiple choice se muestra igual que quiz
    // El grid 2x3 de opciones ya está implementado en presenter-game-ui.js
    // No necesitamos hacer nada especial aquí
    // La diferencia está en el reveal (ver presenter-reveal.js)
}

/**
 * Obtiene HTML para el reveal de respuestas múltiples
 * Muestra todas las opciones correctas marcadas con ✓
 * 
 * @param {Object} question - Datos de la pregunta
 * @param {Array<number>} correctIndices - Índices de respuestas correctas [0, 2, 4]
 * @returns {string} HTML del reveal
 */
export function getMultipleChoiceRevealHTML(question, correctIndices) {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-plum-500', 'bg-pink-500'];

    // Crear lista de opciones correctas para el banner
    const correctOptions = correctIndices.map(idx => ({
        index: idx + 1,
        text: question.options[idx]?.optionText || question.options[idx]?.option_text || '',
        color: colors[idx] || 'bg-gray-500'
    }));

    return `
        <div class="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-green-600 to-green-700 shadow-2xl border-t-4 border-green-400 animate-slide-up z-50">
            <div class="container mx-auto px-8 py-6">
                <div class="flex items-center justify-between gap-6">
                    <div class="flex-1">
                        <h3 class="text-white font-black text-3xl mb-3 uppercase tracking-wide flex items-center gap-3">
                            <span class="text-4xl">✓</span>
                            <span>RESPUESTAS CORRECTAS:</span>
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            ${correctOptions.map(opt => `
                                <div class="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 border-2 border-white/30">
                                    <div class="w-10 h-10 ${opt.color} rounded-full flex items-center justify-center font-black text-white text-lg shrink-0">
                                        ${opt.index}
                                    </div>
                                    <span class="text-white font-bold text-lg flex-1">${escapeHtml(opt.text)}</span>
                                    <span class="text-white text-2xl shrink-0">✓</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Revela las respuestas correctas marcándolas en el grid
 * 
 * @param {Array<number>} correctIndices - Índices de respuestas correctas
 */
export function revealMultipleChoiceInGrid(correctIndices) {
    const correctSet = new Set(correctIndices);

    // Marcar todas las opciones como correctas o incorrectas (EXACTAMENTE IGUAL QUE QUIZ)
    const tarjetas = document.querySelectorAll('#options-grid > div');
    tarjetas.forEach((tarjeta, i) => {
        if (correctSet.has(i)) {
            // Opción correcta - mismo estilo que quiz
            tarjeta.classList.add('ring-8', 'ring-white', 'scale-105', 'z-10');
            tarjeta.innerHTML += `<div class="absolute -top-4 -right-4 bg-white text-green-600 w-14 h-14 rounded-full flex items-center justify-center text-3xl border-4 border-green-500 shadow-xl"><i class="fas fa-check"></i></div>`;
        } else {
            // Opción incorrecta - mismo estilo que quiz
            tarjeta.classList.add('opacity-20', 'grayscale');
        }
    });
}
