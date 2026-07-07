'use strict';

/**
 * Compra integrada de licencia individual.
 * GET  /api/user/license/plans          — planes activos del servicio de licencias
 * POST /api/user/license/checkout       — crea el pedido PayPal y devuelve approveUrl
 * GET  /api/user/license/paypal/return  — retorno de PayPal: captura y guarda la clave
 * GET  /api/user/license/paypal/cancel  — pago cancelado por el usuario
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { accountMutationLimiter } = require('../middlewares/security');
const { schemas, validateBody } = require('../validation');
const logger = require('../config/logger');
const checkoutService = require('../services/license-checkout.service');
const userLicenseDb = require('../services/db/user-license.service');
const { invalidateUserLicenseStatus } = require('../services/user-license-state.service');
const adminUserService = require('../services/db/admin-user.service');

const router = express.Router();

const RESULT_PAGE = '/admin.html';

function publicBaseUrl(req) {
    // Si llega una lista separada por comas (estilo CORS_ORIGIN), usar la primera
    const configured = String(process.env.PUBLIC_BASE_URL || '')
        .split(',')[0]
        .trim()
        .replace(/\/+$/, '');
    if (configured) return configured;
    return `${req.protocol}://${req.get('host')}`;
}

function redirectWithResult(res, result) {
    res.redirect(`${RESULT_PAGE}?licensePurchase=${encodeURIComponent(result)}`);
}

function normalizePaypalOrderId(value) {
    const token = String(value || '').trim();
    return /^[A-Za-z0-9\-_]{5,120}$/.test(token) ? token : '';
}

router.get('/api/user/license/plans', authenticateAdmin, async (_req, res) => {
    try {
        const plans = await checkoutService.listPlans();
        res.json({ success: true, plans });
    } catch (error) {
        logger.error('Error listing license plans', { error: error.message });
        res.status(502).json({ success: false, error: 'No se pudieron obtener los planes', code: 'LICENSE_PLANS_FAILED' });
    }
});

router.post(
    '/api/user/license/checkout',
    authenticateAdmin,
    accountMutationLimiter,
    validateBody(schemas.userLicenseCheckout),
    async (req, res) => {
        try {
            const userId = req.user?.userId;
            const user = await adminUserService.getActiveUserById(userId);
            if (!user || !user.email) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado', code: 'USER_NOT_FOUND' });
            }

            const baseUrl = publicBaseUrl(req);
            const order = await checkoutService.createCheckoutOrder({
                planCode: req.body.planCode,
                customerEmail: user.email,
                returnUrl: `${baseUrl}/api/user/license/paypal/return`,
                cancelUrl: `${baseUrl}/api/user/license/paypal/cancel`
            });

            if (!order?.paypalOrderId || !order?.approveUrl) {
                throw new Error('Pedido incompleto del servicio de licencias');
            }

            await checkoutService.savePendingCheckout(order.paypalOrderId, userId);

            logger.info('License checkout order created', { userId, paypalOrderId: order.paypalOrderId });
            res.json({ success: true, approveUrl: order.approveUrl, paypalOrderId: order.paypalOrderId });
        } catch (error) {
            logger.error('Error creating license checkout', { error: error.message });
            const status = error.status === 400 ? 400 : 502;
            res.status(status).json({ success: false, error: 'No se pudo iniciar la compra', code: 'LICENSE_CHECKOUT_FAILED' });
        }
    }
);

router.get('/api/user/license/paypal/return', async (req, res) => {
    const paypalOrderId = normalizePaypalOrderId(req.query.token);
    if (!paypalOrderId) {
        return redirectWithResult(res, 'error');
    }

    try {
        const pending = await checkoutService.getPendingCheckout(paypalOrderId);
        if (!pending) {
            logger.warn('License checkout return without pending order', { paypalOrderId });
            return redirectWithResult(res, 'expired');
        }

        const result = await checkoutService.captureCheckoutOrder(paypalOrderId);
        const licenseKey = result?.license?.license_key || result?.license?.licenseKey || null;

        if (!licenseKey) {
            logger.warn('License checkout captured without license yet', {
                paypalOrderId,
                status: result?.status || null
            });
            return redirectWithResult(res, 'pending');
        }

        const saved = await userLicenseDb.setUserLicense(pending.userId, licenseKey);
        if (saved === null) {
            return redirectWithResult(res, 'error');
        }

        invalidateUserLicenseStatus(pending.userId);
        logger.info('License purchase completed and saved', { userId: pending.userId, paypalOrderId });
        return redirectWithResult(res, 'success');
    } catch (error) {
        logger.error('Error completing license purchase', { paypalOrderId, error: error.message });
        return redirectWithResult(res, 'error');
    }
});

router.get('/api/user/license/paypal/cancel', (_req, res) => {
    redirectWithResult(res, 'cancelled');
});

module.exports = router;
