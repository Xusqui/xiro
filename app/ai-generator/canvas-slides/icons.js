'use strict';

/**
 * @fileoverview Iconos de trazo (24x24) que la IA puede pedir por nombre en tarjetas, pasos y portadas.
 * Se guardan como SVG en /uploads/ al importar (sin texto, scripts ni enlaces: pasan svg-guard.js).
 */

const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    cruz: '<path d="M18 6 6 18M6 6l12 12"/>',
    estrella: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"/>',
    trofeo: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    grupo: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2c2.9.4 5 2.9 5 5.8"/>',
    persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
    movil: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
    pantalla: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
    libro: '<path d="M4 5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2z"/><path d="M4 20a2 2 0 0 0 2 2h14v-4"/>',
    grafico: '<path d="M4 20h16"/><rect x="6" y="11" width="3" height="9"/><rect x="11" y="6" width="3" height="14"/><rect x="16" y="14" width="3" height="6"/>',
    tendencia: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    corazon: '<path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3 4.5 6.6 4.5c2 0 3.4 1.1 4.4 2.6 1-1.5 2.4-2.6 4.4-2.6 3.6 0 5.4 3.7 3.8 6.9C19 15.6 12 20 12 20z"/>',
    escudo: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    pregunta: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17v.5"/>',
    diana: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    bandera: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    regalo: '<path d="M4 11h16v10H4z"/><path d="M2.5 7h19v4h-19z"/><path d="M12 7v14"/><path d="M12 7C10.5 3.5 7 3.5 7 5.5S10 7 12 7zM12 7c1.5-3.5 5-3.5 5-1.5S14 7 12 7z"/>',
    mundo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>',
    ciencia: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
    salud: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    ia: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
    dinero: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.5M17.5 12h.5"/>',
    hoja: '<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15z"/><path d="M5 19c3-4 6-7 10-9"/>',
    musica: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    cafe: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c-.6.8-.6 1.6 0 2.4M12 3c-.6.8-.6 1.6 0 2.4"/>',
    lugar: '<path d="M12 21s-7-6.1-7-12a7 7 0 0 1 14 0c0 5.9-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    documento: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
    prohibido: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'
};

const ICON_NAMES = Object.keys(ICONS);

/**
 * SVG del icono en ese color, o null si el nombre no existe.
 * @param {string} name
 * @param {string} color - #rrggbb
 * @returns {string|null}
 */
function iconSvg(name, color) {
    const body = ICONS[name];
    if (!body) return null;
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="' +
        color +
        '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        body +
        '</svg>'
    );
}

/**
 * Anillo de progreso (gráfico de cifra en %): pista translúcida y arco con el porcentaje.
 * @param {number} percent - 0..100
 * @param {string} color - Arco
 * @param {string} track - Pista
 * @returns {string}
 */
function donutSvg(percent, color, track) {
    const r = 80;
    const circumference = 2 * Math.PI * r;
    const arc = (Math.max(0, Math.min(100, percent)) / 100) * circumference;
    // Con 0 % no se pinta el arco: el remate redondeado dejaría un punto suelto
    const value = arc < 1 ? '' :
        `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${color}" stroke-width="26" stroke-linecap="round" ` +
        `stroke-dasharray="${arc.toFixed(1)} ${circumference.toFixed(1)}" transform="rotate(-90 100 100)"/>`;
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">' +
        `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${track}" stroke-opacity="0.18" stroke-width="26"/>` +
        value +
        '</svg>'
    );
}

module.exports = { ICONS, ICON_NAMES, iconSvg, donutSvg };
