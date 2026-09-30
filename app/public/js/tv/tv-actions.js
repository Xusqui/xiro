window.TVApp = window.TVApp || {};
/**
 * Acciones delegadas de la TV: cada elemento con data-tv-action="x" ejecuta
 * TV_ACTIONS[x] al pulsarlo. Las funciones de partida viven en TVApp.Main y se
 * resuelven en el momento del clic, así que el orden de carga no importa.
 */
window.TVApp.Actions = (function () {
    'use strict';

    let initialized = false;

    function main() { return window.TVApp.Main; }
    function lobby() { return window.TVApp.Lobby; }
    function teams() { return window.TVApp.Teams; }

    function isValidTeamCount(n) {
        return Number.isFinite(n) && n > 0;
    }

    /** Atributos data-* que usan las acciones. */
    function readActionContext(el) {
        return {
            pin: el.getAttribute('data-pin') || '',
            filter: el.getAttribute('data-filter') || '',
            nickname: el.getAttribute('data-nickname') || '',
            points: parseInt(el.getAttribute('data-points') || '0', 10),
            numTeams: parseInt(el.getAttribute('data-num-teams') || '0', 10)
        };
    }

    const TV_ACTIONS = {
        'next-question': function () { main().nextQuestion(); },
        'toggle-pause-timer': function () { main().togglePauseTimer(); },
        'assign-manual-points': function (c) {
            if (c.nickname && Number.isFinite(c.points)) main().assignManualPoints(c.nickname, c.points);
        },
        'retry-pin-selector': function () { if (lobby()) lobby().mostrarSelectorPIN(); },
        'change-filter': function (c) { if (lobby() && c.filter) lobby().cambiarFiltro(c.filter); },
        'select-pin': function (c) { if (lobby() && c.pin) lobby().seleccionarPIN(c.pin); },
        'start-game': function () { main().empezar(); },
        'go-tv-home': function () { main().volverAJuegos(); },
        'concluir-y-volver': function () { main().concluirYVolver(); },
        'teams-mode-individual': function (c) { if (teams() && c.pin) teams().configurarModoIndividual(c.pin); },
        'teams-mode-team': function (c) { if (teams() && c.pin) teams().mostrarConfiguracionEquipos(c.pin); },
        'teams-select-num': function (c) {
            if (teams() && c.pin && isValidTeamCount(c.numTeams)) teams().seleccionarNumEquipos(c.numTeams, c.pin);
        },
        'teams-back-mode': function (c) { if (teams() && c.pin) teams().mostrarSeleccionModo(c.pin); },
        'teams-confirm': function (c) {
            if (teams() && c.pin && isValidTeamCount(c.numTeams)) teams().confirmarEquipos(c.numTeams, c.pin);
        },
        'teams-back-config': function (c) { if (teams() && c.pin) teams().mostrarConfiguracionEquipos(c.pin); },
        'render-podio': function () {
            if (window.TVApp.Podio) window.TVApp.Podio.renderPodio(window._tempRanking || []);
        },
        'finalizar-juego': function () { main().finalizarJuego(); },
        'abortar-juego': function () { main().abortarJuego(); }
    };

    function findActionElement(target) {
        let el = target;
        while (el && el !== document) {
            if (el.getAttribute && el.getAttribute('data-tv-action')) return el;
            el = el.parentNode;
        }
        return null;
    }

    function handleClick(event) {
        const actionEl = findActionElement(event.target);
        if (!actionEl) return;
        const action = actionEl.getAttribute('data-tv-action') || '';
        if (Object.prototype.hasOwnProperty.call(TV_ACTIONS, action)) {
            TV_ACTIONS[action](readActionContext(actionEl));
        }
    }

    // keyup cubre navegadores de TV antiguos sin evento input; buscarPINs ignora valores repetidos
    function handleSearchInput(event) {
        const el = event.target;
        if (!el || !el.getAttribute || el.getAttribute('data-tv-input') !== 'search-pins') return;
        if (lobby() && lobby().buscarPINs) lobby().buscarPINs(el.value);
    }

    function setup() {
        if (initialized) return;
        initialized = true;
        document.addEventListener('click', handleClick);
        document.addEventListener('input', handleSearchInput);
        document.addEventListener('keyup', handleSearchInput);
    }

    return {
        setup: setup
    };
})();
