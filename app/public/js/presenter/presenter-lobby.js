/**
 * @fileoverview Lobby del presentador
 * Selección de PIN, configuración individual, y pantallas de lobby
 */

import { mostrarLobbyMain } from './presenter-utils.js?v=20260828012635';
import { cleanupPodio } from './presenter-podio.js?v=20260828012635';
import {
    setPin,
    setSessionId,
    setIsTeamMode,
    setTeamConfig,
    setConnectedPlayers,
    setPlayersData,
    setTotalPlayers
} from './presenter-state.js?v=20260828012635';
import { iniciarLobby } from './presenter-lobby-init.js?v=20260828012635';
import { mostrarConfiguracionEquipos } from './presenter-team-config.js?v=20260828012635';

if (window.XiroI18n && typeof window.XiroI18n.addSections === 'function') {
    void window.XiroI18n.addSections(['presenter_lobby'], { reload: false });
}

// Estado para filtrado de PINs
let filtroActivo = 'todos';
let todosLosPins = [];
let ultimoErrorCargaPins = '';

function t(key, fallback, vars) {
    if (typeof window._t === 'function') {
        return window._t(key, vars || null, fallback);
    }
    return String(fallback || key || '');
}

function renderVistaPinNoValido(selectedPin) {
    mostrarLobbyMain(`
        <div data-presenter-view="invalid-pin" data-pin="${selectedPin}" class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
            <i class="fas fa-exclamation-triangle text-red-500 text-8xl mb-6"></i>
            <h1 class="text-4xl font-black text-white mb-4">${t('presenter.selector.invalid_pin.title', 'PIN No Valido')}</h1>
            <p class="text-slate-400 mb-2 text-xl">${t('presenter.selector.invalid_pin.message', 'El codigo <span class="font-mono bg-red-500/20 px-3 py-1 rounded">{pin}</span> no existe.', { pin: selectedPin })}</p>
            <p class="text-slate-500 mb-6">${t('presenter.selector.invalid_pin.hint', 'Verifica el PIN o selecciona un juego de la lista.')}</p>
            <button data-presenter-action="volver-juegos" class="px-6 py-3 rounded-full text-white font-bold uppercase transition shadow-lg" style="background:#8ab817;">
                <i class="fas fa-list mr-2"></i>${t('presenter.selector.actions.show_games_available', 'Mostrar juegos disponibles')}
            </button>
        </div>
    `);
}

function renderVistaErrorConexionPin() {
    mostrarLobbyMain(`
        <div data-presenter-view="connection-error" class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
            <i class="fas fa-exclamation-triangle text-yellow-500 text-8xl mb-6"></i>
            <h1 class="text-4xl font-black text-white mb-4">${t('presenter.selector.connection_error.title', 'Error de conexion')}</h1>
            <p class="text-slate-400 mb-6">${t('presenter.selector.connection_error.message', 'No se pudo validar el PIN. Intenta de nuevo.')}</p>
            <button data-presenter-action="reload-page" class="px-6 py-3 rounded-full text-white font-bold uppercase transition shadow-lg" style="background:#f9b518;color:#1a1a1a;">
                <i class="fas fa-redo mr-2"></i>${t('presenter.selector.actions.retry', 'Reintentar')}
            </button>
        </div>
    `);
}

function renderVistaErrorCargaPins(errorMessage) {
    mostrarLobbyMain(`
        <div data-presenter-view="load-error" class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
            <i class="fas fa-exclamation-triangle text-red-500 text-8xl mb-6"></i>
            <h1 class="text-4xl font-black text-white mb-4">${t('presenter.selector.load_error.title', 'Error al cargar PINs')}</h1>
            <p class="text-slate-400 mb-6">${errorMessage || ''}</p>
            <button data-presenter-action="volver-juegos" class="px-6 py-3 rounded-full text-white font-bold uppercase transition shadow-lg" style="background:#8ab817;">
                <i class="fas fa-list mr-2"></i>${t('presenter.selector.actions.show_games', 'Mostrar juegos')}
            </button>
            <a href="/index.html" class="mt-4 px-6 py-3 rounded-full font-bold uppercase transition shadow-lg" style="background:#f9b518;color:#1a1a1a;">
                <i class="fas fa-arrow-left mr-2"></i> ${t('presenter.selector.actions.back_home', 'Volver a la Pagina principal')}
            </a>
        </div>
    `);
}

/**
 * Selección de PIN directa desde URL
 */
export async function mostrarSeleccionModoDirecto(selectedPin) {
    try {
        const response = await fetch(`/api/quizzes/validate/${selectedPin}`);
        const data = await response.json();

        if (!data.exists) {
            renderVistaPinNoValido(selectedPin);
            return;
        }

        mostrarSeleccionModo(selectedPin);
    } catch (err) {
        console.error('Error validando PIN:', err);
        renderVistaErrorConexionPin();
    }
}

