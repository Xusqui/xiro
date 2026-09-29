'use strict';

/**
 * Líder de equipo para el Bot Runner (modo equipos).
 *
 * Si un equipo tiene un jugador llamado "Xiro", los bots de ese equipo esperan
 * a que Xiro conteste y replican su respuesta. Para conocerla, abre un socket
 * observador como presentador remoto (requiere token admin) y escucha
 * `player-answer-detail` y `team-update`.
 */
window.XiroTeamLeader = (function () {
    const LEADER_NICK = 'xiro';
    let socket = null;
    let teams = [];
    let logFn = () => {};
    // Trivial usa siempre currentIndex=0: se cuenta cada new-question como ronda.
    let trivial = false;
    let round = 0;
    let currentIndex = null;
    let detailsSeen = 0;
    let diagnosticTimer = null;
    const DIAGNOSTIC_DELAY_MS = 15000;
    const answers = new Map();
    const waiters = new Map();

    const isLeader = nick => String(nick || '').trim().toLowerCase() === LEADER_NICK;
    const key = (teamName, questionKey) => `${teamName}|${questionKey}`;

    /** Clave de la pregunta actual; null si no se puede identificar. */
    function keyFor(questionIndex) {
        if (trivial) return round > 0 ? `R${round}` : null;
        return questionIndex == null ? null : `P${questionIndex}`;
    }

    function teamHasLeader(teamName) {
        if (!teamName) return false;
        const team = teams.find(t => t.name === teamName);
        return !!team && (team.players || []).some(isLeader);
    }

    function setTeams(list) {
        if (!Array.isArray(list)) return;
        teams = list;
        const withLeader = teams.filter(t => (t.players || []).some(isLeader)).map(t => t.name);
        if (withLeader.length) logFn('leader', 'info', `Xiro en equipo(s): ${withLeader.join(', ')}`);
    }

    function teamOf(nickname) {
        return teams.find(t => (t.players || []).includes(nickname))?.name || null;
    }

    function record(detail) {
        detailsSeen++;
        if (!detail || !isLeader(detail.nickname)) return;
        // Índice visto por el observador: activeGames del worker que procesa la respuesta puede ir desfasado.
        const questionKey = keyFor(currentIndex ?? detail.questionIndex);
        const teamName = teamOf(detail.nickname) || detail.teamName;
        if (questionKey == null || !teamName) {
            logFn('leader', 'warn', 'Respuesta de Xiro sin pregunta o equipo identificable', { detail });
            return;
        }
        const k = key(teamName, questionKey);
        answers.set(k, detail.answer || {});
        logFn('leader', 'info', `Xiro respondió ${questionKey} (${teamName})`, { answer: detail.answer });
        (waiters.get(k) || []).forEach(resolve => resolve(answers.get(k)));
        waiters.delete(k);
    }

    function waitForAnswer(teamName, questionKey) {
        const k = key(teamName, questionKey);
        if (answers.has(k)) return Promise.resolve(answers.get(k));
        if (!diagnosticTimer) {
            diagnosticTimer = setTimeout(() => {
                if (socket && detailsSeen === 0) {
                    logFn('leader', 'warn', 'No llega player-answer-detail: ¿servidor reiniciado tras la actualización?');
                }
            }, DIAGNOSTIC_DELAY_MS);
        }
        return new Promise(resolve => {
            const list = waiters.get(k) || [];
            list.push(resolve);
            waiters.set(k, list);
        });
    }

    function start(sessionId, log, options = {}) {
        stop();
        logFn = log || logFn;
        trivial = !!options.trivial;
        let token = null;
        try { token = localStorage.getItem('adminToken'); } catch { /* cookie fallback en servidor */ }

        socket = io(window.location.origin, { transports: ['websocket'], reconnection: true });
        const join = () => socket.emit('join-remote-presenter', { pin: sessionId.split('-')[0], token });
        socket.on('connect', join);
        socket.on('remote-join-success', (snapshot) => {
            if (snapshot?.sessionId && snapshot.sessionId !== sessionId) {
                logFn('leader', 'warn', `Observador unido a otra sesión (${snapshot.sessionId})`);
            }
            if (typeof snapshot?.currentIndex === 'number' && snapshot.state !== 'lobby') currentIndex = snapshot.currentIndex;
            setTeams(snapshot?.teamConfig?.teams);
        });
        socket.on('remote-join-failed', d => logFn('leader', 'warn', `Observador Xiro no disponible: ${d?.message || d?.reason}`));
        socket.on('team-update', d => setTeams(d?.teams));
        socket.on('player-answer-detail', record);
        socket.on('game-started', d => { currentIndex = d?.currentIndex ?? 0; });
        socket.on('new-question', (d) => {
            if (trivial) round++;
            if (typeof d?.currentIndex === 'number') currentIndex = d.currentIndex;
        });
    }

    function stop() {
        if (socket) socket.disconnect();
        socket = null;
        teams = [];
        trivial = false;
        round = 0;
        currentIndex = null;
        detailsSeen = 0;
        clearTimeout(diagnosticTimer);
        diagnosticTimer = null;
        answers.clear();
        waiters.clear();
    }

    return { start, stop, keyFor, teamHasLeader, waitForAnswer, isLeader };
}());
