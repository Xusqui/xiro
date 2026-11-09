/**
 * @fileoverview Módulo de validación para Xiro! (Joi).
 * Punto de entrada: reexporta la misma API que el antiguo validation.js, repartida por dominio:
 * primitives (base), questions, quizzes, auth, banks-games, websocket-lobby, websocket-game y middleware.
 */

const primitives = require('./primitives');
const quizzes = require('./quizzes');
const auth = require('./auth');
const banksGames = require('./banks-games');
const websocketLobby = require('./websocket-lobby');
const websocketGame = require('./websocket-game');
const middleware = require('./middleware');

// ===== EXPORTACIONES =====
module.exports = {
    // Constantes
    LIMITS: primitives.LIMITS,

    // Esquemas
    schemas: {
        presenterPinParams: quizzes.presenterPinParamsSchema,
        createQuiz: quizzes.createQuizSchema,
        dbIdParams: quizzes.dbIdParamsSchema,
        adminSessionId: quizzes.adminSessionIdSchema,
        searchQuestionsQuery: quizzes.searchQuestionsQuerySchema,

        // Auth
        login: auth.loginSchema,
        register: auth.registerSchema,
        changePassword: auth.changePasswordSchema,
        passwordResetRequest: auth.passwordResetRequestSchema,
        passwordResetConfirm: auth.passwordResetConfirmSchema,
        changeEmailRequest: auth.changeEmailRequestSchema,
        userLicense: auth.userLicenseSchema,
        userLicenseCheckout: auth.userLicenseCheckoutSchema,
        licenseExemption: auth.licenseExemptionSchema,

        // Bancos
        createBank: banksGames.createBankSchema,
        saveBank: banksGames.saveBankSchema,
        mergeBanks: banksGames.mergeBanksSchema,
        validatePinQuery: banksGames.validatePinQuerySchema,

        // Juegos
        game: banksGames.gameSchema,

        // Juegos personalizados
        createCustomGame: banksGames.createCustomGameSchema,
        updateCustomGame: banksGames.updateCustomGameSchema,

        // WebSocket
        joinLobby: websocketLobby.joinLobbySchema,
        joinPresenterLobby: websocketLobby.joinPresenterLobbySchema,
        reconnectPlayer: websocketLobby.reconnectPlayerSchema,
        submitAnswer: websocketLobby.submitAnswerSchema,
        manualPoints: websocketLobby.manualPointsSchema,

        // FASE 1 - Semana 3: Nuevos schemas
        leaveLobby: websocketLobby.leaveLobbySchema,
        selectTeam: websocketLobby.selectTeamSchema,
        startGame: websocketGame.startGameSchema,
        nextQuestion: websocketGame.nextQuestionSchema,
        pauseTimer: websocketGame.pauseTimerSchema,
        resumeTimer: websocketGame.resumeTimerSchema,
        getCurrentState: websocketGame.getCurrentStateSchema,
        reconnectPresenter: websocketGame.reconnectPresenterSchema,
        endGame: websocketGame.endGameSchema,
        abandonGame: websocketGame.abandonGameSchema,

        // Comunes
        dbId: primitives.dbIdSchema,
        pin: primitives.pinSchema,
        nickname: primitives.nicknameSchema
    },

    // Funciones
    validate: middleware.validate,
    validateBody: middleware.validateBody,
    validateQuery: middleware.validateQuery,
    validateParams: middleware.validateParams,
    validateSocket: middleware.validateSocket
};
