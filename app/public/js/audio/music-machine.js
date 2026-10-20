/**
 * @fileoverview Máquina de estados de la música (XState v5). El juego le envía
 * eventos musicales y la máquina decide a qué escena ir; las acciones (entrar en
 * una escena, pausar la tensión…) las implementa quien la crea, normalmente con
 * llamadas a MusicEngine. Los eventos que no tocan en un estado se ignoran.
 *
 * Export dual: Jest la prueba con el xstate de node_modules; en el navegador se
 * usa con la copia de public/vendor/xstate (self.XState).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.machine = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const MUSIC_EVENTS = [
        'LOBBY',
        'BOARD',
        'PRE_QUESTION',
        'QUESTION',
        'SLIDE',
        'REVEAL',
        'REVEAL_DONE',
        'PODIUM',
        'PODIUM_STEP',
        'TIMER_PAUSE',
        'TIMER_RESUME',
        'STOP'
    ];

    const ACTIONS = [
        'stopMusic',
        'playLobby',
        'playBoard',
        'playPreQuestion',
        'playQuestion',
        'playReveal',
        'playLeaderboard',
        'playPodium',
        'podiumStep',
        'pauseTension',
        'resumeTension'
    ];

    // Una pregunta nueva vuelve a entrar en 'question' aunque ya se esté ahí
    const TO_QUESTION = { target: 'question', reenter: true };
    // Pantalla de puntuación aleatoria: la música entra ya en la pregunta
    const TO_PRE_QUESTION = 'preQuestion';

    const musicMachineConfig = {
        id: 'music',
        initial: 'idle',
        states: {
            idle: {
                entry: 'stopMusic',
                on: {
                    LOBBY: 'lobby',
                    BOARD: 'board',
                    PRE_QUESTION: TO_PRE_QUESTION,
                    QUESTION: TO_QUESTION,
                    SLIDE: 'leaderboard',
                    PODIUM: 'podium'
                }
            },
            lobby: {
                entry: 'playLobby',
                on: {
                    PRE_QUESTION: TO_PRE_QUESTION,
                    QUESTION: TO_QUESTION,
                    BOARD: 'board',
                    SLIDE: 'leaderboard',
                    PODIUM: 'podium',
                    STOP: 'idle'
                }
            },
            // Tablero del Trivial: espera tranquila entre tiradas
            board: {
                entry: 'playBoard',
                on: {
                    PRE_QUESTION: TO_PRE_QUESTION,
                    QUESTION: TO_QUESTION,
                    SLIDE: 'leaderboard',
                    PODIUM: 'podium',
                    STOP: 'idle'
                }
            },
            // Mientras se ve la puntuación aleatoria: suena la pregunta (tensión 0, sin
            // reloj); al llegar la pregunta solo arranca el reloj, sin otro cambio de escena
            preQuestion: {
                entry: 'playPreQuestion',
                on: { QUESTION: TO_QUESTION, SLIDE: 'leaderboard', BOARD: 'board', PODIUM: 'podium', STOP: 'idle' }
            },
            question: {
                entry: 'playQuestion',
                on: {
                    PRE_QUESTION: TO_PRE_QUESTION,
                    QUESTION: TO_QUESTION,
                    REVEAL: 'reveal',
                    SLIDE: 'leaderboard',
                    BOARD: 'board',
                    PODIUM: 'podium',
                    STOP: 'idle',
                    TIMER_PAUSE: { actions: 'pauseTension' },
                    TIMER_RESUME: { actions: 'resumeTension' }
                }
            },
            // Fill + stinger; el motor avisa con REVEAL_DONE y se pasa al marcador
            reveal: {
                entry: 'playReveal',
                on: {
                    REVEAL_DONE: 'leaderboard',
                    PRE_QUESTION: TO_PRE_QUESTION,
                    QUESTION: TO_QUESTION,
                    SLIDE: 'leaderboard',
                    BOARD: 'board',
                    PODIUM: 'podium',
                    STOP: 'idle'
                }
            },
            leaderboard: {
                entry: 'playLeaderboard',
                on: {
                    PRE_QUESTION: TO_PRE_QUESTION,
                    QUESTION: TO_QUESTION,
                    BOARD: 'board',
                    PODIUM: 'podium',
                    STOP: 'idle'
                }
            },
            podium: {
                entry: 'playPodium',
                on: { PODIUM_STEP: { actions: 'podiumStep' }, LOBBY: 'lobby', STOP: 'idle' }
            }
        }
    };

    /**
     * @param {object} XState  Módulo xstate (require('xstate') o self.XState)
     * @param {Object<string, Function>} actions  Implementaciones ({ event }) => void;
     *        las que falten quedan como no-op.
     */
    function createMusicMachine(XState, actions) {
        const impl = {};
        ACTIONS.forEach(function (name) {
            impl[name] = (actions && actions[name]) || function () {};
        });
        return XState.createMachine(musicMachineConfig).provide({ actions: impl });
    }

    return { MUSIC_EVENTS, ACTIONS, musicMachineConfig, createMusicMachine };
});
