/**
 * @fileoverview Podio final del juego
 * Renderizado de ranking final con fuegos artificiales
 */

import { removeFloatingCards, hideAbandonButton } from './presenter-utils.js?v=20260828012635';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260828012635';
import { getPin, getGameSessionDbId } from './presenter-state.js?v=20260828012635';

// Variable global para el controlador de fuegos artificiales
let fireworksController = null;
let podiumLanguageListenerBound = false;

function tr(key, fallback) {
    return _t(key, null, fallback || key);
}

function escapeHtml(text) {
    return String(text || '').replace(/[&<>'"]/g, (char) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return map[char] || char;
    });
}

function buildFlickerWordHtml(word) {
    const chars = String(word || '').split('');
    if (chars.length === 0) return '';
    if (chars.length === 1) {
        return `<span class="flicker-slow">${escapeHtml(chars[0])}</span>`;
    }
    if (chars.length === 2) {
        return `<span class="flicker-slow">${escapeHtml(chars[0])}</span>${escapeHtml(chars[1])}`;
    }

    return `<span class="flicker-slow">${escapeHtml(chars[0])}</span>${escapeHtml(chars[1])}<span class="flicker-fast">${escapeHtml(chars[2])}</span>${escapeHtml(chars.slice(3).join(''))}`;
}

function buildPodiumTitleHtml(title) {
    const clean = String(title || '').trim();
    if (!clean) return '';

    const words = clean.split(/\s+/);
    if (words.length === 1) return buildFlickerWordHtml(words[0]);

    const lastWord = words.pop();
    return `${escapeHtml(words.join(' '))} ${buildFlickerWordHtml(lastWord)}`;
}

function refreshActivePodiumTitle() {
    const titleEl = document.querySelector('#lobby-main [data-xiro-podium-title="1"]');
    if (!titleEl) return;

    const isTeamMode = titleEl.dataset.podiumTeamMode === 'true';
    const titleKey = isTeamMode ? 'presenter.podio.teams_title' : 'presenter.podio.final_title';
    const titleFallback = isTeamMode ? 'Podio Equipos' : 'Podio Final';
    titleEl.innerHTML = _tHtml(buildPodiumTitleHtml(tr(titleKey, titleFallback)));
}

function bindPodiumLanguageRefresh() {
    if (podiumLanguageListenerBound) return;
    podiumLanguageListenerBound = true;
    window.addEventListener('xiro:language-changed', refreshActivePodiumTitle);
}

/**
 * Cargar configuración de fuegos artificiales
 */
async function loadFireworksConfig() {
    try {
        const response = await fetch('/api/ui-settings');
        if (!response.ok) throw new Error('Error al cargar configuración');
        const settings = await response.json();
        return {
            shellSize: settings.fireworksShellSize !== undefined ? settings.fireworksShellSize : 2,
            finaleMode: settings.fireworksFinaleMode !== false,
            simSpeed: settings.fireworksSimSpeed !== undefined ? settings.fireworksSimSpeed : 1,
            launchIntervalMin: settings.fireworksLaunchIntervalMin !== undefined ? settings.fireworksLaunchIntervalMin : 900,
            launchIntervalMax: settings.fireworksLaunchIntervalMax !== undefined ? settings.fireworksLaunchIntervalMax : 1500,
            maxFinaleCount: settings.fireworksMaxFinaleCount !== undefined ? settings.fireworksMaxFinaleCount : 32,
            trailIntensity: settings.fireworksTrailIntensity !== undefined ? settings.fireworksTrailIntensity : 0.175,
            starWidth: settings.fireworksStarWidth !== undefined ? settings.fireworksStarWidth : 3,
            sparkWidth: settings.fireworksSparkWidth !== undefined ? settings.fireworksSparkWidth : 1,
            soundEnabled: settings.fireworksSound === true
        };
    } catch (error) {
        console.warn('⚠️ Error al cargar configuración de fuegos, usando defaults:', error);
        return {
            shellSize: 2,
            finaleMode: true,
            simSpeed: 1,
            launchIntervalMin: 900,
            launchIntervalMax: 1500,
            maxFinaleCount: 32,
            trailIntensity: 0.175,
            starWidth: 3,
            sparkWidth: 1,
            soundEnabled: false
        };
    }
}

/**
 * Iniciar fuegos artificiales de fondo
 */
async function startFireworks() {
    // Detener fuegos previos si existen
    if (fireworksController) {
        fireworksController.destroy();
    }

    // Verificar que FireworksController esté disponible
    if (typeof FireworksController === 'undefined') {
        console.warn('⚠️ FireworksController no disponible, fuegos artificiales deshabilitados');
        return;
    }

    try {
        // Cargar configuración
        const config = await loadFireworksConfig();
        console.log('🎆 Configuración de fuegos artificiales:', config);

        // Crear contenedor para fuegos artificiales si no existe
        let fireworksContainer = document.getElementById('fireworks-podium-container');
        if (!fireworksContainer) {
            fireworksContainer = document.createElement('div');
            fireworksContainer.id = 'fireworks-podium-container';
            document.body.appendChild(fireworksContainer);
        }

        // Inicializar controlador con configuración
        fireworksController = new FireworksController('fireworks-podium-container');
        fireworksController.setShellSize(config.shellSize);
        fireworksController.setAutoLaunch(true); // Siempre activo
        fireworksController.setFinaleMode(config.finaleMode);
        fireworksController.simSpeed = config.simSpeed;

        // Configurar intervalos de lanzamiento
        fireworksController.launchIntervalMin = config.launchIntervalMin;
        fireworksController.launchIntervalMax = config.launchIntervalMax;

        // Configurar parámetros avanzados
        fireworksController.maxFinaleCount = config.maxFinaleCount;
        fireworksController.trailIntensity = config.trailIntensity;
        fireworksController.starWidth = config.starWidth;
        fireworksController.sparkWidth = config.sparkWidth;
        fireworksController.setSoundEnabled(config.soundEnabled);

        fireworksController.start();

        console.log('🎆 Fuegos artificiales iniciados con configuración personalizada');
    } catch (error) {
        console.error('❌ Error al iniciar fuegos artificiales:', error);
    }
}

