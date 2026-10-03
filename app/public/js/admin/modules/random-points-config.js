/**
 * @fileoverview Bloque de configuración "Puntuación Aleatoria" compartido por los
 * cinco editores del panel (bancos, mezclas, personalizados, trivial y fusión).
 *
 * Mismo patrón que juegos-pool.js: un módulo pequeño que genera el HTML, resuelve
 * el toggle, lee los valores y valida en cliente, para no hacer crecer los módulos
 * de editor (que ya superan las 200 líneas).
 *
 * Los ids se derivan de un prefijo por editor: `${prefix}UseRandomPoints`,
 * `${prefix}RandomPointsPanel`, `${prefix}RandomPointsMin`, `${prefix}RandomPointsMax`.
 */

/* global renderNeonSwitch */

const RANDOM_POINTS_MIN_VALUE = 1;
const RANDOM_POINTS_MAX_VALUE = 500;
const RANDOM_POINTS_DEFAULT_MIN = 10;
const RANDOM_POINTS_DEFAULT_MAX = 50;

function _rpIds(prefix) {
    return {
        toggle: `${prefix}UseRandomPoints`,
        panel: `${prefix}RandomPointsPanel`,
        min: `${prefix}RandomPointsMin`,
        max: `${prefix}RandomPointsMax`
    };
}

/**
 * HTML del bloque completo (switch + panel condicional con mínimo y máximo).
 *
 * @param {string} prefix - Prefijo de ids del editor ('bank', 'game', 'customGame', 'trivial', 'merge')
 * @param {Object} config - Valores actuales del juego
 * @returns {string}
 */
function renderRandomPointsHtml(prefix, config = {}) {
    const ids = _rpIds(prefix);
    const enabled = !!config.use_random_points;
    const min = config.random_points_min ?? RANDOM_POINTS_DEFAULT_MIN;
    const max = config.random_points_max ?? RANDOM_POINTS_DEFAULT_MAX;

    return `
        <div class="flex items-center gap-3 mb-2" title="${_t('admin.random_points.help', null, 'Antes de cada pregunta se sortean los puntos que vale. Solo afecta a Quiz y Anagrama: Encuesta, Ordena, Emparejar, Numérica y Selección Múltiple mantienen su puntuación.')}">
            <span class="text-sm font-bold text-slate-700"><i class="fas fa-dice text-plum-500 mr-1"></i>${_t('admin.random_points.label', null, 'Puntuación Aleatoria')}</span>
            ${renderNeonSwitch({ id: ids.toggle, checked: enabled, action: null, attrs: `data-admin-change="toggleRandomPointsPanel('${prefix}')"` })}
        </div>
        <div id="${ids.panel}" class="${enabled ? '' : 'hidden'} ml-6 p-3 bg-plum-50 rounded-lg border border-plum-100 grid grid-cols-2 gap-3">
            <div>
                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.random_points.min_label', null, 'Puntos mínimos')}</label>
                <input type="number" id="${ids.min}" value="${min}" min="${RANDOM_POINTS_MIN_VALUE}" max="${RANDOM_POINTS_MAX_VALUE}" step="1" class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-plum-500 outline-none text-sm" title="${_t('admin.random_points.min_help', null, 'Valor más bajo que puede salir')}">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.random_points.max_label', null, 'Puntos máximos')}</label>
                <input type="number" id="${ids.max}" value="${max}" min="${RANDOM_POINTS_MIN_VALUE}" max="${RANDOM_POINTS_MAX_VALUE}" step="1" class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-plum-500 outline-none text-sm" title="${_t('admin.random_points.max_help', null, 'Igual al mínimo = puntuación fija')}">
            </div>
        </div>`;
}

/** Muestra u oculta el panel de mínimo/máximo. */
function toggleRandomPointsPanel(prefix) {
    const ids = _rpIds(prefix);
    const toggle = document.getElementById(ids.toggle);
    const panel = document.getElementById(ids.panel);
    if (panel) panel.classList.toggle('hidden', !toggle?.checked);
}

/** Lee los valores del formulario, ya parseados, listos para el body del fetch. */
function readRandomPointsConfig(prefix) {
    const ids = _rpIds(prefix);
    return {
        use_random_points: document.getElementById(ids.toggle)?.checked ?? false,
        random_points_min: parseInt(document.getElementById(ids.min)?.value, 10) || RANDOM_POINTS_DEFAULT_MIN,
        random_points_max: parseInt(document.getElementById(ids.max)?.value, 10) || RANDOM_POINTS_DEFAULT_MAX
    };
}

/** Firma para la detección de cambios sin guardar (valores crudos, como el resto del snapshot). */
function snapshotRandomPoints(prefix) {
    const ids = _rpIds(prefix);
    return {
        use_random_points: document.getElementById(ids.toggle)?.checked ?? false,
        random_points_min: document.getElementById(ids.min)?.value || String(RANDOM_POINTS_DEFAULT_MIN),
        random_points_max: document.getElementById(ids.max)?.value || String(RANDOM_POINTS_DEFAULT_MAX)
    };
}

/**
 * Validación en cliente, con el mismo criterio que RandomPointsValidator en servidor.
 *
 * @param {Object} config - Resultado de readRandomPointsConfig
 * @returns {{ valid: boolean, message: string|null }}
 */
function validateRandomPointsConfig(config) {
    if (!config.use_random_points) return { valid: true, message: null };

    const { random_points_min: min, random_points_max: max } = config;

    if (!Number.isInteger(min) || !Number.isInteger(max)) {
        return { valid: false, message: _t('admin.random_points.error_integer', null, 'Los puntos mínimo y máximo deben ser números enteros') };
    }

    if (min < RANDOM_POINTS_MIN_VALUE || max < RANDOM_POINTS_MIN_VALUE
        || min > RANDOM_POINTS_MAX_VALUE || max > RANDOM_POINTS_MAX_VALUE) {
        return {
            valid: false,
            message: _t('admin.random_points.error_range', { min: RANDOM_POINTS_MIN_VALUE, max: RANDOM_POINTS_MAX_VALUE },
                'Los puntos deben estar entre {min} y {max}')
        };
    }

    if (max < min) {
        return { valid: false, message: _t('admin.random_points.error_inverted', null, 'El máximo debe ser mayor o igual que el mínimo') };
    }

    return { valid: true, message: null };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderRandomPointsHtml,
        toggleRandomPointsPanel,
        readRandomPointsConfig,
        snapshotRandomPoints,
        validateRandomPointsConfig
    };
}
