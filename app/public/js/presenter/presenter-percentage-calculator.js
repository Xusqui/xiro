/**
 * @fileoverview Percentage Calculator - Calcula porcentajes de votos por opción
 */

/**
 * Redondear a un decimal
 * @param {number} value - Valor a redondear
 * @returns {number}
 */
function roundToSingleDecimal(value) {
    return Math.round(value * 10) / 10;
}

/**
 * Calcular porcentajes de votos para cada opción
 * @param {Object} stats - Objeto con votos por índice { 0: 5, 1: 10, 2: 3, 3: 2 }
 * @param {number} optionCount - Número total de opciones
 * @returns {Array<{count: number, percentage: number}>}
 */
export function calculatePercentages(stats, optionCount) {
    if (!stats || typeof stats !== 'object') {
        return Array.from({ length: optionCount }, () => ({ count: 0, percentage: 0 }));
    }

    // Calcular total de votos
    const totalVotes = Object.values(stats)
        .reduce((sum, count) => sum + (Number(count) || 0), 0);

    // Calcular porcentaje para cada opción
    return Array.from({ length: optionCount }).map((_, index) => {
        const count = Number(stats[index]) || 0;
        const rawPercentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
        const percentage = roundToSingleDecimal(rawPercentage);

        return { count, percentage };
    });
}

/**
 * Crear HTML para mostrar porcentaje en la esquina de una tarjeta
 * @param {number} percentage - Porcentaje a mostrar
 * @param {number} optionIndex - Índice de la opción (0,1,2,3...)
 * @returns {string} HTML del elemento de porcentaje
 */
export function createPercentageHTML(percentage, optionIndex) {
    // Grid de 2 columnas: pares (0,2,4...) = izquierda, impares (1,3,5...) = derecha
    const isLeftColumn = optionIndex % 2 === 0;

    // Izquierda: esquina superior derecha | Derecha: esquina superior izquierda
    const positionClass = isLeftColumn ? 'top-2 right-4' : 'top-2 left-4';

    // Outline negro de 2px + tamaños responsivos usando vmin para mejor adaptabilidad
    const textStyle = 'text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000; font-size: clamp(1.5rem, 3.5vmin, 4rem); line-height: 1;';
    const iconStyle = 'font-size: clamp(0.75rem, 1.5vmin, 1.75rem); margin-right: clamp(0.25rem, 0.5vmin, 0.75rem);';

    return `<div class="absolute ${positionClass} pointer-events-none">
        <div class="text-white font-black" style="${textStyle}">
            <i class="fas fa-percentage" style="${iconStyle}"></i>${percentage}%
        </div>
    </div>`;
}

