/**
 * @fileoverview Player - UI de dados y selección de casillas para Trivial
 */

import { getSocket } from './player-socket-config.js?v=20260921182204';
import { getSessionId, getNickname } from './player-state.js?v=20260921182204';
import { initDice, startRoll, destroy as destroyDice } from './dice3d.js?v=20260921182204';

let _waitingMove = false;

function getGameArea() {
    return document.getElementById('game-area') ||
        document.getElementById('jugador-content') ||
        document.getElementById('main-container');
}

const BODY_CLASSES = 'bg-purple-700 h-dvh flex flex-col items-center justify-center font-sans text-white overflow-hidden p-4';

function showScreen(html) {
    document.body.style.background = '';  // garantiza que no quede ningún inline bg residual
    const area = getGameArea();
    if (area) {
        area.innerHTML = _tHtml(html);
    } else {
        // answer-result (u otro módulo) reemplazó document.body.innerHTML borrando main-container.
        // Recreamos el contenedor conservando el fondo morado del body.
        document.body.className = BODY_CLASSES;
        document.body.innerHTML = _tHtml(`<div id="main-container" class="w-full max-w-sm text-center h-full flex flex-col items-center justify-center">${html}</div>`);
    }
}

// ===== DADO 3D =====

export function showDiceScreen(currentTurn, isMyTurn, customTitle = null) {
    _waitingMove = false;
    destroyDice();
    const title = customTitle || (isMyTurn ? _t('player.trivial.your_turn', '¡Tu turno!') : `${_t('player.trivial.turn_of', 'Turno de')} ${currentTurn}`);
    const hint = isMyTurn ? _t('player.trivial.tap_dice', 'Toca el dado para tirar') : `${_t('player.trivial.waiting_for', 'Esperando a')} ${currentTurn}...`;
    showScreen(`
        <div style="display:flex; flex-direction:column; width:100%; height:100%;">
            <!-- Dado compacto arriba -->
            <div style="flex-shrink:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0; padding:10px 16px 6px;">
                <h2 style="font-size:clamp(1rem,4.5vw,1.4rem); font-weight:900; color:white; text-align:center; margin:0 0 28px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">
                    ${title}
                </h2>
                <div id="dice-wrapper"
                    class="${isMyTurn ? 'dice-clickable' : 'opponent'}"
                    ${isMyTurn ? 'data-player-action="trivial-roll"' : ''}></div>
                <p id="dice-hint" style="color:#a5b4fc; font-size:0.875rem; text-align:center; margin:22px 0 0 0;">
                    ${hint}
                </p>
            </div>
            <!-- Zona inferior: casillas de movimiento -->
            <div id="trivial-bottom" style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; gap:10px; padding:0 16px 12px; overflow-y:auto;">
            </div>
        </div>`);

    // Init dice after DOM is painted
    requestAnimationFrame(() => {
        const wrapper = document.getElementById('dice-wrapper');
        if (wrapper) initDice(wrapper);
    });
}

/**
 * Deshabilita el canvas del dado (la cara ya quedó visible tras la animación).
 * Para el jugador que lanzó: la cara correcta ya se ve.
 * Para los demás: el canvas estaba dimmed de todas formas.
 */
export function showDiceResult(nickname, diceValue, isMyTurn) {
    const wrapper = document.getElementById('dice-wrapper');
    if (wrapper) wrapper.classList.add('disabled');
}

// ===== SELECCIÓN DE CASILLAS =====

function labelPos(pos) {
    if (pos === 'center') return _t('player.trivial.center_label', 'Centro');
    const parts = pos.split(':');
    if (parts[0] === 'outer') return `${_t('player.trivial.cell_label', 'Casilla')} ${parts[1]}`;
    if (parts[0] === 'spoke') return `${_t('player.trivial.radio_label', 'Radio')} ${parseInt(parts[1], 10) + 1}·${parts[2]}`;
    return pos;
}

