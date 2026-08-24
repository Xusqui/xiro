/**
 * @fileoverview Módulo de UI para rachas del jugador
 * Badge persistente + pantallas de animación al entrar/salir de racha.
 *
 * API pública:
 *  - applyStreakToResult(streakInfo, resultHTML) — llamar en vez de document.body.innerHTML
 *  - injectStreakBadge()                         — llamar tras renderizar cada pregunta
 *
 * Arquitectura del badge persistente:
 *  El badge es un elemento DOM que vive FUERA del ciclo innerHTML. Un MutationObserver
 *  lo reinyecta automáticamente cada vez que document.body es reemplazado. Solo
 *  desaparece cuando la racha se pierde (isInStreak = false).
 */

import { getStreakInfo, setStreakInfo, getCurrentSlideType } from './player-state.js?v=20260824101409';

const DURATION_ENTER = 2000;
const DURATION_LOST = 1500;
const BADGE_ID = 'streak-persistent-badge';
const ANIM_OVERLAY_ID = 'streak-anim-overlay';

// Control de animación activa
let _activeAnimationTimeout = null;
let _activeAnimationResolve = null;
let _animationCancelled = false;

// ===== BADGE PERSISTENTE (MutationObserver) =====

/** Crea o devuelve el elemento badge singleton. */
function _getOrCreateBadge() {
    let badge = document.getElementById(BADGE_ID);
    if (!badge) {
        badge = document.createElement('div');
        badge.id = BADGE_ID;
        badge.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;pointer-events:none;select:none;display:none';
        document.body.appendChild(badge);
    }
    return badge;
}

/** Actualiza el badge según el estado de racha actual. */
function _syncBadge() {
    const info = getStreakInfo();
    const badge = _getOrCreateBadge();

    if (!info?.isInStreak) {
        badge.style.display = 'none';
        return;
    }

    const isDouble = info.isInDoubleStreak;
    const emoji = isDouble ? '🔥🔥' : '🔥';
    const label = isDouble ? _t('player.streak.double_label', 'DOBLE') : _t('player.streak.label', 'RACHA');
    const bg = isDouble
        ? 'background:linear-gradient(135deg,#7c3aed,#db2777);box-shadow:0 0 12px rgba(124,58,237,.6),0 2px 8px rgba(0,0,0,.4);outline:2px solid #c084fc'
        : 'background:linear-gradient(135deg,#ea580c,#f97316);box-shadow:0 0 10px rgba(234,88,12,.5),0 2px 8px rgba(0,0,0,.3);outline:2px solid #fdba74';

    badge.style.cssText = `position:fixed;top:12px;right:12px;z-index:9999;pointer-events:none;user-select:none;display:flex;align-items:center;gap:4px;padding:6px 12px;border-radius:9999px;font-weight:900;font-size:14px;color:#fff;${bg}`;
    badge.innerHTML = _tHtml(`<span style="font-size:16px;line-height:1">${emoji}</span><span style="font-size:18px">${info.current}</span><span style="font-size:11px;letter-spacing:.05em">${label}</span>`);
}

// Reinyectar el badge cada vez que body cambia de hijos (innerHTML replacement)
const _observer = new MutationObserver(() => {
    if (!document.getElementById(BADGE_ID)) {
        // El body fue reemplazado — recrear y sincronizar
        _syncBadge();
    }
});
_observer.observe(document.body, { childList: true });

// ===== API PÚBLICA =====

/**
 * Cancela cualquier animación de racha activa inmediatamente.
 * Útil cuando llega una nueva pregunta antes de que termine la animación.
 * @param {boolean} markAsCancelled - Si true, marca como cancelada para prevenir render (default: true)
 */
export function cancelStreakAnimation(markAsCancelled = true) {
    // Marcar como cancelada solo si es una cancelación externa
    if (markAsCancelled) {
        _animationCancelled = true;
    }

    // Limpiar timeout si existe
    if (_activeAnimationTimeout) {
        clearTimeout(_activeAnimationTimeout);
        _activeAnimationTimeout = null;
    }

    // Eliminar overlay si existe
    const overlay = document.getElementById(ANIM_OVERLAY_ID);
    if (overlay) {
        overlay.remove();
    }

    // Resolver promesa pendiente inmediatamente
    if (_activeAnimationResolve) {
        _activeAnimationResolve();
        _activeAnimationResolve = null;
    }
}

/**
 * Muestra el resultado de una respuesta.
 * Si hay animación de racha (entrada o pérdida), la muestra primero y luego el resultado.
 * Siempre actualiza el estado de racha en player-state y sincroniza el badge.
 *
 * @param {Object|null} streakInfo - Datos de racha del payload answer-result
 * @param {string}      resultHTML - HTML completo para asignar a document.body.innerHTML
 */
