/* global presenterPlayerId */
window.TVApp = window.TVApp || {};
window.TVApp.State = (function () {
    'use strict';

    // Verificar que presenterPlayerId esté definido (viene de localStorage via inline script)
    if (typeof presenterPlayerId === 'undefined') {
        console.log('ERROR: presenterPlayerId no definido');
    }

    var state = {
        playerId: typeof presenterPlayerId !== 'undefined' ? presenterPlayerId : null,
        pin: null,
        sessionId: null, // ID de sesión único (PIN-UUID)
        totalPlayers: 0,
        timerInterval: null,
        rafHandle: null, // RequestAnimationFrame handle
        lastTimerUpdate: 0, // Timestamp del último segundo contado
        isDirty: false, // Flag para renderizado condicional
        currentQuestionIndex: 0,
        totalQuestions: 0,
        connectedPlayers: [],
        playersData: {},
        timerPaused: false,
        currentSeconds: 20,
        filtroActivo: 'todos',
        todosLosPins: [],
        isTeamMode: false,
        teamConfig: null,
        currentQuestion: null, // Almacena la pregunta actual para acceso en reveal-answer
        trivialState: null // Almacena estado para Trivial
    };

    return state;
})();
