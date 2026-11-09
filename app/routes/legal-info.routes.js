'use strict';

/**
 * @fileoverview Datos públicos del titular de esta instalación, para las páginas legales.
 * Se editan en Configuración → Servidor → Datos legales.
 * GET /api/legal-info
 */

const express = require('express');
const runtimeConfig = require('../config/runtime-config');

const router = express.Router();

const FIELDS = {
    ownerName: 'LEGAL_OWNER_NAME',
    location: 'LEGAL_LOCATION',
    email: 'LEGAL_EMAIL',
    taxId: 'LEGAL_TAX_ID',
    address: 'LEGAL_ADDRESS',
    phone: 'LEGAL_PHONE'
};

/** @returns {Object<string, string>} Cada campo, vacío si no está configurado */
function readLegalInfo() {
    return Object.fromEntries(
        Object.entries(FIELDS).map(([field, key]) => [field, String(runtimeConfig.get(key) || '').trim()])
    );
}

router.get('/api/legal-info', (_req, res) => {
    res.json(readLegalInfo());
});

module.exports = router;