/**
 * Mostrar selector de PIN
 */
export async function mostrarSelectorPIN() {
    try {
        const response = await fetch('/api/presenter-pins');

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data?.error || data?.message || `Error HTTP ${response.status}`);
        }

        if (data.error) {
            throw new Error(data.error);
        }

        if (!Array.isArray(data)) {
            throw new Error('Respuesta inválida del servidor');
        }

        todosLosPins = data;
        ultimoErrorCargaPins = '';
        renderizarPINs();
    } catch (err) {
        console.error('Error cargando PINs:', err);
        ultimoErrorCargaPins = err?.message || '';
        renderVistaErrorCargaPins(ultimoErrorCargaPins);
    }
}

export function cambiarFiltro(tipo) {
    filtroActivo = tipo;
    renderizarPINs();
}

function renderizarPINs() {
    const pinsTextos = {
        'Juego Personalizado': t('presenter.selector.filter.custom.long', 'Juegos Personalizados'),
        'Juego': t('presenter.selector.filter.games.long', 'Juegos'),
        'Banco': t('presenter.selector.filter.banks.long', 'Bancos de Preguntas'),
        'Trivial': t('presenter.selector.filter.trivial', 'Trivial')
    };

    const pinsFiltrados = filtroActivo === 'todos'
        ? todosLosPins
        : todosLosPins.filter(p => p.type === filtroActivo);

    mostrarLobbyMain(`
        <div data-presenter-view="pin-selector" class="h-full w-full flex flex-col items-center pt-10 px-10 pb-16 overflow-y-auto">
            <div class="flex items-center gap-6 mb-6">
                <img src="/images/logo.svg" style="width: clamp(180px, 35vw, 400px);" class="mb-6">
            </div>
            <h1 class="text-5xl font-black italic text-white mb-3 uppercase">${t('presenter.selector.title', 'Selecciona un PIN')}</h1>
            <p class="text-xl mb-6" style="color:rgba(255,255,255,0.85);text-shadow:0 1px 6px rgba(0,0,0,0.45);">${t('presenter.selector.subtitle', 'Elige el juego o banco que deseas presentar')}</p>
            
            <div class="flex gap-3 mb-8 flex-wrap justify-center">
                <button data-presenter-action="change-filter" data-filter="Juego Personalizado" 
                        class="px-6 py-3 rounded-full font-bold uppercase transition-all shadow-md ${filtroActivo === 'Juego Personalizado' ? 'scale-110 shadow-lg' : ''}"
                        style="${filtroActivo === 'Juego Personalizado' ? 'background:linear-gradient(135deg,#14b8a6,#0d9488);color:#fff;' : 'background:rgba(255,255,255,0.12);color:#cbd5e1;'}">
                    <i class="fas fa-star mr-2"></i>${t('presenter.selector.filter.custom', 'Personalizados')}
                </button>
                <button data-presenter-action="change-filter" data-filter="Juego" 
                        class="px-6 py-3 rounded-full font-bold uppercase transition-all shadow-md ${filtroActivo === 'Juego' ? 'scale-110 shadow-lg' : ''}"
                        style="${filtroActivo === 'Juego' ? 'background:#8ab817;color:#fff;' : 'background:rgba(255,255,255,0.12);color:#cbd5e1;'}">
                    <i class="fas fa-gamepad mr-2"></i>${t('presenter.selector.filter.games', 'Juegos')}
                </button>
                <button data-presenter-action="change-filter" data-filter="Banco" 
                        class="px-6 py-3 rounded-full font-bold uppercase transition-all shadow-md ${filtroActivo === 'Banco' ? 'scale-110 shadow-lg' : ''}"
                        style="${filtroActivo === 'Banco' ? 'background:#f9b518;color:#1a1a1a;' : 'background:rgba(255,255,255,0.12);color:#cbd5e1;'}">
                    <i class="fas fa-database mr-2"></i>${t('presenter.selector.filter.banks', 'Bancos')}
                </button>
                <button data-presenter-action="change-filter" data-filter="Trivial" 
                        class="px-6 py-3 rounded-full font-bold uppercase transition-all shadow-md ${filtroActivo === 'Trivial' ? 'scale-110 shadow-lg' : ''}"
                        style="${filtroActivo === 'Trivial' ? 'background:#e65453;color:#fff;' : 'background:rgba(255,255,255,0.12);color:#cbd5e1;'}">
                    <i class="fas fa-dice mr-2"></i>${t('presenter.selector.filter.trivial', 'Trivial')}
                </button>
                <button data-presenter-action="change-filter" data-filter="todos" 
                        class="px-6 py-3 rounded-full font-bold uppercase transition-all shadow-md ${filtroActivo === 'todos' ? 'scale-110 shadow-lg' : ''}"
                        style="${filtroActivo === 'todos' ? 'background:#f9b518;color:#1a1a1a;' : 'background:rgba(255,255,255,0.12);color:#cbd5e1;'}">
                    <i class="fas fa-th mr-2"></i>${t('presenter.selector.filter.all', 'Todos')}
                </button>
            </div>

            <div class="w-full max-w-7xl flex flex-wrap gap-6 mb-8 justify-center">
                ${pinsFiltrados.length === 0 ?
            `<div class="w-full text-center">
                        <p class="text-slate-500 text-xl">
                            ${filtroActivo === 'Juego Personalizado'
                ? t('presenter.selector.empty.custom', 'No hay PINs disponibles. Crea un juego o banco primero.')
                : t('presenter.selector.empty.by_type', 'No hay {type} disponibles.', { type: pinsTextos[filtroActivo] || filtroActivo })}
                        </p>
                    </div>` :
            pinsFiltrados.map(p => {
                const cardColors = {
                    'Juego Personalizado': { bg: 'linear-gradient(135deg,#0d9488,#044f49)', border: '#033b36', text: '#ccfbf1' },
                    'Juego': { bg: 'linear-gradient(135deg,#8ab817,#5a7a0f)', border: '#455c09', text: '#d9f199' },
                    'Banco': { bg: 'linear-gradient(135deg,#d97706,#b45309)', border: '#92400e', text: '#fde68a' },
                    'Trivial': { bg: 'linear-gradient(135deg,#e65453,#b91c1c)', border: '#7f1d1d', text: '#fecaca' },
                };
                const c = cardColors[p.type] || { bg: 'linear-gradient(135deg,#f9b518,#d49500)', border: '#a37200', text: '#fef9c3' };
                const typeLabel = pinsTextos[p.type] || p.type;
                return `
                            <div data-presenter-action="select-pin" data-pin="${p.pin}" 
                             class="p-6 rounded-3xl cursor-pointer transition-all hover:scale-105 shadow-2xl flex flex-col justify-between min-h-[180px] w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[calc(25%-18px)]"
                             style="background:${c.bg};border-bottom:4px solid ${c.border};">
                            <div class="mb-4">
                                <div class="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full inline-block mb-3">
                                    <span class="text-white font-bold text-xs uppercase">${typeLabel}</span>
                                </div>
                                <h3 class="text-3xl font-black italic text-white mb-2">${p.pin}</h3>
                                <p class="text-sm line-clamp-2" style="color:${c.text}">${p.name}</p>
                                ${p.question_count !== undefined ? `<p class="text-xs mt-1" style="color:${c.text}">${p.question_count} ${t('presenter.selector.card.questions', 'preguntas')}</p>` : ''}
                            </div>
                            <div class="flex items-center justify-between text-xs" style="color:${c.text}">
                                <span><i class="fas fa-play-circle mr-1"></i> ${t('presenter.selector.card.play', 'Clic para jugar')}</span>
                            </div>
                        </div>
                    `;
            }).join('')
        }
            </div>
            <a href="/index.html" class="px-6 py-3 rounded-full font-bold uppercase transition shadow-lg" style="background:#f9b518;color:#1a1a1a;">
                <i class="fas fa-arrow-left mr-2"></i> ${t('presenter.selector.actions.back_home', 'Volver a la Pagina principal')}
            </a>
        </div>
    `);
}

