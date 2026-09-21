/**
 * @fileoverview Pantalla "JUGÁIS POR XXX PUNTOS + BONUS DE TIEMPO".
 *
 * Overlay a pantalla completa que se muestra antes de cada pregunta con
 * puntuación aleatoria, en presentador, TV, jugador y Standalone. El servidor
 * gatea la espera (no arranca el temporizador hasta que termina), así que aquí
 * solo se pinta; la duración llega en el propio payload.
 *
 * En los móviles de los jugadores se añade además el multiplicador de racha
 * personalizado, calculado en cliente con la racha que el jugador ya tiene.
 *
 * Expone window.XiroRandomPointsOverlay para que lo usen tanto los scripts
 * clásicos (presentador, TV, Standalone) como los módulos ES del jugador.
 */

(function (global) {
    'use strict';

    const OVERLAY_ID = 'random-points-overlay';
    let _timeout = null;

    function _t(key, vars, fallback) {
        return typeof global._t === 'function' ? global._t(key, vars, fallback) : fallback;
    }

    /**
     * Multiplicador de racha que le corresponde a este jugador, o null.
     * Replica la regla de GameStreakApplicator: la doble racha sustituye a la normal
     * y el umbral se compara con la racha ANTERIOR a la respuesta.
     *
     * @param {Object} streakConfig - Bloque `streak` del payload
     * @param {number} currentStreak - Racha actual del jugador
     * @returns {number|null} Porcentaje de bonus (0.5 = +50%)
     */
    function streakBonusFor(streakConfig, currentStreak) {
        if (!streakConfig || !streakConfig.enabled || !currentStreak) return null;

        if (streakConfig.doubleEnabled && currentStreak >= streakConfig.doubleThreshold) {
            return streakConfig.doubleBonusPercentage;
        }
        if (currentStreak >= streakConfig.threshold) {
            return streakConfig.bonusPercentage;
        }
        return null;
    }

    function formatMultiplier(bonusPercentage) {
        // El idioma lo fija i18n-dom en <html lang>; decide el separador decimal
        const locale = document.documentElement?.lang || global.navigator?.language || 'es';
        // Number() defensivo: si bonusPercentage llegara como string (p.ej. un DECIMAL
        // de BD sin parsear), "1 + '0.5'" concatenaría ("10.5") en vez de sumar.
        const multiplier = 1 + Number(bonusPercentage);
        return multiplier.toLocaleString(locale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }

    function buildStreakLine(payload, currentStreak) {
        const bonus = streakBonusFor(payload.streak, currentStreak);
        if (bonus === null) return '';

        const text = _t('game.random_points.streak_multiplier',
            { multiplier: formatMultiplier(bonus) },
            'x{multiplier} por racha');

        return `<p style="font-size:1.2rem;font-weight:900;margin-top:20px;padding:8px 20px;border-radius:9999px;background:rgba(255,255,255,.18)">🔥 ${text}</p>`;
    }

    /** Quita el overlay si está visible. */
    function hide() {
        if (_timeout) {
            clearTimeout(_timeout);
            _timeout = null;
        }
        const existing = document.getElementById(OVERLAY_ID);
        if (existing) existing.remove();
    }

    /**
     * Muestra el overlay.
     *
     * @param {Object} payload - Payload del evento `random-points-reveal`
     * @param {Object} [options]
     * @param {number} [options.currentStreak] - Racha del jugador (solo móvil)
     * @param {number} [options.durationMs] - Duración a mostrar (por defecto, la del payload)
     * @returns {Promise<void>} Se resuelve al ocultarse
     */
    function show(payload, options) {
        hide();

        const opts = options || {};
        const duration = opts.durationMs ?? payload.durationMs ?? 3500;
        const headline = _t('game.random_points.headline', { points: payload.points },
            'JUGÁIS POR {points} PUNTOS');
        const subtitle = _t('game.random_points.time_bonus', null, '+ BONUS DE TIEMPO');
        const streakLine = opts.currentStreak ? buildStreakLine(payload, opts.currentStreak) : '';

        const el = document.createElement('div');
        el.id = OVERLAY_ID;
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;'
            + 'align-items:center;justify-content:center;text-align:center;padding:0 24px;'
            + 'background:linear-gradient(135deg,#7e22ce,#4338ca);color:#fff;pointer-events:none';
        el.innerHTML = `
            <div style="font-size:clamp(56px,12vw,88px);line-height:1;margin-bottom:16px" class="animate-bounce">🎲</div>
            <h2 style="font-size:clamp(2rem,7vw,4.5rem);font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:-.02em;margin:0;max-width:20ch">${headline}</h2>
            <p style="font-size:clamp(1rem,3vw,2rem);font-weight:700;margin-top:12px;opacity:.9;text-transform:uppercase">${subtitle}</p>
            ${streakLine}`;

        document.body.appendChild(el);

        return new Promise(resolve => {
            _timeout = setTimeout(() => {
                el.remove();
                _timeout = null;
                resolve();
            }, duration);
        });
    }

    global.XiroRandomPointsOverlay = { show, hide, streakBonusFor, OVERLAY_ID };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.XiroRandomPointsOverlay;
    }
})(typeof window !== 'undefined' ? window : globalThis);
