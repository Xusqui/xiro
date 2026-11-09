/**
 * @fileoverview Formato de las fechas del panel de administración en el idioma elegido.
 */

const _ADMIN_DATE_PARTS = { day: '2-digit', month: '2-digit', year: 'numeric' };
const _ADMIN_TIME_PARTS = { hour: '2-digit', minute: '2-digit' };

/**
 * Formatea una fecha en el idioma activo del panel.
 * @param {string|number|Date|null|undefined} value - Fecha a formatear
 * @param {{withTime?: boolean}} [options] - Si se añade la hora
 * @returns {string} Fecha formateada, o cadena vacía si no hay fecha o no es válida
 */
function _formatAdminDate(value, { withTime = false } = {}) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const locale = window.XiroI18n?.getLanguage?.() || 'es';
    const parts = withTime ? { ..._ADMIN_DATE_PARTS, ..._ADMIN_TIME_PARTS } : _ADMIN_DATE_PARTS;
    return date.toLocaleString(locale, parts);
}