/**
 * Detener y limpiar fuegos artificiales
 */
function stopFireworks() {
    if (fireworksController) {
        fireworksController.destroy();
        fireworksController = null;

        // Eliminar contenedor
        const container = document.getElementById('fireworks-podium-container');
        if (container) {
            container.remove();
        }

        console.log('🎆 Fuegos artificiales detenidos');
    }
}

/**
 * Renderizar podio final
 */
export function renderPodio(ranking) {
    console.log('🎯 Renderizando podio final. Ranking:', ranking);
    console.log('🎯 Longitud del ranking:', ranking ? ranking.length : 'undefined');

    removeFloatingCards();
    cleanupRevealElements(); // Eliminar paneles de ranking y justificación de la última pregunta

    // Verificar si es modo equipos
    const isTeamMode = ranking.length > 0 && ranking[0].isTeam;

    const podiumTitleHtml = isTeamMode
        ? buildPodiumTitleHtml(tr('presenter.podio.teams_title', 'Podio Equipos'))
        : buildPodiumTitleHtml(tr('presenter.podio.final_title', 'Podio Final'));

    bindPodiumLanguageRefresh();

    const teamColorClasses = {
        red: 'bg-red-600',
        blue: 'bg-blue-600',
        green: 'bg-green-600',
        yellow: 'bg-yellow-500',
        purple: 'bg-purple-600',
        pink: 'bg-pink-600',
        orange: 'bg-orange-600',
        cyan: 'bg-cyan-600',
        lime: 'bg-lime-500'
    };

    const lobbyMain = document.getElementById('lobby-main');
    console.log('🎯 lobby-main encontrado:', lobbyMain ? 'SÍ' : 'NO');

    if (!lobbyMain) {
        console.error('❌ lobby-main no existe en el DOM');
        return;
    }

    lobbyMain.style.display = 'flex';
    lobbyMain.innerHTML = _tHtml(`
        <div class="podium-content absolute inset-0 flex flex-col items-center justify-start text-center px-10 pt-8 pb-16 bg-black gap-6 overflow-y-auto">
            <h1 class="neon podium-title uppercase" data-xiro-podium-title="1" data-podium-team-mode="${isTeamMode ? 'true' : 'false'}">${podiumTitleHtml}</h1>
            <div class="w-full max-w-2xl space-y-4">
                ${(() => {
        const rows = ranking.slice(0, 10);
        const total = rows.length;
        // Suspense: lowest rank appears first, the winner appears last.
        return rows.map((p, i) => {
            const bgClass = isTeamMode
                ? (p.color && teamColorClasses[p.color] ? teamColorClasses[p.color] + ' text-white' : 'bg-white/10 text-white')
                : (i === 0 ? 'bg-yellow-400 text-slate-900 scale-105' : 'bg-white/10 text-white');
            const icon = isTeamMode ? '<i class="fas fa-users mr-3"></i>' : '';
            const delay = ((total - 1 - i) * 0.12).toFixed(2);
            return `
                        <div class="podium-row flex justify-between items-center p-6 rounded-3xl ${bgClass} border-b-4 border-black/20" style="animation-delay:${delay}s">
                            <span class="text-3xl font-black uppercase italic">${icon}${i + 1}º ${p.name}</span>
                            <span class="podium-score text-4xl font-black">${p.scoreLabel || (p.pts + ' PTS')}</span>
                        </div>`;
        }).join('');
    })()}
            </div>
            <button data-presenter-action="conclude-and-home" class="mt-12 bg-purple-600 hover:bg-purple-500 px-8 py-3 rounded-full text-white font-bold uppercase transition shadow-lg">
                <i class="fas fa-list mr-2"></i>${_t('presenter.podio.show_games', null, 'Mostrar juegos')}
            </button>

        </div>`);

    // Ocultar botón de abandonar en pantalla final de podio
    hideAbandonButton();

    // Reemplazar la mascota del camaleón con la imagen de game over
    const chamaleonEl = document.getElementById('chamaleon-overlay');
    if (chamaleonEl) {
        const img = chamaleonEl.querySelector('img');
        if (img) img.src = '/images/chamaleon/gameover.svg';
        chamaleonEl.style.bottom = '60px';
        chamaleonEl.style.left = '16px';
        chamaleonEl.style.top = '';
        chamaleonEl.style.right = '';
        chamaleonEl.style.opacity = '1';
    } else {
        const el = document.createElement('div');
        el.id = 'chamaleon-overlay';
        el.style.cssText = 'position:fixed;bottom:60px;left:16px;z-index:500;opacity:1;pointer-events:none';
        const img = document.createElement('img');
        img.src = '/images/chamaleon/gameover.svg';
        img.alt = '';
        img.style.cssText = 'width:170px;height:170px;object-fit:contain;display:block';
        el.appendChild(img);
        document.body.appendChild(el);
    }

    // Iniciar fuegos artificiales de fondo
    setTimeout(() => {
        startFireworks();
    }, 500); // Pequeño delay para que el DOM se renderice primero
}

/**
 * Limpiar recursos del podio (llamar antes de cambiar de pantalla)
 */
export function cleanupPodio() {
    stopFireworks();
}
