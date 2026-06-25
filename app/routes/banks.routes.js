/**
 * @fileoverview Rutas para gestión de bancos de preguntas
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { validateUniquePIN } = require('../middlewares/validators');
const { checkUsageBeforeDelete } = require('./helpers/DeleteHelpers');
const { schemas, validateBody } = require('../validation');
const dbService = require('../services/db.service');
const bankMergeService = require('../services/db/bank-merge.service');
const { handleRouteError, handleNotFound, handleBusinessError } = require('./helpers/RouteErrorHandler');
const { pinValidationLimiter } = require('../middlewares/security');

const router = express.Router();

router.get('/api/banks/validate-pin', pinValidationLimiter, async (req, res) => {
    const { pin, excludeId } = req.query;
    try {
        const exists = await dbService.bankPinExists(pin, excludeId);
        res.json({ exists });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get('/api/banks', authenticateAdmin, async (req, res) => {
    try {
        const includeCount = req.query.includeCount === 'true';
        const banks = includeCount
            ? await dbService.getAllBanksWithQuestionCounts()
            : await dbService.getAllBanks();
        res.json(banks);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post('/api/banks', authenticateAdmin, validateBody(schemas.createBank), async (req, res) => {
    const { name } = req.body;
    try {
        const bank = await dbService.createBank(
            name,
            req.user?.role,
            req.user?.userId
        );
        res.status(201).json(bank);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get('/api/banks/:id', authenticateAdmin, async (req, res) => {
    try {
        const result = await dbService.getBankWithQuestions(req.params.id);
        if (!result) return handleNotFound(res);
        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.delete('/api/banks/:id', authenticateAdmin, checkUsageBeforeDelete('bank'), async (req, res) => {
    try {
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        const result = await dbService.deleteBank(req.params.id, actorUserId);
        if (!result.success) {
            return handleBusinessError(res, result.error);
        }
        res.json({ message: 'Banco eliminado', code: 'BANK_DELETED' });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post('/api/banks/save-all', authenticateAdmin, validateBody(schemas.saveBank), validateUniquePIN('bank'), async (req, res) => {
    try {
        const payload = req.body.id
            ? req.body
            : {
                ...req.body,
                created_by_role: req.user?.role,
                created_by_user_id: req.user?.userId
            };
        const actorUserId = req.user?.role === 'editor' ? req.user?.userId : null;
        const result = await dbService.saveBankComplete(payload, actorUserId);
        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post('/api/banks/merge', authenticateAdmin, validateBody(schemas.mergeBanks), validateUniquePIN('bank'), async (req, res) => {
    try {
        const { bankIds, name, pin, ...options } = req.body;
        const mergeOptions = {
            ...options,
            created_by_role: req.user?.role,
            created_by_user_id: req.user?.userId
        };
        const result = await bankMergeService.mergeBanks(bankIds, name, pin, mergeOptions);
        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get('/api/banks/info', authenticateAdmin, async (req, res) => {
    try {
        const bankIds = req.query.ids ? req.query.ids.split(',').map(id => parseInt(id, 10)) : [];
        const result = await bankMergeService.getBanksInfo(bankIds);
        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
