/**
 * @fileoverview Estado global del jugador
 * Centraliza todas las variables de estado del juego
 */

// ===== ESTADO DE SESIÓN =====
let pin = '';
let sessionId = '';
let nickname = '';

// ===== ESTADO DEL JUEGO =====
let haRespondido = false;
let resultReceived = false;
let canAnswer = true;
let isReconnecting = false;

// ===== ESTADO DE PANTALLA =====
let currentSlideType = null;

// ===== ESTADO DE EQUIPOS =====
let selectedTeam = null;
let teamMode = null;

// ===== ESTADO DE RESPUESTAS =====
let pendingAnswer = null;
let sendingAnswer = false;

// ===== ESTADO DE ORDEN (PREGUNTA ORDER) =====
let currentOrder = null;
let currentOrderOptions = null;
let orderAutoSendTimerId = null;

// ===== ESTADO DE EMPAREJAMIENTO (PREGUNTA MATCHING) =====
let currentMatches = null;
let currentMatchOptions = null;
let matchAutoSendTimerId = null;

// ===== TIMEOUT DE JOIN =====
let joinTimeoutId = null;

// ===== WAKE LOCK =====
let wakeLock = null;

// ===== ESTADO DE RACHA =====
let streakInfo = null;

// ===== GETTERS =====
export function getPin() { return pin; }
export function getSessionId() { return sessionId; }
export function getNickname() { return nickname; }
export function getHaRespondido() { return haRespondido; }
export function getResultReceived() { return resultReceived; }
export function getCanAnswer() { return canAnswer; }
export function getIsReconnecting() { return isReconnecting; }
export function getCurrentSlideType() { return currentSlideType; }
export function getSelectedTeam() { return selectedTeam; }
export function getTeamMode() { return teamMode; }
export function getPendingAnswer() { return pendingAnswer; }
export function getSendingAnswer() { return sendingAnswer; }
export function getCurrentOrder() { return currentOrder; }
export function getCurrentOrderOptions() { return currentOrderOptions; }
export function getOrderAutoSendTimerId() { return orderAutoSendTimerId; }
export function getCurrentMatches() { return currentMatches; }
export function getCurrentMatchOptions() { return currentMatchOptions; }
export function getMatchAutoSendTimerId() { return matchAutoSendTimerId; }
export function getJoinTimeoutId() { return joinTimeoutId; }
export function getWakeLock() { return wakeLock; }
export function getStreakInfo() { return streakInfo; }

// ===== SETTERS =====
export function setPin(value) { pin = value; }
export function setSessionId(value) { sessionId = value; }
export function setNickname(value) { nickname = value; }
export function setHaRespondido(value) { haRespondido = value; }
export function setResultReceived(value) { resultReceived = value; }
export function setCanAnswer(value) { canAnswer = value; }
export function setIsReconnecting(value) { isReconnecting = value; }
export function setCurrentSlideType(value) { currentSlideType = value; }
export function setSelectedTeam(value) { selectedTeam = value; }
export function setTeamMode(value) { teamMode = value; }
export function setPendingAnswer(value) { pendingAnswer = value; }
export function setSendingAnswer(value) { sendingAnswer = value; }
export function setCurrentOrder(value) { currentOrder = Array.isArray(value) ? [...value] : value; }
export function setCurrentOrderOptions(value) { currentOrderOptions = Array.isArray(value) ? [...value] : value; }
export function setOrderAutoSendTimerId(value) { orderAutoSendTimerId = value; }
export function setCurrentMatches(value) { currentMatches = Array.isArray(value) ? [...value] : value; }
export function setCurrentMatchOptions(value) { currentMatchOptions = Array.isArray(value) ? [...value] : value; }
export function setMatchAutoSendTimerId(value) { matchAutoSendTimerId = value; }

export function clearOrderAutoSendTimer() {
    if (orderAutoSendTimerId) {
        clearTimeout(orderAutoSendTimerId);
        orderAutoSendTimerId = null;
    }
}

export function clearMatchAutoSendTimer() {
    if (matchAutoSendTimerId) {
        clearTimeout(matchAutoSendTimerId);
        matchAutoSendTimerId = null;
    }
}

export function startOrderAutoSendTimer(timeLimit) {
    clearOrderAutoSendTimer();
    const duration = Number.isFinite(timeLimit) && timeLimit > 0 ? timeLimit : 20;
    const timeoutMs = Math.max(0, duration * 1000);

    const timerId = setTimeout(() => {
        if (!haRespondido) {
            window.enviarOrdenRespuesta(true);
        }
    }, timeoutMs);

    orderAutoSendTimerId = timerId;
}

export function startMatchAutoSendTimer(timeLimit) {
    clearMatchAutoSendTimer();
    const duration = Number.isFinite(timeLimit) && timeLimit > 0 ? timeLimit : 20;
    const timeoutMs = Math.max(0, duration * 1000);

    const timerId = setTimeout(() => {
        if (!haRespondido) {
            window.enviarMatchingRespuesta(true);
        }
    }, timeoutMs);

    matchAutoSendTimerId = timerId;
}

export function clearOrderState() {
    currentOrder = null;
    currentOrderOptions = null;
    clearOrderAutoSendTimer();
}

export function clearMatchState() {
    currentMatches = null;
    currentMatchOptions = null;
    clearMatchAutoSendTimer();
}
export function setJoinTimeoutId(value) { joinTimeoutId = value; }
export function setWakeLock(value) { wakeLock = value; }
export function setStreakInfo(value) { streakInfo = value; }

// ===== FUNCIÓN DE RESET =====
export function resetGameState() {
    haRespondido = false;
    resultReceived = false;
    canAnswer = true;
    pendingAnswer = null;
    sendingAnswer = false;
    clearOrderState();
    clearMatchState();
    currentSlideType = null;
}

export function resetSessionState() {
    pin = '';
    sessionId = '';
    nickname = '';
    selectedTeam = null;
    teamMode = null;
    isReconnecting = false;
    streakInfo = null;
    resetGameState();
}
