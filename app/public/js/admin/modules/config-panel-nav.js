/**
 * @fileoverview Columna de navegación de Configuración → Servidor, a la izquierda de
 * #config-form-area: las secciones de config-panel-sections.js agrupadas en bloques.
 * Pestañas WAI-ARIA con activación manual: flechas, Inicio y Fin mueven el foco; Enter,
 * Espacio o el clic abren la sección. Abrir puede pedir confirmación por cambios sin
 * guardar y algunas secciones cargan por red, por eso mover el foco no cambia nada.
 * El clic lo atiende config-panel-actions.js (data-config-action="switch-tab").
 * Estilos en css/admin-config-nav.css.
 */

const _CONFIG_NAV_STEPS = new Map([
    ['ArrowDown', 1],
    ['ArrowRight', 1],
    ['ArrowUp', -1],
    ['ArrowLeft', -1]
]);

let _configNavKeysReady = false;

function _configNavTab(sec, activeId) {
    const selected = sec.id === activeId;
    return `
        <button type="button" role="tab" id="config-nav-${sec.id}" class="xcfg-tab"
            aria-selected="${selected}" aria-controls="config-tab-content" tabindex="${selected ? 0 : -1}"
            data-config-action="switch-tab" data-tab-id="${sec.id}">
            <span class="xcfg-tab__icon ${sec.color || ''}" aria-hidden="true"><i class="fas ${sec.icon}"></i></span>
            <span class="xcfg-tab__label">${_t(sec.titleKey)}</span>
        </button>`;
}

/** HTML de la columna: cada bloque con su título; activeId es la sección abierta. */
function renderConfigNav(activeId) {
    return configNavGroups()
        .map(
            group => `
        <div class="xcfg-nav__group">
            <p class="xcfg-nav__title" aria-hidden="true">${_t(group.titleKey)}</p>
            ${group.sections.map(sec => _configNavTab(sec, activeId)).join('')}
        </div>`
        )
        .join('');
}

/**
 * Pinta la columna en su hueco (#config-tab-bar) cuando ya han llegado los datos.
 * Los títulos de bloque se ocultan al lector de pantalla: el nombre de cada pestaña basta.
 */
function paintConfigNav(activeId) {
    const bar = document.getElementById('config-tab-bar');
    if (!bar) return;
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-orientation', 'vertical');
    bar.setAttribute('aria-labelledby', 'config-title');
    bar.innerHTML = _tHtml(renderConfigNav(activeId));
    _revealConfigTab(bar, document.getElementById('config-nav-' + activeId));
}

/** Marca la sección abierta sin repintar la columna: el foco se queda donde estaba. */
function syncConfigNav(activeId) {
    const bar = document.getElementById('config-tab-bar');
    if (!bar) return;
    bar.querySelectorAll('[role="tab"]').forEach(tab => {
        const selected = tab.dataset.tabId === activeId;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
    });
    _revealConfigTab(bar, document.getElementById('config-nav-' + activeId));
}

/** En la columna estrecha (tira horizontal) centra la pestaña abierta en la tira. */
function _revealConfigTab(bar, tab) {
    if (!tab || bar.scrollWidth <= bar.clientWidth) return;
    const barBox = bar.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    bar.scrollLeft += tabBox.left - barBox.left - (barBox.width - tabBox.width) / 2;
}

/** Flechas (en columna o en tira), Inicio y Fin recorren las pestañas; al final vuelve al principio. */
function _onConfigNavKeydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const tab = event.target.closest?.('#config-tab-bar [role="tab"]');
    if (!tab) return;
    const tabs = [...document.querySelectorAll('#config-tab-bar [role="tab"]')];
    const step = _CONFIG_NAV_STEPS.get(event.key);
    let next = -1;
    if (step) next = (tabs.indexOf(tab) + step + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    tabs[next].focus();
}

function _initConfigNavKeys() {
    if (_configNavKeysReady) return;
    _configNavKeysReady = true;
    document.addEventListener('keydown', _onConfigNavKeydown);
}

_initConfigNavKeys();