export function seleccionarPIN(selectedPin) {
    mostrarSeleccionModo(selectedPin);
}

export function rerenderCurrentLobbyView() {
    const lobbyMain = document.getElementById('lobby-main');
    const viewNode = lobbyMain?.querySelector?.('[data-presenter-view]');
    if (!viewNode) return;

    const view = viewNode.dataset.presenterView;
    const pin = viewNode.dataset.pin || '';

    if (view === 'pin-selector') {
        renderizarPINs();
        return;
    }

    if (view === 'mode-selection' && pin) {
        mostrarSeleccionModo(pin);
        return;
    }

    if (view === 'invalid-pin' && pin) {
        renderVistaPinNoValido(pin);
        return;
    }

    if (view === 'connection-error') {
        renderVistaErrorConexionPin();
        return;
    }

    if (view === 'load-error') {
        renderVistaErrorCargaPins(ultimoErrorCargaPins);
    }
}

export function mostrarSeleccionModo(selectedPin) {
    mostrarLobbyMain(`
        <div data-presenter-view="mode-selection" data-pin="${selectedPin}" class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
            <div class="flex items-center gap-6 mb-6">
                <img src="/images/logo.svg" style="width: clamp(180px, 35vw, 400px);">
            </div>
            <h1 class="text-5xl font-black italic text-white mb-3 uppercase">${t('presenter.selector.mode.title', 'Como quieres jugar?')}</h1>
            <p class="text-slate-200 text-xl mb-8">${t('presenter.selector.mode.pin_label', 'PIN')}: <span class="font-mono px-4 py-2 rounded-lg font-black" style="background:#f9b518;color:#1a1a1a;">${selectedPin}</span></p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full mb-8">
                 <div data-presenter-action="select-individual-mode" data-pin="${selectedPin}" 
                     class="p-10 rounded-3xl cursor-pointer transition-all hover:scale-105 shadow-2xl flex flex-col items-center justify-center min-h-[300px]"
                     style="background:linear-gradient(135deg,#8ab817,#5a7a0f);border-bottom:4px solid #455c09;">
                    <i class="fas fa-user text-8xl text-white mb-6"></i>
                    <h2 class="text-3xl font-black text-white mb-3">${t('presenter.selector.mode.individual.title', 'INDIVIDUAL')}</h2>
                    <p class="text-center" style="color:#d9f199;">${t('presenter.selector.mode.individual.desc', 'Cada jugador compite por su cuenta')}</p>
                </div>
                
                 <div data-presenter-action="show-team-config" data-pin="${selectedPin}" 
                     class="p-10 rounded-3xl cursor-pointer transition-all hover:scale-105 shadow-2xl flex flex-col items-center justify-center min-h-[300px]"
                     style="background:linear-gradient(135deg,#f9b518,#d49500);border-bottom:4px solid #a37200;">
                    <i class="fas fa-users text-8xl mb-6" style="color:#fff;"></i>
                    <h2 class="text-3xl font-black mb-3" style="color:#fff;">${t('presenter.selector.mode.teams.title', 'POR EQUIPOS')}</h2>
                    <p class="text-center" style="color:rgba(255,255,255,0.85);">${t('presenter.selector.mode.teams.desc', 'Los jugadores se unen en equipos y compiten juntos')}</p>
                </div>
            </div>
            
            <button data-presenter-action="volver-juegos" class="px-6 py-3 rounded-full font-bold uppercase transition shadow-lg" style="background:#f9b518;color:#1a1a1a;">
                <i class="fas fa-arrow-left mr-2"></i> ${t('presenter.selector.actions.back_list', 'Volver a la lista')}
            </button>
        </div>
    `);
}

