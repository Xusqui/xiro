const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const logger = require('../config/logger');

/**
 * Genera un código QR como imagen PNG
 * GET /api/qr?url=https://example.com
 */
router.get('/', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required', code: 'QR_URL_REQUIRED' });
        }

        // Generar QR como buffer PNG
        const qrBuffer = await QRCode.toBuffer(url, {
            type: 'png',
            width: 500,
            margin: 2,
            errorCorrectionLevel: 'M'
        });

        // Enviar imagen
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=1'); // Cache 1 segundo (pruebas)
        res.send(qrBuffer);
    } catch (error) {
        logger.error('Error generando QR:', error);
        res.status(500).json({ error: 'Error generating QR code', code: 'QR_GENERATION_FAILED' });
    }
});

module.exports = router;
