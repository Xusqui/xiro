'use strict';

const express = require('express');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const logger = require('../config/logger');
const siteSettingsService = require('../services/db/site-settings.service');
const siteStateService = require('../services/site-state.service');
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

function buildStateResponse(siteToken, validation) {
    const isValid = _readValidationField(validation, 0, false) === true;
    const expiryValue = _readValidationField(validation, 1, null);
    const reason = _readValidationField(validation, 2, null);

    return {
        license: siteToken,
        [_VALIDATION_KEYS[0]]: isValid,
        [_VALIDATION_KEYS[1]]: expiryValue,
        ...(reason ? { [_VALIDATION_KEYS[2]]: reason } : {})
    };
}

router.get('/api/license/public-status', async (_req, res) => {
    try {
        const status = await siteStateService.getPublicLicenseStatus();
        res.json({
            success: true,
            licensed: status.licensed,
            checkedAt: status.checkedAt,
            expiresAt: status.expiresAt,
            reason: status.reason
        });
    } catch (error) {
        logger.error('Error getting public license status', { error: error.message });
        res.status(500).json({ success: false, error: 'No se pudo comprobar el estado de licencia', code: 'LICENSE_STATUS_CHECK_FAILED' });
    }
});

router.get('/api/admin/license', authenticateAdmin, authorizeAdmin, async (_req, res) => {
    try {
        const siteToken = await siteSettingsService.getSiteLicense();
        const validation = await probeRemoteStatus(siteToken);

        res.json({
            success: true,
            ...buildStateResponse(siteToken, validation)
        });
    } catch (error) {
        logger.error('Error reading site license', { error: error.message });
        res.status(500).json({ success: false, error: 'No se pudo obtener la licencia', code: 'LICENSE_GET_FAILED' });
    }
});

router.post('/api/admin/license', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const siteToken = normalizeSiteToken(req.body?.license);
        const savedToken = await siteSettingsService.setSiteLicense(siteToken);
        const validation = await probeRemoteStatus(savedToken);

        logger.info('Site license updated', {
            [_VALIDATION_KEYS[0]]: _readValidationField(validation, 0, false),
            [_VALIDATION_KEYS[2]]: _readValidationField(validation, 2, null)
        });

        res.json({
            success: true,
            saved: true,
            ...buildStateResponse(savedToken, validation)
        });
    } catch (error) {
        logger.error('Error saving site license', { error: error.message });
        res.status(500).json({ success: false, error: 'No se pudo guardar la licencia', code: 'LICENSE_SAVE_FAILED' });
    }
});

module.exports = router;
