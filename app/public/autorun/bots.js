'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────
const BOT_BATCH_SIZE = 20;
const BOT_BATCH_DELAY_MS = 100;
const BOT_CONNECT_DELAY_MS = 50;
const BOT_ANSWER_MIN_MS = 500;
const BOT_ANSWER_MAX_MS = 3500;

// ─── State ────────────────────────────────────────────────────────────────────
let activeBots = [];
let eventLog = [];
let stats = { connected: 0, failed: 0, answers: 0, total: 0 };
let activeFilter = 'all';
let isRunning = false;

function _i18n() {
    return window.XiroI18n || null;
}

function _t(key, vars, fallback) {
    const api = _i18n();
    if (!api || typeof api.t !== 'function') {
        const template = String(fallback || key || '');
        if (!vars || typeof vars !== 'object') return template;
        return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
    }
    return api.t(key, vars || null, fallback || key);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const reqId = nick => `bot-${nick}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function generateNickname() {
    const L = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const N = '0123456789';
    let r = '';
    for (let i = 0; i < 6; i++) r += L[Math.floor(Math.random() * L.length)];
    for (let i = 0; i < 3; i++) r += N[Math.floor(Math.random() * N.length)];
    return r;
}

// ─── Logging ──────────────────────────────────────────────────────────────────
function log(source, level, msg, data) {
    const entry = { ts: new Date().toISOString(), source, level, msg, ...(data || {}) };
    eventLog.push(entry);
    renderLogEntry(entry);
}

function renderLogEntry(entry) {
    if (activeFilter !== 'all' && entry.level !== activeFilter) return;
    const div = document.createElement('div');
    div.className = `log-entry lvl-${entry.level}`;
    div.dataset.level = entry.level;
    const ts = entry.ts.slice(11, 23);
    const extra = Object.entries(entry).filter(([k]) => !['ts', 'source', 'level', 'msg'].includes(k));
    const suffix = extra.length ? ' ' + JSON.stringify(Object.fromEntries(extra)) : '';
    div.innerHTML = `<span class="log-ts">${ts}</span><span class="log-src">${escHtml(entry.source)}</span><span class="log-lvl">${entry.level.toUpperCase()}</span><span class="log-msg">${escHtml(entry.msg + suffix)}</span>`;
    logContainer.appendChild(div);
    if (document.getElementById('autoScroll').checked) logContainer.scrollTop = logContainer.scrollHeight;
}

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rebuildLog() {
    logContainer.innerHTML = '';
    for (const entry of eventLog) renderLogEntry(entry);
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats() {
    document.getElementById('statConnected').textContent = stats.connected;
    document.getElementById('statFailed').textContent = stats.failed;
    document.getElementById('statAnswers').textContent = stats.answers;
    document.getElementById('statTotal').textContent = stats.total;
}

// ─── BaseBot ──────────────────────────────────────────────────────────────────
class BaseBot {
    constructor(nickname, botIndex) {
        this.nickname = nickname;
        this.botIndex = botIndex;
        this.playerId = crypto.randomUUID();
        this.socket = null;
        this.roomId = null;
        this.answersSubmitted = 0;
        this.sessionSecret = null;
        this.numTeams = null;
        this.teamName = null;
    }

    log(level, msg, data) { log(`Bot:${this.nickname}`, level, msg, data); }

    connectAndJoin(sessionId, transports = ['websocket']) {
        return new Promise((resolve, reject) => {
            const socket = io(window.location.origin, {
                transports,
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: Infinity,
                timeout: 20000,
                auth: { playerId: this.playerId },
            });
            this.socket = socket;
            const timer = setTimeout(() => { socket.disconnect(); reject(new Error('Timeout')); }, 20000);

            socket.on('connect', () => {
                if (this.sessionSecret) {
                    socket.emit('reconnect-player', { playerId: this.playerId, sessionSecret: this.sessionSecret });
                } else {
                    socket.emit('join-lobby', {
                        pin: sessionId.split('-')[0],
                        sessionId,
                        nickname: this.nickname,
                        playerId: this.playerId,
                    });
                }
            });

            socket.on('join-success', (data) => {
                clearTimeout(timer);
                this.roomId = data.roomId || sessionId;
                this.playerId = data.playerId || this.playerId;
                this.sessionSecret = data.sessionSecret;
                const transportName = socket.io?.engine?.transport?.name || 'unknown';
                this.log('debug', _t('autorun.log.join_success_transport', { transport: transportName }, 'join-success ({transport})'));

                if (data.teamMode?.isTeamMode && data.teamMode.teams?.length) {
                    const numTeams = data.teamMode.teams.length;
                    this.numTeams = numTeams;
                    const teamIndex = this.botIndex % numTeams;
                    this.teamName = data.teamMode.teams[teamIndex].name;
                    socket.emit('select-team', {
                        pin: this.roomId.split('-')[0],
                        sessionId: this.roomId,
                        nickname: this.nickname,
                        teamIndex,
                    });
                }

                this._setupListeners();
                resolve();
            });

            socket.on('reconnected-success', (snapshot) => {
                this.roomId = snapshot.roomId || this.roomId;
                if (snapshot.gameState?.currentQuestion && snapshot.gameState?.canAnswer) {
                    setTimeout(() => this._submitAnswer(snapshot.gameState.currentQuestion), randInt(BOT_ANSWER_MIN_MS, BOT_ANSWER_MAX_MS));
                }
            });

            socket.on('reconnect-failed', () => {
                this.sessionSecret = null;
                socket.emit('join-lobby', {
                    pin: sessionId.split('-')[0], sessionId,
                    nickname: this.nickname, playerId: this.playerId,
                });
            });

            socket.on('join-error', (data) => {
                clearTimeout(timer);
                socket.disconnect();
                reject(new Error(data?.message || 'join-error'));
            });

            socket.on('connect_error', (err) => { clearTimeout(timer); reject(err); });
        });
    }

    disconnect() { if (this.socket?.connected) this.socket.disconnect(); }
}

// ─── QuizBotIndividual ────────────────────────────────────────────────────────
class QuizBotIndividual extends BaseBot {
    _setupListeners() {
        const s = this.socket;
        s.on('game-started', (data) => {
            if (data.firstQuestion)
                setTimeout(() => this._submitAnswer(data.firstQuestion), randInt(BOT_ANSWER_MIN_MS, BOT_ANSWER_MAX_MS));
        });
        s.on('new-question', (data) => {
            if (data.question)
                setTimeout(() => this._submitAnswer(data.question), randInt(BOT_ANSWER_MIN_MS, BOT_ANSWER_MAX_MS));
        });
        s.on('answer-result', (data) => {
            this.log('debug', _t('autorun.log.answer_result', { points: data.points, correct: data.correct }, 'answer-result: pts={points} ok={correct}'));
        });
    }

    _submitAnswer(question) {
        if (!this.roomId || !question) return;
        const isSlide = ['comment', 'info', 'text', 'image', 'text-image'].includes(question.slide_type || question.type);
        if (isSlide) return;

        const base = {
            sessionId: this.roomId, pin: this.roomId.split('-')[0],
            nickname: this.nickname, requestId: reqId(this.nickname),
        };
        const qType = question.question_type || question.type;
        const n = question.options?.length || 4;
        let payload;

        switch (qType) {
            case 'order':
                payload = { ...base, answerType: 'order', order: Array.from({ length: n }, (_, i) => i) }; break;
            case 'matching':
                payload = { ...base, answerType: 'matching', matches: Array.from({ length: n }, (_, i) => i) }; break;
            case 'word_scramble':
                payload = { ...base, answerType: 'word_scramble', playerAnswer: 'BOTANSWER' }; break;
            case 'multiple_choice':
                payload = { ...base, answerType: 'multiple_choice', selectedIndices: [randInt(0, n - 1)] }; break;
            case 'numeric_approximation':
                payload = { ...base, answerType: 'numeric', playerAnswer: randInt(1, 100) }; break;
            default:
                payload = { ...base, index: randInt(0, n - 1) };
        }

        this.socket.emit('submit-answer', payload);
        this.answersSubmitted++;
        stats.answers++;
        updateStats();
        this.log('debug', _t('autorun.log.bot_answered', { count: this.answersSubmitted, type: qType }, 'Respondio #{count} ({type})'));
    }
}

class QuizBotTeam extends QuizBotIndividual { }

// ─── TrivialBotIndividual ─────────────────────────────────────────────────────
class TrivialBotIndividual extends BaseBot {
    _setupListeners() {
        const s = this.socket;
        s.on('trivial-game-started', (data) => {
            if (data.currentTurn === this.nickname)
                setTimeout(() => this._rollDice(), randInt(1000, 2000));
        });
        s.on('trivial-turn-changed', (data) => {
            if (data.phase === 'waiting_roll' && data.currentTurn === this.nickname)
                setTimeout(() => this._rollDice(), randInt(800, 2000));
        });
        s.on('trivial-dice-rolled', (data) => {
            if (data.nickname !== this.nickname) return;
            const positions = data.availablePositions || [];
            if (!positions.length) return;
            setTimeout(() => this._move(positions[randInt(0, positions.length - 1)]), randInt(1000, 2000));
        });
        s.on('trivial-choose-category', (data) => {
            if (data.actorNick !== this.nickname) return;
            const cats = data.categories || [];
            const idx = cats.length > 0 ? randInt(0, cats.length - 1) : 0;
            setTimeout(() => s.emit('trivial-category-chosen', { roomId: this.roomId, categoryIndex: idx }), randInt(500, 1500));
        });
        s.on('new-question', (data) => {
            setTimeout(() => this._submitAnswer(data.question), randInt(BOT_ANSWER_MIN_MS, BOT_ANSWER_MAX_MS));
        });
        s.on('trivial-error', d => this.log('warn', 'trivial-error', { msg: d?.message }));
    }

    _rollDice() {
        if (!this.roomId) return;
        const diceValue = randInt(1, 6);
        this.socket.emit('trivial-roll-dice', { roomId: this.roomId, nickname: this.nickname, diceValue });
    }

    _move(position) {
        if (!this.roomId) return;
        this.socket.emit('trivial-move', { roomId: this.roomId, nickname: this.nickname, position });
    }

    _submitAnswer(question) {
        if (!this.roomId || !question) return;
        const base = { sessionId: this.roomId, nickname: this.nickname, requestId: reqId(this.nickname) };
        let payload;
        switch (question.question_type) {
            case 'order':
                payload = { ...base, answerType: 'order', order: (question.options || []).map((_, i) => i) }; break;
            case 'matching':
                payload = { ...base, answerType: 'matching', matches: (question.options || []).map((_, i) => i) }; break;
            case 'word_scramble':
                payload = { ...base, answerType: 'word_scramble', playerAnswer: 'respuesta' }; break;
            default:
                payload = { ...base, index: randInt(0, Math.max(0, (question.options?.length || 4) - 1)) };
        }
        this.socket.emit('submit-answer', payload);
        this.answersSubmitted++;
        stats.answers++;
        updateStats();
    }
}

// ─── TrivialBotTeam ───────────────────────────────────────────────────────────
class TrivialBotTeam extends TrivialBotIndividual {
    constructor(nickname, botIndex, numTeams) {
        super(nickname, botIndex);
        this.numTeams = numTeams || null;
    }

    _isShooter() {
        return this.botIndex === this.botIndex % (this.numTeams || 1);
    }

    _setupListeners() {
        const s = this.socket;
        s.on('trivial-game-started', (data) => {
            if (data.currentTurn === this.teamName && this._isShooter())
                setTimeout(() => this._rollDice(), randInt(1000, 2000));
        });
        s.on('trivial-turn-changed', (data) => {
            if (data.phase === 'waiting_roll' && data.currentTurn === this.teamName && this._isShooter())
                setTimeout(() => this._rollDice(), randInt(800, 2000));
        });
        s.on('trivial-dice-rolled', (data) => {
            if (!this._isShooter() || data.nickname !== this.nickname) return;
            const positions = data.availablePositions || [];
            if (!positions.length) return;
            setTimeout(() => this._move(positions[randInt(0, positions.length - 1)]), randInt(1000, 2000));
        });
        s.on('trivial-choose-category', (data) => {
            if (!this._isShooter() || data.actorNick !== this.teamName) return;
            const cats = data.categories || [];
            const idx = cats.length > 0 ? randInt(0, cats.length - 1) : 0;
            setTimeout(() => s.emit('trivial-category-chosen', { roomId: this.roomId, categoryIndex: idx }), randInt(500, 1500));
        });
        s.on('new-question', (data) => {
            setTimeout(() => this._submitAnswer(data.question), randInt(BOT_ANSWER_MIN_MS, BOT_ANSWER_MAX_MS));
        });
        s.on('trivial-error', d => this.log('warn', 'trivial-error', { msg: d?.message }));
    }
}

// ─── Factory & swarm ──────────────────────────────────────────────────────────
function createBot(mode, gameType, nickname, botIndex) {
    if (gameType === 'trivial')
        return mode === 'equipos' ? new TrivialBotTeam(nickname, botIndex, 2) : new TrivialBotIndividual(nickname, botIndex);
    return mode === 'equipos' ? new QuizBotTeam(nickname, botIndex) : new QuizBotIndividual(nickname, botIndex);
}

async function spawnBots(sessionId, mode, gameType, numBots) {
    const bots = [];
    const used = new Set();
    stats.total = numBots;
    updateStats();
    log('bots', 'info', _t('autorun.log.launching', { count: numBots, mode, gameType }, 'Lanzando {count} bots - modo: {mode}, tipo: {gameType}'));

    for (let i = 0; i < numBots && isRunning; i += BOT_BATCH_SIZE) {
        const batchEnd = Math.min(i + BOT_BATCH_SIZE, numBots);
        log('bots', 'info', _t('autorun.log.connecting_batch', { from: i + 1, to: batchEnd }, 'Conectando bots {from}-{to}...'));

        const batch = [];
        for (let j = i; j < batchEnd; j++) {
            let nick;
            do { nick = generateNickname(); } while (used.has(nick));
            used.add(nick);
            batch.push(createBot(mode, gameType, nick, j));
        }

        for (const bot of batch) {
            if (!isRunning) break;

            try {
                await bot.connectAndJoin(sessionId, ['websocket']);
                bots.push(bot);
                stats.connected++;
                updateStats();
            } catch (err) {
                log('bots', 'warn', _t('autorun.log.bot_failed', { nick: bot.nickname, reason: err.message }, '{nick} fallo: {reason}'));
                stats.failed++;
                updateStats();
            }
            await delay(BOT_CONNECT_DELAY_MS);
        }

        if (batchEnd < numBots && isRunning) {
            log('bots', 'info', _t('autorun.log.online_waiting', { count: bots.length }, '{count} bots online. Esperando...'));
            await delay(BOT_BATCH_DELAY_MS);
        }
    }

    log('bots', 'info', _t('autorun.log.swarm_ready', { connected: bots.length, total: numBots }, 'Enjambre listo: {connected}/{total} bots conectados.'));
    return bots;
}

// ─── UI controller ────────────────────────────────────────────────────────────
const logContainer = document.getElementById('logContainer');
const statusDot = document.getElementById('statusDot');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnDownload = document.getElementById('btnDownload');

function setRunning(running) {
    isRunning = running;
    btnStart.disabled = running;
    btnStop.disabled = !running;
    btnDownload.disabled = running;
    statusDot.className = running ? 'running' : 'stopped';
    statusDot.textContent = running
        ? _t('autorun.status.running', null, 'Corriendo')
        : _t('autorun.status.stopped', null, 'Detenido');
}

btnStart.addEventListener('click', async () => {
    const sessionId = document.getElementById('sessionId').value.trim().toUpperCase();
    if (!sessionId || !sessionId.includes('-')) {
        log('ui', 'error', _t('autorun.log.invalid_session', null, 'Session ID invalido. Formato: PIN-NUMERO (ej: TEST-123456)'));
        return;
    }
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const gameType = document.querySelector('input[name="gameType"]:checked').value;
    const numBots = Math.min(199, Math.max(1, parseInt(document.getElementById('numBots').value, 10) || 100));

    eventLog = [];
    logContainer.innerHTML = '';
    stats = { connected: 0, failed: 0, answers: 0, total: 0 };
    updateStats();
    setRunning(true);

    log('main', 'info', _t('autorun.log.session_summary', { sessionId, mode, gameType, bots: numBots }, 'Session: {sessionId} | Modo: {mode} | Tipo: {gameType} | Bots: {bots}'));

    activeBots = await spawnBots(sessionId, mode, gameType, numBots);

    if (!activeBots.length) {
        log('main', 'error', _t('autorun.log.none_connected', null, 'Ningun bot pudo conectarse.'));
        setRunning(false);
        return;
    }

    log('main', 'info', _t('autorun.log.lobby_ready', { count: activeBots.length }, '{count} bots en el lobby. Pulsa "Detener" para finalizar.'));
    btnDownload.disabled = false;
});

btnStop.addEventListener('click', () => {
    isRunning = false;
    log('main', 'info', _t('autorun.log.disconnecting', { count: activeBots.length }, 'Desconectando {count} bots...'));
    for (const b of activeBots) b.disconnect();
    activeBots = [];
    setRunning(false);
    log('main', 'info', _t('autorun.log.disconnected', null, 'Bots desconectados.'));
    btnDownload.disabled = false;
});

btnDownload.addEventListener('click', () => {
    const report = {
        summary: {
            sessionId: document.getElementById('sessionId').value.trim().toUpperCase(),
            mode: document.querySelector('input[name="mode"]:checked').value,
            gameType: document.querySelector('input[name="gameType"]:checked').value,
            botsConnected: stats.connected,
            botsFailed: stats.failed,
            answersSubmitted: stats.answers,
        },
        events: eventLog,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bot-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
});

document.getElementById('btnClear').addEventListener('click', () => { logContainer.innerHTML = ''; });

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.level;
        rebuildLog();
    });
});

document.querySelectorAll('input[name="mode"]').forEach(r => {
    r.addEventListener('change', () => {
        document.getElementById('modeIndividualBtn').classList.toggle('active', r.value === 'individual' && r.checked);
        document.getElementById('modeEquiposBtn').classList.toggle('active', r.value === 'equipos' && r.checked);
    });
});

document.querySelectorAll('input[name="gameType"]').forEach(r => {
    r.addEventListener('change', () => {
        document.getElementById('typeQuizBtn').classList.toggle('active', r.value === 'quiz' && r.checked);
        document.getElementById('typeTrivialBtn').classList.toggle('active', r.value === 'trivial' && r.checked);
    });
});

// ─── numBots clamp ────────────────────────────────────────────────────────────
// Clamp the bot count input to [1, 199] in real time.
// Using parseInt (not valueAsNumber) because browsers may return NaN via
// valueAsNumber when the field value exceeds the declared max attribute.
(function () {
    const input = document.getElementById('numBots');
    function clamp() {
        const v = parseInt(input.value, 10);
        if (!isNaN(v)) {
            if (v > 199) input.value = 199;
            else if (v < 1) input.value = 1;
        }
    }
    input.addEventListener('input', clamp);
    input.addEventListener('change', clamp);
}());

log('ui', 'info', _t('autorun.log.ready', null, 'Bot Runner listo. Configura los parametros y pulsa "Lanzar bots".'));
