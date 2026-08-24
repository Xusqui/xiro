/**
 * @fileoverview Configuración de equipos del presentador
 * Maneja todo el flujo de configuración de equipos: nombres, colores, validación
 */

import { mostrarLobbyMain } from './presenter-utils.js?v=20260824101409';
import { setPin, setIsTeamMode, setTeamConfig } from './presenter-state.js?v=20260824101409';
import { mostrarModalMensaje } from '../shared/modal.js?v=20260824101409';
import { iniciarLobby } from './presenter-lobby-init.js?v=20260824101409';
import { mostrarSeleccionModo } from './presenter-lobby.js?v=20260824101409';

let uiSettingsRefreshPromise = null;

async function refreshUiSettingsFromServer() {
    if (uiSettingsRefreshPromise) {
        return uiSettingsRefreshPromise;
    }

    uiSettingsRefreshPromise = fetch(`/api/ui-settings?ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`ui-settings HTTP ${response.status}`);
            }
            return response.json();
        })
        .then((settings) => {
            window.__xiroUiSettings = settings;
            return settings;
        })
        .catch((error) => {
            console.warn('No se pudieron refrescar los ui-settings para equipos:', error);
            return window.__xiroUiSettings || null;
        })
        .finally(() => {
            uiSettingsRefreshPromise = null;
        });

    return uiSettingsRefreshPromise;
}

// ===== CONSTANTES =====

// Nombres por defecto para equipos (i18n keys: presenter.team.default.1 - .9)
// Si el admin ha personalizado nombres, éstos se usan como sugerencias adicionales.
function getDefaultTeamNames() {
    const i18nDefaults = [
        _t('presenter.team.default.8', 'Relámpagos'),
        _t('presenter.team.default.1', 'Campeones'),
        _t('presenter.team.default.5', 'Halcones'),
        _t('presenter.team.default.9', 'Titanes'),
        _t('presenter.team.default.6', 'Invencibles'),
        _t('presenter.team.default.4', 'Guerreros'),
        _t('presenter.team.default.3', 'Fénix'),
        _t('presenter.team.default.2', 'Dragones'),
        _t('presenter.team.default.7', 'Leones')
    ];
    // Opción 3: nombres del admin como sugerencias adicionales que el presentador puede editar
    const adminNames = window.__xiroUiSettings && Array.isArray(window.__xiroUiSettings.teamNames)
        ? window.__xiroUiSettings.teamNames
        : [];
    return i18nDefaults.map((name, i) => (adminNames[i] && adminNames[i].trim()) ? adminNames[i].trim() : name);
}

// Colores disponibles para equipos
function getTeamColors() {
    return [
        { name: _t('presenter.team.color.red', 'Rojo'), value: 'red', bg: 'bg-red-600', hover: 'hover:bg-red-700' },
        { name: _t('presenter.team.color.blue', 'Azul'), value: 'blue', bg: 'bg-blue-600', hover: 'hover:bg-blue-700' },
        { name: _t('presenter.team.color.green', 'Verde'), value: 'green', bg: 'bg-green-600', hover: 'hover:bg-green-700' },
        { name: _t('presenter.team.color.yellow', 'Amarillo'), value: 'yellow', bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600' },
        { name: _t('presenter.team.color.purple', 'Morado'), value: 'purple', bg: 'bg-purple-600', hover: 'hover:bg-purple-700' },
        { name: _t('presenter.team.color.pink', 'Rosa'), value: 'pink', bg: 'bg-pink-600', hover: 'hover:bg-pink-700' },
        { name: _t('presenter.team.color.orange', 'Naranja'), value: 'orange', bg: 'bg-orange-600', hover: 'hover:bg-orange-700' },
        { name: _t('presenter.team.color.cyan', 'Cyan'), value: 'cyan', bg: 'bg-cyan-600', hover: 'hover:bg-cyan-700' },
        { name: _t('presenter.team.color.lime', 'Lima'), value: 'lime', bg: 'bg-lime-500', hover: 'hover:bg-lime-600' },
    ];
}

// Estilos de color para renderizado
export const TEAM_COLOR_STYLES = {
    red: { solid: '#ef4444', tint: 'rgba(239, 68, 68, 0.18)', text: '#ffe4e6' },
    blue: { solid: '#3b82f6', tint: 'rgba(59, 130, 246, 0.18)', text: '#dbeafe' },
    green: { solid: '#22c55e', tint: 'rgba(34, 197, 94, 0.18)', text: '#dcfce7' },
    yellow: { solid: '#eab308', tint: 'rgba(234, 179, 8, 0.18)', text: '#fef9c3' },
    purple: { solid: '#a855f7', tint: 'rgba(168, 85, 247, 0.18)', text: '#ede9fe' },
    pink: { solid: '#ec4899', tint: 'rgba(236, 72, 153, 0.18)', text: '#fce7f3' },
    orange: { solid: '#f97316', tint: 'rgba(249, 115, 22, 0.18)', text: '#ffedd5' },
    cyan: { solid: '#06b6d4', tint: 'rgba(6, 182, 212, 0.18)', text: '#cffafe' },
    lime: { solid: '#84cc16', tint: 'rgba(132, 204, 22, 0.18)', text: '#ecfccb' },
    fallback: { solid: '#7c3aed', tint: 'rgba(124, 58, 237, 0.18)', text: '#e9d5ff' }
};

const TEAM_NAME_PATTERN = /^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s._-]+$/;
const TEAM_NAME_MIN = 2;
const TEAM_NAME_MAX = 30;

/**
 * Obtener estilo de color para un equipo
 */
export function getTeamColorStyle(colorKey) {
    return TEAM_COLOR_STYLES[colorKey] || TEAM_COLOR_STYLES.fallback;
}

// ===== PANTALLAS DE CONFIGURACIÓN =====

/**
 * Mostrar selector de cantidad de equipos
 */
export function mostrarConfiguracionEquipos(selectedPin) {
    // Refresca en paralelo para que la siguiente pantalla use nombres actualizados.
    void refreshUiSettingsFromServer();

    mostrarLobbyMain(`
        <div class="h-full w-full flex flex-col items-center pt-10 px-10 pb-16 overflow-y-auto">
            <div class="flex items-center gap-6 mb-6">
                <img src="/images/logo.svg" style="width: clamp(180px, 35vw, 400px);">
            </div>
            <h1 class="text-5xl font-black italic text-white mb-3 uppercase">Configurar Equipos</h1>
            <p class="text-slate-400 text-xl mb-8">PIN: <span class="font-mono bg-purple-600 px-4 py-2 rounded-lg">${selectedPin}</span></p>
            
            <div class="bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-4xl w-full mb-6">
                <label class="text-white font-bold text-xl mb-4 block">¿Cuántos equipos?</label>
                <div class="grid grid-cols-4 gap-4 mb-8">
                    <button data-presenter-action="team-count" data-num-teams="2" data-pin="${selectedPin}" class="bg-purple-600 hover:bg-purple-700 text-white font-black text-2xl py-6 rounded-xl transition">2</button>
                    <button data-presenter-action="team-count" data-num-teams="3" data-pin="${selectedPin}" class="bg-purple-600 hover:bg-purple-700 text-white font-black text-2xl py-6 rounded-xl transition">3</button>
                    <button data-presenter-action="team-count" data-num-teams="4" data-pin="${selectedPin}" class="bg-purple-600 hover:bg-purple-700 text-white font-black text-2xl py-6 rounded-xl transition">4</button>
                    <button data-presenter-action="team-count" data-num-teams="5" data-pin="${selectedPin}" class="bg-purple-600 hover:bg-purple-700 text-white font-black text-2xl py-6 rounded-xl transition">5</button>
                </div>
                <div class="grid grid-cols-4 gap-4">
                    <button data-presenter-action="team-count" data-num-teams="6" data-pin="${selectedPin}" class="bg-purple-600 hover:bg-purple-700 text-white font-black text-2xl py-6 rounded-xl transition">6</button>
                    <button data-presenter-action="team-count" data-num-teams="7" data-pin="${selectedPin}" class="bg-purple-600 hover:bg-purple-700 text-white font-black text-2xl py-6 rounded-xl transition">7</button>
                    <button data-presenter-action="team-count" data-num-teams="8" data-pin="${selectedPin}" class="bg-purple-600 hover:bg-purple-700 text-white font-black text-2xl py-6 rounded-xl transition">8</button>
                    <button data-presenter-action="team-count" data-num-teams="9" data-pin="${selectedPin}" class="bg-purple-600 hover:bg-purple-700 text-white font-black text-2xl py-6 rounded-xl transition">9</button>
                </div>
            </div>
            
            <button data-presenter-action="show-mode-selection" data-pin="${selectedPin}" class="bg-white/20 px-6 py-3 rounded-full text-white font-bold uppercase hover:bg-white/30 transition">
                <i class="fas fa-arrow-left mr-2"></i> Volver
            </button>
        </div>
    `);
}

/**
 * Mostrar formulario de nombres y colores para equipos
 */
export async function seleccionarNumEquipos(numTeams, selectedPin) {
    // Asegura nombres de equipo al día antes de renderizar los inputs.
    await refreshUiSettingsFromServer();

    mostrarLobbyMain(`
        <div class="h-full w-full flex flex-col items-center pt-10 px-10 pb-16 overflow-y-auto">
            <div class="flex items-center gap-6 mb-6">
                <img src="/images/logo.svg" style="width: clamp(180px, 35vw, 400px);">
            </div>
            <h1 class="text-5xl font-black italic text-white mb-3 uppercase">Nombra los ${numTeams} Equipos</h1>
            <p class="text-slate-400 text-xl mb-8">Asigna un nombre y color a cada equipo</p>
            
            <div class="bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-4xl w-full mb-6">
                <div id="teams-form" class="space-y-6">
                    ${Array.from({ length: numTeams }, (_, i) => `
                        <div class="flex gap-4 items-center">
                            <span class="text-white font-black text-2xl w-12">#${i + 1}</span>
                            <input type="text" id="team-name-${i}" 
                                   placeholder="Nombre del equipo ${i + 1}" 
                                   value="${getDefaultTeamNames()[i] || 'Equipo ' + (i + 1)}"
                                   class="flex-1 p-4 border-4 border-slate-700 bg-slate-900 text-white rounded-xl font-bold text-xl focus:border-purple-500 outline-none">
                            <select id="team-color-${i}"
                                    data-presenter-change="team-colors"
                                    data-num-teams="${numTeams}"
                                    class="w-56 shrink-0 p-4 border-4 border-slate-700 bg-slate-900 text-white rounded-xl font-bold text-lg focus:border-purple-500 outline-none">
                                ${getTeamColors().map((color, idx) => `
                                    <option value="${color.value}" ${idx === i % getTeamColors().length ? 'selected' : ''}>${color.name}</option>
                                `).join('')}
                            </select>
                        </div>
                    `).join('')}
                </div>
                
                <button data-presenter-action="confirm-teams" data-num-teams="${numTeams}" data-pin="${selectedPin}" 
                        class="w-full mt-8 bg-green-600 hover:bg-green-700 text-white font-black text-2xl py-6 rounded-xl transition shadow-xl">
                    <i class="fas fa-check mr-2"></i> CONFIRMAR Y CONTINUAR
                </button>
            </div>
            
            <button data-presenter-action="show-team-config" data-pin="${selectedPin}" class="bg-white/20 px-6 py-3 rounded-full text-white font-bold uppercase hover:bg-white/30 transition">
                <i class="fas fa-arrow-left mr-2"></i> Volver
            </button>
        </div>
    `);
    setTimeout(() => updateColorOptions(numTeams), 0);
}

/**
 * Confirmar configuración de equipos y iniciar lobby
 */
export function confirmarEquipos(numTeams, selectedPin) {
    console.log('🎯 Confirmando equipos para PIN:', selectedPin);

    const teams = [];
    for (let i = 0; i < numTeams; i++) {
        const nameInput = document.getElementById(`team-name-${i}`);
        const rawName = nameInput?.value.trim() || getDefaultTeamNames()[i] || `${_t('presenter.team.label', 'Equipo')} ${i + 1}`;
        if (!isValidTeamName(rawName)) {
            mostrarModalMensaje(
                _t('presenter.team.name_invalid', 'Nombre inválido'),
                _t('presenter.team.name_validation', 'El nombre del equipo solo puede contener letras, números, espacios y guiones (2-30 caracteres).'),
                'warning'
            );
            if (nameInput) {
                nameInput.focus();
                nameInput.select();
            }
            return;
        }
        const colorValue = document.getElementById(`team-color-${i}`).value;
        const colorObj = getTeamColors().find(c => c.value === colorValue);

        teams.push({
            name: rawName,
            color: colorValue,
            colorName: colorObj.name,
            bg: colorObj.bg,
            hover: colorObj.hover,
            players: [],
            score: 0
        });
    }

    console.log('✅ Equipos configurados:', teams);

    // Actualizar estado
    setPin(selectedPin.toUpperCase());
    setIsTeamMode(true);
    setTeamConfig({ teams: teams });

    // Actualizar URL sin recargar la página
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('pin', selectedPin.toUpperCase());
    newUrl.searchParams.set('mode', 'teams');
    newUrl.searchParams.set('teams', encodeURIComponent(JSON.stringify(teams)));
    window.history.pushState({}, '', newUrl);

    // Iniciar lobby directamente
    iniciarLobby();
}

function isValidTeamName(name) {
    if (!name) return false;
    const lengthOk = name.length >= TEAM_NAME_MIN && name.length <= TEAM_NAME_MAX;
    return lengthOk && TEAM_NAME_PATTERN.test(name);
}

/**
 * Actualizar opciones de color para evitar duplicados
 */
export function updateColorOptions(numTeams) {
    const selectedColors = [];
    for (let i = 0; i < numTeams; i++) {
        const select = document.getElementById(`team-color-${i}`);
        if (select) {
            selectedColors.push(select.value);
        }
    }

    for (let i = 0; i < numTeams; i++) {
        const select = document.getElementById(`team-color-${i}`);
        if (!select) continue;

        const currentValue = select.value;

        select.innerHTML = _tHtml(getTeamColors().map(color => {
            const isUsed = selectedColors.includes(color.value) && color.value !== currentValue;
            return `<option value="${color.value}" ${isUsed ? 'disabled' : ''}>${color.name}${isUsed ? ` ${_t('presenter.team.in_use', '(en uso)')}` : ''}</option>`;
        }).join(''));

        select.value = currentValue;
    }
}
