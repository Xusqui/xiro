/**
 * @module question-view
 * @description Gestiona el estado de la pregunta activa: recibe eventos del
 *   servidor, actualiza state y notifica a taskpane.js con los datos
 *   necesarios para renderizar la UI de pregunta.
 * @depends [state, socket-client]
 * @server-events
 *   ESCUCHA: game-started, new-question, answer-result, answer-result-batch,
 *            ranking-update, reveal-answer, timer-paused, timer-resumed
 *   EMITE:   next-question, reveal-answer, pause-timer, resume-timer
 * @server-endpoints []
 */

const XiroQuestionView = {
    _onUpdate: null,  // callback para actualizar UI
    _timerInterval: null,
    _timerSeconds: 0,
    _timerPaused: false,

    // ── Arranque/parada ───────────────────────────────────────

    /**
     * Registra el callback de UI y comienza a escuchar eventos de juego.
     * @param {Function} onUpdate — fn(viewData) donde viewData contiene
     *   { question, currentIndex, totalQuestions, answeredCount, totalPlayers,
     *     timer, timerPaused, lastReveal, players }
     */
    start(onUpdate) {
        this._onUpdate = onUpdate || (() => { });
        this._registerEvents();
    },

    stop() {
        this._onUpdate = null;
        this._stopTimer();
    },

    // ── Acciones del presentador ──────────────────────────────

    /** Avanza a la siguiente pregunta. */
    nextQuestion() {
        const sid = XiroState.get('sessionId');      // eslint-disable-line no-undef
        if (sid) XiroSocket.emit('next-question', sid);  // eslint-disable-line no-undef
    },

    /** Revela la respuesta de la pregunta actual. */
    revealAnswer() {
        const sid = XiroState.get('sessionId');      // eslint-disable-line no-undef
        if (sid) XiroSocket.emit('reveal-answer', sid);  // eslint-disable-line no-undef
    },

    /** Pausa/reanuda el timer. */
    toggleTimer() {
        const sid = XiroState.get('sessionId');      // eslint-disable-line no-undef
        if (!sid) return;
        const event = this._timerPaused ? 'resume-timer' : 'pause-timer';
        XiroSocket.emit(event, sid);                 // eslint-disable-line no-undef
    },

    // ── Eventos Socket.IO ─────────────────────────────────────

    _registerEvents() {
        XiroSocket.on('game-started', (data) => {    // eslint-disable-line no-undef
            XiroState.set({                            // eslint-disable-line no-undef
                isGameActive: true,
                totalQuestions: data.totalQuestions,
                currentQuestionIndex: data.currentIndex,
                currentQuestion: data.firstQuestion,
                answeredCount: 0,
                totalPlayers: (data.players || []).length,
                lastReveal: null,
            });
            this._startTimer(data.firstQuestion);
            this._notify();
        });

        XiroSocket.on('new-question', (data) => {    // eslint-disable-line no-undef
            XiroState.set({                            // eslint-disable-line no-undef
                currentQuestionIndex: data.currentIndex,
                totalQuestions: data.totalQuestions,
                currentQuestion: data.question,
                answeredCount: 0,
                lastReveal: null,
            });
            this._stopTimer();
            this._startTimer(data.question);
            this._notify();
        });

        XiroSocket.on('answer-result', () => {       // eslint-disable-line no-undef
            const cur = XiroState.get('answeredCount') || 0;  // eslint-disable-line no-undef
            XiroState.set('answeredCount', cur + 1);   // eslint-disable-line no-undef
            this._notify();
        });

        XiroSocket.on('answer-result-batch', (data) => {   // eslint-disable-line no-undef
            const extra = data.answers ? data.answers.length : 0;
            const cur = XiroState.get('answeredCount') || 0;  // eslint-disable-line no-undef
            XiroState.set('answeredCount', cur + extra); // eslint-disable-line no-undef
            this._notify();
        });

        XiroSocket.on('reveal-answer', (data) => {   // eslint-disable-line no-undef
            this._stopTimer();
            XiroState.set('lastReveal', data);          // eslint-disable-line no-undef
            this._notify();
        });

        XiroSocket.on('timer-paused', (data) => {    // eslint-disable-line no-undef
            this._timerPaused = true;
            this._timerSeconds = Math.ceil(data.remainingTime || 0);
            XiroState.set('timer', this._timerSeconds); // eslint-disable-line no-undef
            this._notify();
        });

        XiroSocket.on('timer-resumed', (data) => {   // eslint-disable-line no-undef
            this._timerPaused = false;
            this._timerSeconds = Math.ceil(data.remainingTime || 0);
            XiroState.set('timer', this._timerSeconds); // eslint-disable-line no-undef
            this._notify();
        });
    },

    // ── Timer local (referencia visual) ──────────────────────

    _startTimer(question) {
        this._stopTimer();
        const limit = question && question.time_limit;
        if (!limit) { XiroState.set('timer', null); return; }  // eslint-disable-line no-undef

        this._timerSeconds = limit;
        this._timerPaused = false;
        XiroState.set('timer', this._timerSeconds);             // eslint-disable-line no-undef

        this._timerInterval = setInterval(() => {
            if (this._timerPaused) return;
            if (this._timerSeconds > 0) {
                this._timerSeconds--;
                XiroState.set('timer', this._timerSeconds);         // eslint-disable-line no-undef
                this._notify();
            } else {
                this._stopTimer();
            }
        }, 1000);
    },

    _stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    },

    _notify() {
        if (!this._onUpdate) return;
        this._onUpdate({
            question: XiroState.get('currentQuestion'),     // eslint-disable-line no-undef
            currentIndex: XiroState.get('currentQuestionIndex'), // eslint-disable-line no-undef
            totalQuestions: XiroState.get('totalQuestions'),       // eslint-disable-line no-undef
            answeredCount: XiroState.get('answeredCount'),        // eslint-disable-line no-undef
            totalPlayers: XiroState.get('totalPlayers'),         // eslint-disable-line no-undef
            timer: XiroState.get('timer'),                // eslint-disable-line no-undef
            timerPaused: this._timerPaused,
            lastReveal: XiroState.get('lastReveal'),           // eslint-disable-line no-undef
        });
    },
};