export function applyStreakToResult(streakInfo, resultHTML) {
    if (streakInfo) setStreakInfo(streakInfo);

    // Resetear flag de cancelación al iniciar nueva animación
    _animationCancelled = false;

    const _render = () => {
        // Capturar el estado actual de la flag antes de resetearla
        const wasCancelled = _animationCancelled;

        // Resetear inmediatamente para la próxima animación
        _animationCancelled = false;

        // Solo renderizar si no fue cancelada externamente
        if (!wasCancelled) {
            document.body.innerHTML = _tHtml(resultHTML);
            _syncBadge();
        }
    };

    if (streakInfo?.justEntered || streakInfo?.justEnteredDoubleStreak) {
        const type = streakInfo.justEnteredDoubleStreak ? 'enterDouble' : 'enter';
        _showAnimation(type, streakInfo).then(_render);
    } else if (streakInfo?.justLost) {
        _showAnimation('lost', streakInfo).then(_render);
    } else {
        _render();
    }
}

/**
 * Sincroniza el badge en la pantalla actual.
 * Compatible con la API anterior — puede llamarse tras cualquier render.
 * DEBE llamarse después de cualquier document.body.innerHTML = para preservar el badge.
 */
export function injectStreakBadge() {
    _syncBadge();
}

/**
 * Helper para reemplazar document.body.innerHTML preservando el badge.
 * Úsalo en lugar de document.body.innerHTML = directamente.
 * @param {string} html - HTML para asignar al body
 */
export function setBodyHTML(html) {
    document.body.innerHTML = _tHtml(html);
    _syncBadge();
}

// ===== FUNCIONES PRIVADAS =====

/**
 * Muestra una pantalla de animación de racha y resuelve la promesa al terminar.
 * @private
 * @param {'enter'|'enterDouble'|'lost'} type
 * @param {Object} streakInfo
 * @returns {Promise<void>}
 */
function _showAnimation(type, streakInfo) {
    // Cancelar cualquier animación previa (limpieza interna, no bloquear render)
    cancelStreakAnimation(false);

    return new Promise(resolve => {
        // Guardar referencia a la función resolve
        _activeAnimationResolve = resolve;

        const isLost = type === 'lost';
        const isDouble = type === 'enterDouble';
        const duration = isLost ? DURATION_LOST : DURATION_ENTER;
        const bgStyle = isLost
            ? 'background:#334155'
            : isDouble
                ? 'background:linear-gradient(135deg,#7c3aed,#db2777)'
                : 'background:linear-gradient(135deg,#ea580c,#f97316)';
        const emoji = isLost ? '💔' : isDouble ? '🔥🔥' : '🔥';
        const title = isLost
            ? _t('player.streak.lost', '¡RACHA PERDIDA!')
            : isDouble
                ? `${_t('player.streak.double_prefix', '¡DOBLE RACHA x')}${streakInfo.current}!`
                : `${_t('player.streak.active_prefix', '¡RACHA x')}${streakInfo.current}!`;
        const subtitle = isLost
            ? `${_t('player.streak.ended_prefix', 'Se acabó tu racha de')} ${streakInfo.previous} 🎯`
            : isDouble
                ? `¡${streakInfo.current} ${_t('player.streak.double_bonus_suffix', 'seguidas con bonus doble!')}`
                : `${streakInfo.current} ${_t('player.streak.consecutive_correct', 'respuestas correctas seguidas')}`;
        const animClass = isLost ? 'animate-pulse' : 'animate-bounce';

        const el = document.createElement('div');
        el.id = ANIM_OVERLAY_ID;
        el.style.cssText = `position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;${bgStyle};color:#fff;text-align:center;pointer-events:none`;
        el.innerHTML = _tHtml(`
            <div style="display:flex;flex-direction:column;align-items:center;padding:0 24px">
                <div class="${animClass}" style="font-size:80px;margin-bottom:16px;line-height:1">${emoji}</div>
                <h2 style="font-size:2.8rem;font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:-.02em;margin:0">${title}</h2>
                <p style="font-size:1.1rem;margin-top:12px;opacity:.85">${subtitle}</p>
            </div>`);
        document.body.appendChild(el);

        // Guardar referencia al timeout
        _activeAnimationTimeout = setTimeout(() => {
            el.classList.add('streak-overlay-exit');
            setTimeout(() => el.remove(), 250);
            _activeAnimationTimeout = null;
            _activeAnimationResolve = null;
            resolve();
        }, duration);
    });
}
