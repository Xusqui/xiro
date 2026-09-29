'use strict';

/**
 * Liberación de contenido de editores (solo administrador).
 * GET  /api/admin/license-exemptions            — contenido de editores + estado
 * POST /api/admin/license-exemptions/:type/:id  — liberar/restringir un contenido
 */

const express = require('express');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const { schemas, validateBody } = require('../validation');
const logger = require('../config/logger');
const exemptionService = require('../services/db/license-exemption.service');
const { invalidateOwnerCacheForPin } = require('../services/user-license-state.service');

const router = express.Router();

const VALID_TYPES = new Set(['bank', 'game', 'custom_game', 'trivial', 'quiz']);

router.get('/api/admin/license-exemptions', authenticateAdmin, authorizeAdmin, async (_req, res) => {
    try {
        const items = await exemptionService.listEditorContent();
        res.json({ success: true, items });
    } catch (error) {
        logger.error('Error listing license exemptions', { error: error.message });
        res.status(500).json({ success: false, error: 'No se pudo obtener el listado', code: 'LICENSE_EXEMPTIONS_LIST_FAILED' });
    }
});

router.post(
    '/api/admin/license-exemptions/:type/:id',
    authenticateAdmin,
    authorizeAdmin,
    validateBody(schemas.licenseExemption),
    async (req, res) => {
        const resourceType = String(req.params.type || '');
        const resourceId = Number(req.params.id);

        if (!VALID_TYPES.has(resourceType) || !Number.isInteger(resourceId) || resourceId <= 0) {
            return res.status(400).json({ success: false, error: 'Recurso no válido', code: 'INVALID_RESOURCE' });
        }

        try {
            const result = await exemptionService.setLicenseExemption(resourceType, resourceId, req.body.exempt === true);
            if (!result) {
                return res.status(404).json({ success: false, error: 'Contenido no encontrado', code: 'RESOURCE_NOT_FOUND' });
            }

            invalidateOwnerCacheForPin(result.pin);
            logger.info('License exemption updated', {
                resourceType,
                resourceId,
                exempt: result.licenseExempt,
                actor: req.user?.username || null
            });

            res.json({ success: true, type: resourceType, id: result.id, licenseExempt: result.licenseExempt });
        } catch (error) {
            logger.error('Error updating license exemption', { resourceType, resourceId, error: error.message });
            res.status(500).json({ success: false, error: 'No se pudo actualizar', code: 'LICENSE_EXEMPTION_UPDATE_FAILED' });
        }
    }
);

module.exports = router;
