/**
 * @module view-question
 * @description Vista de pregunta: lanza pregunta N → timer → revelar → view-ranking.
 *   Emite next-question al servidor. Al revelar → pasa a view-ranking.
 * @depends [dialog-router]
 */

const ViewQuestion = (() => {

    let _socket = null;
    let _meta = null;
    let _session = null;
    let _question = null;
    let _timerHandle = null;
    let _timeLeft = 0;
    let _answered = 0;
    let _total = 0;

    function mount(container, { meta, session }) {
        _meta = meta;
        _session = session;
        _answered = 0;
        _question = null;

        container.innerHTML = `
            <div class="view-question">
                <p class="question-meta" id="vq-meta">Conectando…</p>
                <div class="question-text" id="vq-text">Cargando…</div>
                <div class="question-timer-bar"><div class="question-timer-fill" id="vq-timer-fill" style="width:100%"></div></div>
                <p class="question-stats" id="vq-stats"></p>
                <div class="question-controls" id="vq-controls"></div>
            </div>
        `;

        _connectSocket();
    }

    function _log(level, msg, data) {
        apiPost('/api/addin-log', { level, module: 'view-question', message: msg, data }).catch(() => { }); // eslint-disable-line no-undef
    }

    function _connectSocket() {
        const playerId = _session.playerId || localStorage.getItem('xiro_addin_playerId') || crypto.randomUUID();
        _log('info', 'connectSocket', { playerId, sessionId: _session.sessionId });
        _socket = io({ auth: { playerId }, transports: ['websocket'], upgrade: false, path: '/socket.io/' }); // eslint-disable-line no-undef

        _socket.on('connect', () => {
            _log('info', 'socket connected, sending reconnect-presenter', { playerId });
            _socket.emit('reconnect-presenter', { playerId, token: localStorage.getItem('adminToken') || '' });
        });

        _socket.on('reconnected-success', (snapshot) => {
            const hasGame = !!(snapshot && snapshot.gameState && snapshot.gameState.currentQuestion);
            _log('info', 'reconnected-success', { hasGame, sessionId: _session.sessionId });
            if (hasGame) {
                // Partida ya en curso → avanzar a la siguiente pregunta.
                _socket.emit('next-question', _session.sessionId);
            } else {
                // Sin partida activa → esta es la primera pregunta: iniciar juego.
                _socket.emit('start-game', _session.sessionId);
            }
        });

        _socket.on('reconnect-failed', () => {
            _log('warn', 'reconnect-failed, attempting start-game anyway', { sessionId: _session.sessionId });
            _socket.emit('start-game', _session.sessionId);
        });

        _socket.on('connect_error', (err) => {
            _log('error', 'connect_error', { message: err.message });
            const metaEl = document.getElementById('vq-meta');
            if (metaEl) metaEl.textContent = 'Error de conexión: ' + err.message;
        });

        _socket.on('game-start-error', (d) => {
            _log('error', 'game-start-error', d);
            const metaEl = document.getElementById('vq-meta');
            if (metaEl) metaEl.textContent = 'Error al iniciar: ' + (d.message || '');
        });

        _socket.on('new-question', (data) => {
            _log('info', 'new-question received', { index: data.currentIndex });
            _question = data.question;
            _total = 0;
            _renderQuestion(data);
        });

        _socket.on('game-started', (data) => {
            _log('info', 'game-started received', { totalQuestions: data.totalQuestions, currentIndex: data.currentIndex });
            _total = data.totalQuestions || 0;
            _question = data.firstQuestion;
            _renderQuestion({
                question: data.firstQuestion,
                currentIndex: data.currentIndex || 0,
                totalQuestions: data.totalQuestions || 0,
            });
        });

        _socket.on('answer-result', () => {
            _answered++;
            _updateStats();
        });

        _socket.on('reveal-answer', () => {
            _log('info', 'reveal-answer received');
            _clearTimer();
            _showRevealButtons();
        });

        _socket.on('timer-paused', (d) => { _clearTimer(); _timeLeft = Math.ceil(d.remainingTime); });
        _socket.on('timer-resumed', (d) => { _timeLeft = Math.ceil(d.remainingTime); _startCountdown(); });
    }

    function _renderQuestion(data) {
        const q = data.question;
        const metaEl = document.getElementById('vq-meta');
        const textEl = document.getElementById('vq-text');
        const ctrlEl = document.getElementById('vq-controls');
        if (metaEl) metaEl.textContent = `Pregunta ${(data.currentIndex || 0) + 1} / ${data.totalQuestions || '?'}`;
        if (textEl) textEl.textContent = q.title || q.question_text || '—';

        _timeLeft = q.time_limit || 30;
        _startCountdown();

        if (ctrlEl) {
            ctrlEl.innerHTML = `
                <button class="dlg-btn dlg-btn-ghost" id="vq-pause">⏸ Pausar</button>
                <button class="dlg-btn dlg-btn-danger" id="vq-reveal">Revelar respuesta</button>
            `;
            document.getElementById('vq-pause').addEventListener('click', () => {
                if (_socket) _socket.emit('pause-timer', _session.sessionId);
            });
            document.getElementById('vq-reveal').addEventListener('click', () => {
                if (_socket) _socket.emit('reveal-answer', _session.sessionId);
            });
        }
        _updateStats();
    }

    function _startCountdown() {
        _clearTimer();
        const fill = document.getElementById('vq-timer-fill');
        const totalTime = _question?.time_limit || 30;
        _timerHandle = setInterval(() => {
            _timeLeft = Math.max(0, _timeLeft - 1);
            if (fill) fill.style.width = ((_timeLeft / totalTime) * 100) + '%';
            _updateStats();
            if (_timeLeft <= 0) _clearTimer();
        }, 1000);
    }

    function _clearTimer() {
        if (_timerHandle) { clearInterval(_timerHandle); _timerHandle = null; }
    }

    function _updateStats() {
        const el = document.getElementById('vq-stats');
        if (el) el.textContent = `${_answered} respuestas · ${_timeLeft}s`;
    }

    function _showRevealButtons() {
        const ctrlEl = document.getElementById('vq-controls');
        if (!ctrlEl) return;
        ctrlEl.innerHTML = `
            <button class="dlg-btn dlg-btn-primary" id="vq-next">Siguiente diapositiva ▶</button>
        `;
        document.getElementById('vq-next').addEventListener('click', () => {
            // Notificar al task pane: cerrará el diálogo y avanzará slide
            _notifyParent({ event: 'question-done', index: _meta ? _meta.index : 0 }); // eslint-disable-line no-undef
        });
    }

    function unmount() {
        _clearTimer();
        if (_socket) { try { _socket.disconnect(); } catch (_) { } _socket = null; }
    }

    return { mount, unmount };
})();
