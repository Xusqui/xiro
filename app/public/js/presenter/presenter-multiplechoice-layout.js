/**
 * @fileoverview Layout para preguntas tipo multiple_choice en el presentador
 */


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
