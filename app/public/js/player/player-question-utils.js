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
 * Calcular clase de tamano de fuente segun longitud del texto.
 * `narrow` indica que el texto se renderiza en un contenedor de ~mitad
 * de ancho de pantalla (p.ej. columnas de matching), donde el mismo
 * texto necesita una fuente menor para no desbordar la caja.
 */
export function getResponsiveFontClass(text, narrow = false) {
    const length = text.length * (narrow ? 1.8 : 1);
    if (length > 180) return 'text-responsive-base';
    if (length > 120) return 'text-responsive-md';
    if (length > 80) return 'text-responsive-lg';
    if (length > 40) return 'text-adaptive';
    return 'text-adaptive-lg';
}
