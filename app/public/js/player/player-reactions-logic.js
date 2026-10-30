/**
 * @fileoverview Modelo de la bandeja de reacciones con emoji del jugador. Datos puros.
 *
 * La bandeja se ve con las reacciones activas y fuera de la pregunta (lobby,
 * diapositivas, Actividad, revisión, pregunta revelada) o cuando el jugador ya ve su
 * resultado: 'answer-result', que en individual llega al responder y en equipos cuando
 * responde todo el equipo (mismas reglas que domain/services/ReactionPolicy.js).
 * trySend imita el límite del servidor (ráfaga de 3, una cada 400 ms) para no mandar
 * toques que el servidor descartaría.
 *
 * Eventos de dispatch: state { enabled, set }, lobby, question { question, review },
 * answered, revealed, ended, snapshot { snapshot } (reconexión).
 * Export dual: require en Jest; self.XiroPlayerReactions en el navegador (necesita
 * self.XiroReactions, de core/reactions-catalog.js, cargado antes).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(module.require('../core/reactions-catalog.js'));
    } else {
        root.XiroPlayerReactions = factory(root.XiroReactions);
    }
})(typeof self !== 'undefined' ? self : this, function (catalog) {
    'use strict';

    // Mismo criterio que domain/services/QuestionScoringPolicy (NO_TIMER_SLIDE_TYPES)
    const SLIDE_TYPES = ['comment', 'info', 'text', 'image', 'text-image', 'video', 'canvas'];
    const BURST = 3;
    const REFILL_MS = 400;

    function isSlide(question) {
        return Boolean(question) && SLIDE_TYPES.indexOf(question.slide_type) !== -1;
    }

    function phaseFromQuestion(question, review) {
        return review || isSlide(question) ? 'free' : 'open';
    }

    function phaseFromSnapshot(snapshot) {
        const gs = snapshot && snapshot.gameState;
        if (!gs || gs.isTrivialBoardPhase || gs.reviewMode || !gs.currentQuestion) return 'free';
        return phaseFromQuestion(gs.currentQuestion, gs.reactionsOpen === true);
    }

    function createReactionsModel(options) {
        const now = (options && options.now) || Date.now;
        let enabled = false;
        let set = [];
        let phase = 'none';
        let tokens = BURST;
        let refilledAt = now();

        function next(event) {
            switch (event.type) {
                case 'lobby':
                    return 'free';
                case 'question':
                    return phaseFromQuestion(event.question, event.review);
                case 'answered':
                case 'revealed':
                    return 'free';
                case 'snapshot':
                    return phaseFromSnapshot(event.snapshot);
                case 'ended':
                    return 'ended';
                default:
                    return phase;
            }
        }

        function dispatch(event) {
            if (!event) return;
            if (event.type === 'state') {
                enabled = event.enabled === true;
                set = catalog.normalize(event.set);
                return;
            }
            if (phase !== 'ended') phase = next(event);
        }

        function view() {
            return { visible: enabled && phase === 'free' && set.length > 0, set: set.slice() };
        }

        function refill() {
            const t = now();
            const gained = Math.floor((t - refilledAt) / REFILL_MS);
            if (gained > 0) {
                tokens = Math.min(BURST, tokens + gained);
                refilledAt = tokens === BURST ? t : refilledAt + gained * REFILL_MS;
            }
        }

        function trySend(reaction) {
            if (!view().visible || set.indexOf(reaction) === -1) return false;
            refill();
            if (tokens < 1) return false;
            tokens -= 1;
            return true;
        }

        return { dispatch: dispatch, view: view, trySend: trySend };
    }

    return { createReactionsModel: createReactionsModel, isSlide: isSlide };
});
