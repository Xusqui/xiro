'use strict';

const crypto = require('crypto');
const { io } = require('socket.io-client');

function nowIso() {
    return new Date().toISOString();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'XiroRealClusterAnswerLockRunner/1.0' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} on ${url}`);
    return response.json();
}

function waitForEvent(socket, eventName, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(eventName, onEvent);
            reject(new Error(`Timeout waiting event ${eventName}`));
        }, timeoutMs);

        function onEvent(payload) {
            clearTimeout(timer);
            socket.off(eventName, onEvent);
            resolve(payload);
        }

        socket.on(eventName, onEvent);
    });
}

function createClient(target) {
    return io(target, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 15000,
        forceNew: true,
        extraHeaders: { 'User-Agent': 'XiroRealClusterAnswerLockRunner/1.0' }
    });
}

async function joinClient(target, pin, idx) {
    const socket = createClient(target);
    const nickname = `LT_${idx}_${crypto.randomUUID().slice(0, 8)}`;
    const playerId = crypto.randomUUID();

    await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
    });

    const joinSuccessPromise = waitForEvent(socket, 'join-success', 10000);
    const joinErrorPromise = waitForEvent(socket, 'join-error', 10000)
        .then(err => {
            throw new Error(`join-error ${JSON.stringify(err)}`);
        });

    socket.emit('join-lobby', { pin, nickname, playerId });
    const joinData = await Promise.race([joinSuccessPromise, joinErrorPromise]);

    return {
        socket,
        nickname,
        playerId,
        roomId: joinData.roomId || pin
    };
}

function buildSubmitPayload(client, roomId) {
    const isSessionId = /^[A-Z0-9]{4,10}-/.test(String(roomId));
    return {
        ...(isSessionId ? { sessionId: roomId } : { pin: roomId }),
        nickname: client.nickname,
        playerId: client.playerId,
        index: 0
    };
}

function emitSubmitWithAck(socket, payload) {
    return new Promise(resolve => {
        try {
            socket.emit('submit-answer', payload, ack => resolve(ack || { ok: false, reason: 'no-ack' }));
        } catch (err) {
            resolve({ ok: false, reason: 'emit-error', message: err.message });
        }
    });
}

function summarizeAcks(results) {
    const summary = { totalAcks: 0, okTrue: 0, duplicates: 0, byReason: {} };
    results.forEach(ack => {
        summary.totalAcks++;
        if (ack?.ok === true) summary.okTrue++;
        if (ack?.duplicate === true) summary.duplicates++;
        const reason = ack?.reason || (ack?.ok === true ? 'ok' : 'unknown');
        summary.byReason[reason] = (summary.byReason[reason] || 0) + 1;
    });
    return summary;
}

function hasDistributedLockMetrics(snapshot) {
    return !!snapshot && typeof snapshot === 'object' && !!snapshot.answer_lock_distributed;
}

function getLockMetrics(snapshot) {
    return snapshot?.answer_lock_distributed?.room || {
        attempts: 0,
        acquired: 0,
        lock_miss: 0,
        degraded_fallback: 0,
        miss_rate: 0
    };
}

async function triggerTrivialQuestionRound(clients, roomId) {
    const starter = clients[0];
    starter.socket.emit('trivial-start', { roomId, isTeamMode: false });

    const started = await waitForEvent(starter.socket, 'trivial-game-started', 10000);
    const currentTurn = String(started?.currentTurn || starter.nickname);
    const actorClient = clients.find(c => c.nickname === currentTurn) || starter;

    const diceRolledPromise = waitForEvent(actorClient.socket, 'trivial-dice-rolled', 10000);
    const diceErrorPromise = waitForEvent(actorClient.socket, 'trivial-error', 10000)
        .then(err => {
            throw new Error(`trivial-error on roll: ${JSON.stringify(err)}`);
        });

    actorClient.socket.emit('trivial-roll-dice', {
        roomId,
        nickname: actorClient.nickname,
        diceValue: 2
    });

    const rolled = await Promise.race([diceRolledPromise, diceErrorPromise]);
    const positions = Array.isArray(rolled?.availablePositions) ? rolled.availablePositions : [];
    if (positions.length === 0) throw new Error('No availablePositions after trivial-roll-dice');

    actorClient.socket.emit('trivial-move', {
        roomId,
        nickname: actorClient.nickname,
        position: positions[0]
    });
}

module.exports = {
    nowIso,
    sleep,
    fetchJson,
    joinClient,
    waitForEvent,
    buildSubmitPayload,
    emitSubmitWithAck,
    summarizeAcks,
    hasDistributedLockMetrics,
    getLockMetrics,
    triggerTrivialQuestionRound
};