export function showMoveSelection(availablePositions, labels, isMyTurn, colors = [], categories = []) {
    _waitingMove = true;
    if (!isMyTurn) {
        showTrivialWaiting(_t('player.trivial.selecting_cell', 'Seleccionando casilla…'), {
            icon: '🗺️',
            subtitle: _t('player.trivial.waiting_active', 'Esperando al jugador activo'),
            color: '#60a5fa'
        });
        return;
    }

    const buttons = availablePositions.map((p, idx) => {
        const letter = (Array.isArray(labels) && labels[idx]) ? labels[idx] : labelPos(p);
        const color = (Array.isArray(colors) && colors[idx]) ? colors[idx] : '#f97316';
        const cat = categories.find(c => (c.color || '').toLowerCase() === (color || '').toLowerCase());
        const catName = cat ? (cat.category_name || cat.name || labelPos(p)) : labelPos(p);
        return `<button data-player-action="trivial-move" data-position="${p}"
            style="background:${color};border:none;text-align:left;box-shadow:0 3px 10px ${color}99;"
            class="active:scale-95 transition w-full rounded-2xl px-4 py-3 flex items-center gap-3">
            <span style="width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,0.25);flex-shrink:0;
                         display:flex;align-items:center;justify-content:center;
                         font-size:1rem;font-weight:900;color:#fff">${letter}</span>
            <span style="color:#fff;font-size:0.85rem;font-weight:800;text-transform:uppercase;letter-spacing:.3px;
                         min-width:0;flex:1;line-height:1.2;">${catName}</span>
        </button>`;
    }).join('');

    // Actualizar solo la mitad inferior para conservar el dado visible arriba
    const bottom = document.getElementById('trivial-bottom');
    const wrapper = document.getElementById('dice-wrapper');

    if (bottom && wrapper) {
        wrapper.classList.add('disabled');
        wrapper.removeAttribute('data-player-action');
        wrapper.classList.remove('dice-clickable');
        const hint = document.getElementById('dice-hint');
        if (hint) hint.style.visibility = 'hidden';
        bottom.innerHTML = _tHtml(`
            <h2 style="font-size:1.1rem; font-weight:900; color:white; text-align:center; margin:0 0 4px 0;">¿Dónde te mueves?</h2>
            <div style="display:flex;flex-direction:column;gap:8px;width:100%;max-width:320px">${buttons}</div>`);
    } else {
        // Fallback: reemplazar pantalla completa
        showScreen(`
            <div class="flex flex-col items-center gap-4 p-6">
                <h2 class="text-xl font-black text-white mb-2">¿Dónde te mueves?</h2>
                <div style="display:flex;flex-direction:column;gap:8px;width:100%;max-width:320px">${buttons}</div>
            </div>`);
    }
}

// ===== WAITING SCREENS =====

/**
 * Rich animated waiting card.
 * @param {string} message - Main bold line
 * @param {Object} [opts]
 * @param {string} [opts.icon]     - Big emoji/icon shown above message
 * @param {string} [opts.subtitle] - Smaller dim line below message
 * @param {string} [opts.color]    - Accent hex color (glow + dots)
 * @param {boolean} [opts.noDots]  - Hide the bouncing dots
 */
export function showTrivialWaiting(message, { icon = '', subtitle = '', color = '#a78bfa', noDots = false } = {}) {
    const dots = noDots ? '' : [
        `<span style="width:14px;height:14px;border-radius:50%;background:${color};display:inline-block;animation:_tw_dot 1.4s ease-in-out 0s infinite"></span>`,
        `<span style="width:14px;height:14px;border-radius:50%;background:${color};display:inline-block;animation:_tw_dot 1.4s ease-in-out 0.22s infinite"></span>`,
        `<span style="width:14px;height:14px;border-radius:50%;background:${color};display:inline-block;animation:_tw_dot 1.4s ease-in-out 0.44s infinite"></span>`
    ].join('');
    showScreen(`
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    height:100%;gap:28px;padding:28px;text-align:center">
            ${icon ? `<div style="font-size:6rem;line-height:1;animation:_tw_pulse 2.2s ease-in-out infinite">${icon}</div>` : ''}
            <p style="font-size:2rem;font-weight:900;color:${color};letter-spacing:.4px;
                      text-shadow:0 0 32px ${color}bb;margin:0;line-height:1.25">${message}</p>
            ${subtitle ? `<p style="font-size:1.2rem;color:#94a3b8;margin:0;font-weight:700">${subtitle}</p>` : ''}
            <div style="display:flex;gap:14px;margin-top:4px">${dots}</div>
        </div>
        <style>
            @keyframes _tw_pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
            @keyframes _tw_dot{0%,80%,100%{transform:translateY(0);opacity:.7}40%{transform:translateY(-9px);opacity:1}}
        </style>`);
}

// ===== GLOBAL ONCLICK HANDLERS =====

export function registerTrivialPlayerActions() {
    window.trivialRollDice = () => {
        const wrapper = document.getElementById('dice-wrapper');
        if (wrapper) wrapper.classList.add('disabled');
        // El valor se determina aquí en el cliente; se emite al servidor
        // solo cuando la animación termina y la cara ya es visible.
        startRoll((diceValue) => {
            const socket = getSocket();
            socket.emit('trivial-roll-dice', {
                roomId: getSessionId(),
                nickname: getNickname(),
                diceValue
            });
        });
    };

    window.trivialMove = (position) => {
        if (!_waitingMove) return;
        _waitingMove = false;
        const socket = getSocket();
        socket.emit('trivial-move', { roomId: getSessionId(), nickname: getNickname(), position });
        showTrivialWaiting(_t('player.trivial.moving_piece', 'Moviendo ficha…'), { icon: '🎲', color: '#fbbf24', noDots: true });
    };
}
