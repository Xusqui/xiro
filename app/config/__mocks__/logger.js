/**
 * Mock del logger para tests.
 * Silencia todos los logs para evitar que contaminen los logs de PM2 durante la ejecución de tests.
 */

const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    http: jest.fn(),
    debug: jest.fn(),
    // Helpers de dominio
    socket: jest.fn(),
    db: jest.fn(),
    game: jest.fn(),
    auth: jest.fn(),
    security: jest.fn(),
    performance: jest.fn(),
    // Stream para Morgan
    stream: {
        write: jest.fn()
    },
    isDebugEnabled: jest.fn().mockReturnValue(true)
};

module.exports = mockLogger;
