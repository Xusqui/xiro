/**
 * @fileoverview Utilidades compartidas de UI del jugador
 */

export const OPTION_COLORS = [
    'btn-gradient-red',
    'btn-gradient-blue',
    'btn-gradient-yellow',
    'btn-gradient-green',
    'btn-gradient-purple',
    'btn-gradient-pink'
];

/**
 * Calcular clase de tamano de fuente segun longitud del texto
 */
export function getResponsiveFontClass(text) {
    const length = text.length;
    if (length > 180) return 'text-responsive-base';
    if (length > 120) return 'text-responsive-md';
    if (length > 80) return 'text-responsive-lg';
    if (length > 40) return 'text-adaptive';
    return 'text-adaptive-lg';
}
