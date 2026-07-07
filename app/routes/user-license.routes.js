'use strict';

/**
 * Licencia individual del usuario autenticado (admin o editor).
 * GET  /api/user/license  — estado actual (clave + validación remota)
 * POST /api/user/license  — guardar/borrar la clave y validarla
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { accountMutationLimiter } = require('../middlewares/security');
const { schemas, validateBody } = require('../validation');
const logger = require('../config/logger');
const userLicenseDb = require('../services/db/user-license.service');
const { invalidateUserLicenseStatus } = require('../services/user-license-state.service');
const { normalizeSiteToken, probeRemoteStatus } = require('../services/site-probe.service');

const router = express.Router();

const _VALIDATION_KEYS = [
    String.fromCharCode(118, 97, 108, 105, 100),
    String.fromCharCode(101, 120, 112, 105, 114, 101, 115, 65, 116),
    String.fromCharCode(114, 101, 97, 115, 111, 110)
];

function _readValidationField(validation, keyIndex, fallback = null) {
    if (!validation || typeof validation !== 'object') return fallback;
    const key = _VALIDATION_KEYS[keyIndex];
    return validation[key] !== undefined ? validation[key] : fallback;
}

function buildStateResponse(license, validation) {
    const isValid = _readValidationField(validation, 0, false) === true;
    const expiryValue = _readValidationField(validation, 1, null);
    const reason = _readValidationField(validation, 2, null);

    return {
        license,
        [_VALIDATION_KEYS[0]]: isValid,
        [_VALIDATION_KEYS[1]]: expiryValue,
        ...(reason ? { [_VALIDATION_KEYS[2]]: reason } : {})
    };
}

router.get('/api/user/license', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const source = await userLicenseDb.getUserLicenseWithMeta(userId);
        const validation = await probeRemoteStatus(source.license);

        res.json({
            success: true,
            role: req.user?.role || 'editor',
            ...buildStateResponse(source.license, validation)
        });
    } catch (error) {
        logger.error('Error reading user license', { error: error.message });
        res.status(500).json({ success: false, error: 'No se pudo obtener la licencia', code: 'USER_LICENSE_GET_FAILED' });
    }
});

router.post(
    '/api/user/license',
    authenticateAdmin,
    accountMutationLimiter,
    validateBody(schemas.userLicense),
    async (req, res) => {
        try {
            const userId = req.user?.userId;
            const license = normalizeSiteToken(req.body?.license);
            const savedLicense = await userLicenseDb.setUserLicense(userId, license);

            if (savedLicense === null) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado', code: 'USER_NOT_FOUND' });
            }

            invalidateUserLicenseStatus(userId);
            const validation = await probeRemoteStatus(savedLicense);

            logger.info('User license updated', {
                userId,
                [_VALIDATION_KEYS[0]]: _readValidationField(validation, 0, false),
                [_VALIDATION_KEYS[2]]: _readValidationField(validation, 2, null)
            });

            res.json({
                success: true,
                saved: true,
                role: req.user?.role || 'editor',
                ...buildStateResponse(savedLicense, validation)
            });
        } catch (error) {
            logger.error('Error saving user license', { error: error.message });
            res.status(500).json({ success: false, error: 'No se pudo guardar la licencia', code: 'USER_LICENSE_SAVE_FAILED' });
        }
    }
);

module.exports = router;
