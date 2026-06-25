/**
 * GameStateMachine - Máquina de estados del juego usando XState
 * 
 * Define el flujo completo del juego desde el lobby hasta el final,
 * con transiciones, guards y actions explícitas.
 * 
 * Estados:
 * - idle: Juego no iniciado
 * - lobby: Esperando jugadores
 * - countdown: Cuenta regresiva antes de empezar
 * - questionActive: Pregunta mostrada, jugadores pueden responder
 * - answering: Jugadores están respondiendo (timer activo)
 * - scoring: Calculando puntuaciones
 * - results: Mostrando resultados de la pregunta
 * - gameEnd: Juego terminado
 * 
 * @module domain/state/GameStateMachine
 */

const { createMachine, assign } = require('xstate');

/**
 * Máquina de estados del juego
 */
const gameStateMachine = createMachine({
    id: 'game',
    initial: 'idle',
    context: {
        currentQuestionIndex: 0,
        totalQuestions: 0,
        canAnswer: false,
        questionStartTime: null,
        isTeamMode: false,
        isPaused: false,
        scores: {},
        answerStats: {},
        players: [],
        questions: []
    },
    // Eventos globales que funcionan en cualquier estado
    on: {
        // Sincronizar índice desde legacy sin cambiar de estado
        SYNC_QUESTION_INDEX: {
            actions: assign({
                currentQuestionIndex: ({ event }) => event.index
            })
        }
    },
    states: {
        /**
         * IDLE: Juego no iniciado
         * - Esperando que se cree el juego
         */
        idle: {
            on: {
                CREATE_GAME: {
                    target: 'lobby',
                    actions: assign({
                        questions: ({ event }) => event.questions,
                        totalQuestions: ({ event }) => event.questions.length,
                        isTeamMode: ({ event }) => event.isTeamMode || false,
                        currentQuestionIndex: 0,
                        scores: {},
                        answerStats: {}
                    })
                }
            }
        },

        /**
         * LOBBY: Esperando jugadores
         * - Los jugadores pueden unirse
         * - El presentador puede iniciar el juego
         */
        lobby: {
            on: {
                PLAYER_JOIN: {
                    actions: assign({
                        players: ({ context, event }) => {
                            const existingPlayer = context.players.find(p => p.nickname === event.playerNickname);
                            if (existingPlayer) {
                                return context.players;
                            }
                            return [...context.players, {
                                nickname: event.playerNickname,
                                score: 0,
                                answeredQuestions: []
                            }];
                        }
                    })
                },
                PLAYER_LEAVE: {
                    actions: assign({
                        players: ({ context, event }) =>
                            context.players.filter(p => p.nickname !== event.playerNickname)
                    })
                },
                START_GAME: {
                    target: 'countdown',
                    guard: ({ context }) => context.players.length > 0 && context.totalQuestions > 0
                }
            }
        },

        /**
         * COUNTDOWN: Cuenta regresiva antes de la primera pregunta
         * - Muestra 3... 2... 1... ¡GO!
         * - Prepara la primera pregunta
         */
        countdown: {
            entry: assign({
                currentQuestionIndex: 0
            }),
            on: {
                COUNTDOWN_COMPLETE: {
                    target: 'questionActive'
                }
            }
        },

        /**
         * QUESTION_ACTIVE: Pregunta revelada al presentador
         * - La pregunta se muestra al presentador
         * - Los jugadores aún no pueden ver ni responder
         */
        questionActive: {
            entry: assign({
                canAnswer: false,
                questionStartTime: null,
                answerStats: ({ context }) => {
                    // Resetear stats para nueva pregunta
                    const currentQuestion = context.questions[context.currentQuestionIndex];
                    if (!currentQuestion || !currentQuestion.options) return {};

                    const stats = {};
                    currentQuestion.options.forEach((_, index) => {
                        stats[index] = 0;
                    });
                    return stats;
                }
            }),
            on: {
                REVEAL_TO_PLAYERS: {
                    target: 'answering',
                    actions: assign({
                        canAnswer: true,
                        questionStartTime: () => Date.now()
                    })
                }
            }
        },

        /**
         * ANSWERING: Jugadores pueden responder
         * - Timer activo
         * - Se aceptan respuestas
         * - El presentador puede pausar/reanudar
         */
        answering: {
            on: {
                SUBMIT_ANSWER: {
                    actions: assign({
                        answerStats: ({ context, event }) => ({
                            ...context.answerStats,
                            [event.answerIndex]: (context.answerStats[event.answerIndex] || 0) + 1
                        })
                    }),
                    guard: ({ context }) => context.canAnswer && !context.isPaused
                },
                PAUSE_TIMER: {
                    actions: assign({
                        isPaused: true,
                        canAnswer: false
                    }),
                    guard: ({ context }) => !context.isPaused
                },
                RESUME_TIMER: {
                    actions: assign({
                        isPaused: false,
                        canAnswer: true
                    }),
                    guard: ({ context }) => context.isPaused
                },
                TIME_UP: {
                    target: 'scoring',
                    actions: assign({
                        canAnswer: false
                    })
                },
                REVEAL_RESULTS: {
                    target: 'scoring',
                    actions: assign({
                        canAnswer: false
                    })
                }
            }
        },

        /**
         * SCORING: Calculando puntuaciones
         * - Procesa todas las respuestas
         * - Actualiza scores de jugadores/equipos
         * - Prepara datos para mostrar resultados
         */
        scoring: {
            entry: assign({
                canAnswer: false
            }),
            on: {
                SCORING_COMPLETE: {
                    target: 'results'
                }
            }
        },

        /**
         * RESULTS: Mostrando resultados de la pregunta
         * - Muestra respuesta correcta
         * - Muestra ranking actualizado
         * - Muestra estadísticas de respuestas
         */
        results: {
            on: {
                NEXT_QUESTION: {
                    target: 'questionActive',
                    actions: assign({
                        currentQuestionIndex: ({ context, event }) => {
                            // Si el evento incluye skipIncrement=true, no incrementar
                            // Útil cuando el legacy ya incrementó
                            if (event.skipIncrement) {
                                return context.currentQuestionIndex;
                            }
                            return context.currentQuestionIndex + 1;
                        }
                    }),
                    guard: ({ context }) => context.currentQuestionIndex < context.totalQuestions - 1
                },
                END_GAME: {
                    target: 'gameEnd',
                    guard: ({ context }) => context.currentQuestionIndex >= context.totalQuestions - 1
                }
            }
        },

        /**
         * GAME_END: Juego terminado
         * - Muestra podio final
         * - Muestra estadísticas globales
         * - Estado final del juego
         */
        gameEnd: {
            type: 'final',
            entry: assign({
                canAnswer: false
            })
        }
    }
});

/**
 * Helper: Obtiene el estado actual legible
 */
function getCurrentStateName(state) {
    if (typeof state === 'string') return state;
    if (state && state.value) return state.value;
    return 'unknown';
}

/**
 * Helper: Verifica si puede aceptar respuestas
 */
function canAcceptAnswers(state, context) {
    const stateName = getCurrentStateName(state);
    return stateName === 'answering' && context.canAnswer && !context.isPaused;
}

/**
 * Helper: Verifica si el juego está en progreso
 */
function isGameInProgress(state) {
    const stateName = getCurrentStateName(state);
    return ['countdown', 'questionActive', 'answering', 'scoring', 'results'].includes(stateName);
}

/**
 * Helper: Verifica si puede avanzar a siguiente pregunta
 */
function canGoToNextQuestion(context) {
    return context.currentQuestionIndex < context.totalQuestions - 1;
}

/**
 * Helper: Verifica si el juego debe terminar
 */
function shouldEndGame(context) {
    return context.currentQuestionIndex >= context.totalQuestions - 1;
}

module.exports = {
    gameStateMachine,
    getCurrentStateName,
    canAcceptAnswers,
    isGameInProgress,
    canGoToNextQuestion,
    shouldEndGame
};
