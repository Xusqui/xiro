/**
 * @fileoverview Estado global del presentador
 * Gestiona todas las variables de estado compartidas
 */

// ===== CONFIGURACIÓN DE SESIÓN =====
const urlParams = new URLSearchParams(window.location.search);
const sessionFromUrl = urlParams.get('session')?.toUpperCase();
const pinFromUrl = urlParams.get('pin')?.toUpperCase();

// Priorizar session si existe, sino usar pin
let _pin = sessionFromUrl ? sessionFromUrl.split('-')[0] : pinFromUrl;
export let sessionId = sessionFromUrl || null; // ID de sesión único (PIN-UUID)

console.log('🔍 URL params detectados:', { sessionFromUrl, pinFromUrl, pin: _pin, sessionId });

// ===== ESTADO DEL JUEGO =====
export let totalPlayers = 0;
export let currentQuestionIndex = 0;
export let totalQuestions = 0;
export let connectedPlayers = []; // Lista de jugadores conectados durante el juego
export let playersData = {}; // {nickname: {score: 0, answered: false, correct: null}}

// ===== CONFIGURACIÓN DE EQUIPOS =====
export let isTeamMode = false; // Modo individual (false) o equipos (true)
export let teamConfig = null; // Configuración de equipos {teams: [{name, color, players, score}]}

// ===== TIPO DE JUEGO =====
export let gameType = null; // 'standard' | 'trivial' | null

// ===== SONIDOS =====
export const tickSound = new Audio('/audio/bip.wav');
tickSound.preload = 'auto';
tickSound.load();

// ===== SETTERS PARA ACTUALIZAR ESTADO =====
export function setSessionId(value) {
    sessionId = value;
}

export function setPin(value) {
    _pin = value;
}

export function setTotalPlayers(value) {
    totalPlayers = value;
}

export function setCurrentQuestionIndex(value) {
    currentQuestionIndex = value;
}

export function setTotalQuestions(value) {
    totalQuestions = value;
}

export function setConnectedPlayers(value) {
    connectedPlayers = value;
}

export function addConnectedPlayer(player) {
    if (!connectedPlayers.includes(player)) {
        connectedPlayers.push(player);
    }
}

export function removeConnectedPlayer(player) {
    const index = connectedPlayers.indexOf(player);
    if (index > -1) {
        connectedPlayers.splice(index, 1);
    }
}

export function setPlayersData(value) {
    playersData = value;
}

export function updatePlayerData(nickname, data) {
    if (!playersData[nickname]) {
        playersData[nickname] = {};
    }
    Object.assign(playersData[nickname], data);
}

export function setIsTeamMode(value) {
    isTeamMode = value;
}

export function setTeamConfig(value) {
    teamConfig = value;
}
// ===== GETTERS PARA LEER ESTADO =====
export function getSessionId() {
    return sessionId;
}

export function getPin() {
    return _pin;
}

export function getTotalPlayers() {
    return totalPlayers;
}

export function getCurrentQuestionIndex() {
    return currentQuestionIndex;
}

export function getTotalQuestions() {
    return totalQuestions;
}

export function getConnectedPlayers() {
    return connectedPlayers;
}

export function getPlayersData() {
    return playersData;
}

export function setPlayerData(nickname, data) {
    playersData[nickname] = data;
}

export function deletePlayerData(nickname) {
    delete playersData[nickname];
}

export function getIsTeamMode() {
    return isTeamMode;
}

export function getTeamConfig() {
    return teamConfig;
}

export function setGameType(value) {
    gameType = value;
}

export function getGameType() {
    return gameType;
}

