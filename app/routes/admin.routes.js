/**
 * @fileoverview Rutas de autenticación del panel de administración (estado, registro, login y logout).
 * El resto de rutas admin están en routes/admin-*.routes.js y se montan desde aquí.
 */

const express = require('express');
const { JWT_EXPIRES_IN } = require('../config/constants');
const { loginLimiter, resetLoginLimiter } = require('../middlewares/security');
const { schemas, validateBody } = require('../validation');
const logger = require('../config/logger');
const { LEGAL_TERMS_VERSION } = require('../config/legal');
const adminUserService = require('../services/db/admin-user.service');
const { verifyPassword } = require('../services/auth/password-hasher');

const adminUsersRoutes = require('./admin-users.routes');
const adminSystemRoutes = require('./admin-system.routes');
const adminFilesRoutes = require('./admin-files.routes');
const adminDisconnectRoutes = require('./admin-disconnect.routes');
const adminProcessRoutes = require('./admin-process.routes');
const adminAccountRoutes = require('./admin-account.routes');
const adminAccountEmailRoutes = require('./admin-account-email.routes');
const adminAccountDeleteRoutes = require('./admin-account-delete.routes');
const adminRegisterRoutes = require('./admin-register.routes');
const { buildAuthToken, buildCookieOptions } = require('./helpers/admin-auth-helpers');

const router = express.Router();

// Se resuelve por petición para respetar cambios en caliente (runtime-config)

/**
 * Estado de autenticación admin
 * Permite al frontend saber si debe mostrar el onboarding del primer admin.
 */
router.get('/api/admin-auth/status', loginLimiter, async (req, res) => {
    try {
        const hasUsers = await adminUserService.hasAnyUsers();
        res.json({
            success: true,
            hasUsers,
            setupRequired: !hasUsers
        });
    } catch (error) {
        logger.error('Error checking auth status', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'No se pudo verificar el estado de autenticación',
            code: 'ADMIN_AUTH_STATUS_FAILED'
        });
    }
});

// Cuenta del administrador (perfil, contraseña, email y eliminación): ver routes/admin-account*.routes.js
router.use(adminAccountRoutes);
router.use(adminAccountEmailRoutes);
router.use(adminAccountDeleteRoutes);

// Usuarios del panel (listar, eliminar, cambiar rol): ver routes/admin-users.routes.js
router.use(adminUsersRoutes);

// Registro y confirmación de cuentas: ver routes/admin-register.routes.js
router.use(adminRegisterRoutes);

/**
 * Comprueba que la cuenta ha aceptado los términos vigentes; si los acepta ahora, lo registra.
 * @returns {Promise<boolean>} false si ya se ha respondido con el error
 */
async function ensureTermsAccepted(req, res, user) {
    if (user.terms_version === LEGAL_TERMS_VERSION) return true;
    if (req.body.acceptTerms !== true) {
        res.status(403).json({
            success: false,
            error: 'Debes aceptar los términos y la política de privacidad',
            code: 'TERMS_ACCEPTANCE_REQUIRED'
        });
        return false;
    }
    await adminUserService.recordTermsAcceptance(user.id, LEGAL_TERMS_VERSION);
    return true;
}

/**
 * Endpoint de login con JWT y rate limiting
 */
router.post('/api/admin-login', loginLimiter, validateBody(schemas.login), async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await adminUserService.getActiveUserByUsername(username);

        if (!user) {
            logger.security('Login failed - unknown user', { username, ip: req.ip });
            return res.status(401).json({
                success: false,
                error: 'Usuario o contraseña incorrectos',
                code: 'ADMIN_LOGIN_INVALID_CREDENTIALS'
            });
        }

        const passwordOk = await verifyPassword(password, user.password_hash);
        if (!passwordOk) {
            logger.security('Login failed - invalid password', { userId: user.id, ip: req.ip });
            return res.status(401).json({
                success: false,
                error: 'Usuario o contraseña incorrectos',
                code: 'ADMIN_LOGIN_INVALID_CREDENTIALS'
            });
        }

        if (!(await ensureTermsAccepted(req, res, user))) return undefined;

        const token = buildAuthToken(user);

        logger.auth('Login successful', { userId: user.id, role: user.role, ip: req.ip });

        resetLoginLimiter(req);

        res.cookie('adminToken', token, buildCookieOptions());
        return res.json({
            success: true,
            token,
            role: user.role,
            username: user.username,
            expiresIn: JWT_EXPIRES_IN
        });
    } catch (error) {
        logger.error('Admin login failed unexpectedly', { error: error.message, ip: req.ip });
        return res.status(500).json({
            success: false,
            error: 'Error interno durante el login',
            code: 'ADMIN_LOGIN_INTERNAL_ERROR'
        });
    }
});

/**
 * Cierra la sesión del admin eliminando la cookie HttpOnly.
 * No requiere autenticación: solo limpia la cookie.
 */
router.post('/api/admin-logout', (req, res) => {
    res.clearCookie('adminToken', buildCookieOptions());
    logger.auth('Admin logout', { ip: req.ip });
    return res.json({ success: true });
});

// Reinicio del contenedor y recarga de PM2: ver routes/admin-process.routes.js
router.use(adminProcessRoutes);

// Listado de JSON y limpieza de huérfanos: ver routes/admin-files.routes.js
router.use(adminFilesRoutes);

// Métricas, salud de BD, caché y logs: ver routes/admin-system.routes.js
router.use(adminSystemRoutes);

// Desconexión forzada de jugadores (solo desarrollo): ver routes/admin-disconnect.routes.js
router.use(adminDisconnectRoutes);

module.exports = router;