export function configurarModoIndividual(selectedPin) {
    console.log('🎯 Configurando modo individual para PIN:', selectedPin);

    // Actualizar estado
    setPin(selectedPin.toUpperCase());
    setIsTeamMode(false);
    setTeamConfig(null);

    // Actualizar URL sin recargar la página
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('pin', selectedPin.toUpperCase());
    newUrl.searchParams.set('mode', 'individual');
    newUrl.searchParams.delete('teams'); // Limpiar equipos si existían
    window.history.pushState({}, '', newUrl);

    // Iniciar lobby directamente
    iniciarLobby();
}

/**
 * Volver al selector de juegos
 */
export function volverAJuegos() {
    cleanupPodio();

    setConnectedPlayers([]);
    setPlayersData({});
    setTotalPlayers(0);

    // Limpiar AMBOS storages para evitar reconexiones automáticas a sesiones antiguas
    localStorage.removeItem('xiro_presenter_sessionId');
    localStorage.removeItem('xiro_presenter_pin');
    localStorage.removeItem('xiro_presenter_playerId');
    sessionStorage.removeItem('xiro_presenter_sessionId');
    sessionStorage.removeItem('xiro_presenter_pin');
    sessionStorage.removeItem('xiro_presenter_playerId');
    console.log('🧹 Storage limpiado, mostrando selector sin salir de pantalla completa...');

    // Resetear estado basico de presentador
    setPin(null);
    setSessionId(null);
    setIsTeamMode(false);
    setTeamConfig(null);

    // Limpiar parametros de URL sin recargar
    const newUrl = new URL(window.location.href);
    newUrl.search = '';
    window.history.replaceState({}, '', newUrl);

    // Mantener fullscreen si ya estaba activo
    if (!document.fullscreenElement) {
        const root = document.documentElement;
        if (root.requestFullscreen) {
            root.requestFullscreen().catch(() => { });
        } else if (root.webkitRequestFullscreen) {
            root.webkitRequestFullscreen();
        }
    }

    mostrarSelectorPIN();
}
