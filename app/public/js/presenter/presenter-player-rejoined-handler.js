/**
 * @fileoverview Handler para reconexión de jugadores en el presentador
 * Maneja la lógica cuando un jugador reconecta después de desconexión
 */

import {
    getConnectedPlayers, addConnectedPlayer,
    getPlayersData, setPlayerData, getTotalPlayers, setTotalPlayers,
    getIsTeamMode, getTeamConfig
} from './presenter-state.js?v=20260713135401';
import { updatePlayersPanel, renderTeamLobby } from './presenter-game-ui.js?v=20260713135401';
import { updateAnswerCounter } from './presenter-answer-counter.js?v=20260713135401';

/**
 * Manejar reconexión de un jugador
 * Añade el jugador si no existe (caso: presentador hizo reload)
 * Actualiza el estado si ya existe
 * @param {string|Object} data - Nickname (legacy) u objeto con información completa del jugador
 */
export function handlePlayerRejoined(data) {
    // Soportar formato legacy (string) y nuevo formato (objeto)
    const nickname = typeof data === 'string' ? data : data.nickname;
    const playerInfo = typeof data === 'object' ? data : {};

    if (nickname === 'HOST') return;

    console.log(`✅ ${nickname} reconectado`, playerInfo);

    const playersData = getPlayersData();
    const connectedPlayers = getConnectedPlayers();

    const playerExists = playersData[nickname] !== undefined;
    const isInConnectedList = connectedPlayers.includes(nickname);
    const alreadyKnown = playerExists || isInConnectedList;

    // CASO 1: Jugador NO existe (presentador hizo reload antes de la reconexión)
    if (!playerExists) {
        console.log(`➕ ${nickname} añadido a playersData (reconexión post-reload)`);
        setPlayerData(nickname, {
            score: playerInfo.score || 0,
            answered: false,
            correct: null,
            disconnected: false,
            streak: playerInfo.streak || 0,
            streakInfo: playerInfo.streakInfo || null
        });
    } else {
        // CASO 2: Jugador existe, marcar como conectado y actualizar racha
        playersData[nickname].disconnected = false;

        // Actualizar racha si viene en el payload
        if (playerInfo.streak !== undefined) {
            playersData[nickname].streak = playerInfo.streak;
        }
        if (playerInfo.streakInfo) {
            playersData[nickname].streakInfo = playerInfo.streakInfo;
        }
    }

    // Añadir a lista de conectados si no está
    if (!isInConnectedList) {
        console.log(`➕ ${nickname} añadido a connectedPlayers`);
        addConnectedPlayer(nickname);
        if (!alreadyKnown) {
            setTotalPlayers(getTotalPlayers() + 1);
        }

        // Actualizar contador en lobby si existe
        const pCount = document.getElementById('p-count');
        if (pCount) {
            pCount.innerText = _t(getTotalPlayers());
        }
    }

    // Actualizar elementos DOM en el lobby principal
    updateLobbyPlayerElement(nickname);

    // Actualizar panel lateral (siempre)
    updatePlayersPanel();
    updateAnswerCounter();

    // Habilitar botón empezar si hay jugadores
    enableStartButtonIfNeeded();
}

/**
 * Actualizar o crear elemento del jugador en el lobby principal
 * @param {string} nickname
 */
function updateLobbyPlayerElement(nickname) {
    const existingCard = document.querySelector(`[data-nickname="${nickname}"]`);

    if (existingCard) {
        // Ya existe, restaurar apariencia (quitar indicador de desconectado)
        existingCard.classList.remove('opacity-50', 'grayscale');
        const indicator = existingCard.querySelector('.disconnected-indicator');
        if (indicator) indicator.remove();

        // Animación temporal
        existingCard.classList.add('animate-pulse');
        setTimeout(() => existingCard.classList.remove('animate-pulse'), 2000);
    } else {
        // No existe, crear nuevo elemento
        createLobbyPlayerElement(nickname);
    }
}

/**
 * Crear elemento del jugador en el lobby
 * @param {string} nickname
 */
function createLobbyPlayerElement(nickname) {
    const pList = document.getElementById('p-list');
    if (!pList) return; // No estamos en lobby

    if (getIsTeamMode() && getTeamConfig()) {
        // Modo equipos: renderizar todo el lobby de equipos
        console.log(`👥 ${nickname} reconectado en modo equipos`);
        renderTeamLobby();
    } else {
        // Modo individual: crear tarjeta individual
        const playerDiv = document.createElement('div');
        playerDiv.className = 'bg-white text-slate-900 p-3 rounded-xl font-black text-center uppercase italic text-sm animate-pulse';
        playerDiv.setAttribute('data-nickname', nickname);
        playerDiv.textContent = _t(nickname);
        pList.appendChild(playerDiv);

        // Quitar animación después de 2s
        setTimeout(() => playerDiv.classList.remove('animate-pulse'), 2000);
    }
}

/**
 * Habilitar botón "Empezar" si hay jugadores
 */
function enableStartButtonIfNeeded() {
    if (getTotalPlayers() > 0) {
        const btn = document.getElementById('btn-empezar');
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '';
            btn.style.cursor = '';
        }
    }
}
