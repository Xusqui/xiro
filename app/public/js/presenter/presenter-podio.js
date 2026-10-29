/**
 * @fileoverview Podio final del juego
 * Renderizado de ranking final con fuegos artificiales. Con «Podio 3D» y WebGL2, los tres
 * primeros suben como bloques 3D (podium3d/) y el resto queda en filas debajo; si el 3D
 * falla, las filas de los tres primeros vuelven a verse.
 */

import { removeFloatingCards, hideAbandonButton } from './presenter-utils.js?v=20260922172926';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260922172926';
import { restRowDelay, startPodiumReveal } from './presenter-podio-reveal.js?v=20260922172926';
import { startFireworks, stopFireworks } from './presenter-podio-fireworks.js?v=20261024120000';
import { mountPodium3d, podiumEntries, wantsPodium3d } from './podium3d/podium3d.js?v=20261024120000';
import { createChamaleonImage } from './presenter-chamaleon.js?v=20260922172926';

const PODIUM_3D_STAGE =
    '<div class="podium3d-stage" aria-hidden="true"><canvas class="podium3d-canvas"></canvas><div class="podium3d-labels"></div></div>';

const TEAM_COLOR_CLASSES = {
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

let podiumLanguageListenerBound = false;
let podium3d = null;
let cancelPodiumReveal = null;

function tr(key, fallback) {
    return _t(key, null, fallback || key);
}

function escapeHtml(text) {
    return String(text || '').replace(/[&<>'"]/g, char => {
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

/** Arranca el podio 3D; si no carga o pierde el contexto, quita el lienzo y las filas vuelven. */
function mountPodium3dIfWanted(lobbyMain, ranking, use3d) {
    podium3d?.destroy();
    podium3d = null;
    if (!use3d) return;
    const content = lobbyMain.querySelector('.podium-content');
    const stage = content.querySelector('.podium3d-stage');
    podium3d = mountPodium3d({
        stage,
        entries: podiumEntries(ranking, TEAM_COLOR_CLASSES),
        onFail: () => {
            content.classList.remove('podium-content--3d');
            stage.remove();
            podium3d = null;
        }
    });
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

    const lobbyMain = document.getElementById('lobby-main');
    console.log('🎯 lobby-main encontrado:', lobbyMain ? 'SÍ' : 'NO');

    if (!lobbyMain) {
        console.error('❌ lobby-main no existe en el DOM');
        return;
    }

    const use3d = ranking.length > 0 && wantsPodium3d();

    lobbyMain.style.display = 'flex';
    lobbyMain.innerHTML = _tHtml(`
        <div class="podium-content podium-stage ${use3d ? 'podium-content--3d' : ''} absolute inset-0 flex flex-col items-center justify-start text-center px-10 pt-8 pb-16 gap-6 overflow-y-auto">
            <h1 class="neon podium-title uppercase" data-xiro-podium-title="1" data-podium-team-mode="${isTeamMode ? 'true' : 'false'}">${podiumTitleHtml}</h1>
            ${use3d ? PODIUM_3D_STAGE : ''}
            <div class="podium-list w-full max-w-2xl space-y-4">
                ${(() => {
                    const rows = ranking.slice(0, 10);
                    const total = rows.length;
                    // Suspense: lowest rank appears first, the winner appears last.
                    return rows
                        .map((p, i) => {
                            const bgClass = isTeamMode
                                ? p.color && TEAM_COLOR_CLASSES[p.color]
                                    ? TEAM_COLOR_CLASSES[p.color] + ' text-white'
                                    : 'bg-white/10 text-white'
                                : ['bg-yellow-400 text-slate-900 scale-105', 'podium-silver', 'podium-bronze'][i] ||
                                  'bg-white/10 text-white';
                            const icon = isTeamMode ? '<i class="fas fa-users mr-3"></i>' : '';
                            // Del 10º al 4º, rápido; el 3º, 2º y 1º esperan su nota (presenter-podio-reveal.js)
                            const top = i < 3;
                            const delay = top ? 0 : restRowDelay(i, total).toFixed(2);
                            return `
                        <div class="podium-row ${top ? 'podium-row-wait' : ''} flex justify-between items-center p-6 rounded-3xl ${bgClass} border-b-4 border-black/20" data-place="${i + 1}" style="animation-delay:${delay}s">
                            <span class="text-3xl font-black uppercase italic">${icon}${i + 1}º ${escapeHtml(p.name)}</span>
                            <span class="podium-score text-4xl font-black">${p.scoreLabel || p.pts + ' PTS'}</span>
                        </div>`;
                        })
                        .join('');
                })()}
            </div>
            ${isTeamMode ? `<p class="podium-team-note">${_t('presenter.podio.team_score_note', null, 'Puntuación de equipo: media de sus jugadores, ajustada cuando los equipos tienen distinto tamaño')}</p>` : ''}
            <button data-presenter-action="conclude-and-home" class="podium-home-btn bg-plum-600 hover:bg-plum-500 px-8 py-3 rounded-full text-white font-bold uppercase transition shadow-lg">
                <i class="fas fa-list mr-2"></i>${_t('presenter.podio.show_games', null, 'Mostrar juegos')}
            </button>

        </div>`);

    mountPodium3dIfWanted(lobbyMain, ranking, use3d);
    cancelPodiumReveal?.();
    cancelPodiumReveal = startPodiumReveal(lobbyMain, Math.min(ranking.length, 10), place => podium3d?.reveal(place));

    // Ocultar botón de abandonar en pantalla final de podio
    hideAbandonButton();

    // Reemplazar la mascota del camaleón con la imagen de game over
    const chamaleonEl = document.getElementById('chamaleon-overlay');
    if (chamaleonEl) {
        const img = chamaleonEl.querySelector('img');
        if (img) img.src = '/images/chamaleon/gameover.svg';
        // Por encima del botón ⋯ del menú (bottom 1.25rem + 3rem)
        chamaleonEl.style.bottom = '84px';
        chamaleonEl.style.left = '16px';
        chamaleonEl.style.top = '';
        chamaleonEl.style.right = '';
        chamaleonEl.style.opacity = '1';
    } else {
        const el = document.createElement('div');
        el.id = 'chamaleon-overlay';
        el.style.cssText = 'position:fixed;bottom:84px;left:16px;z-index:500;opacity:1;pointer-events:none';
        el.appendChild(createChamaleonImage('gameover.svg'));
        document.body.appendChild(el);
    }

    // Iniciar fuegos artificiales de fondo (con el 3D, detrás del podio)
    setTimeout(() => {
        startFireworks({ behindPodium: Boolean(lobbyMain.querySelector('.podium-content--3d')) });
    }, 500); // Pequeño delay para que el DOM se renderice primero
}

/**
 * Limpiar recursos del podio (llamar antes de cambiar de pantalla)
 */
export function cleanupPodio() {
    stopFireworks();
    cancelPodiumReveal?.();
    cancelPodiumReveal = null;
    podium3d?.destroy();
    podium3d = null;
}
