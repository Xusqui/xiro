/**
 * @fileoverview Ruta del formulario de contacto
 *
 * GET  /api/contact/token  → emite un token firmado con desafío matemático
 * POST /api/contact        → valida y envía el email a info@xiro.pro
 *
 * Protección antibot:
 *  1. Honeypot (campo oculto que los bots rellenan)
 *  2. Token HMAC con marca de tiempo (4 s – 2 h de validez)
 *  3. Desafío matemático generado en el servidor
 *  4. Rate limit: 5 envíos / hora / IP
 *
 * Variables de entorno necesarias:
 *  SMTP_HOST, SMTP_PORT, SMTP_SECURE (true/false), SMTP_USER, SMTP_PASS, SMTP_FROM
 *  CONTACT_TOKEN_SECRET  (opcional, clave para firmar los tokens)
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const runtimeConfig = require('../config/runtime-config');

const router = express.Router();

const DEST_EMAIL = 'info@xiro.pro';

function getTokenSecret() {
    return runtimeConfig.get('CONTACT_TOKEN_SECRET') || 'xiro-contact-default-secret-2026';
}

// ── Rate limiter ─────────────────────────────────────────────────────────────
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5,
    message: { error: 'Demasiados mensajes enviados. Inténtalo de nuevo en una hora.', code: 'CONTACT_RATE_LIMITED' },
    standardHeaders: true,
    legacyHeaders: false
});

// ── Generación de token ──────────────────────────────────────────────────────
function generateToken() {
    const ts = Date.now();
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * 3)];
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;
    const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
    const payload = `${ts}.${answer}`;
    const hmac = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('hex');
    return {
        token: `${payload}.${hmac}`,
        question: `\u00bfCu\u00e1nto es ${a} ${op} ${b}?`
    };
}

// ── Validación de token ──────────────────────────────────────────────────────
function validateToken(token) {
    if (!token || typeof token !== 'string') return null;

    // Formato esperado: "<ts>.<answer>.<hmac64hex>"
    const lastDot = token.lastIndexOf('.');
    if (lastDot < 0) return null;
    const payload = token.slice(0, lastDot);
    const hmac = token.slice(lastDot + 1);

    if (!/^[0-9a-f]{64}$/.test(hmac)) return null;

    const expected = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('hex');
    try {
        if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) return null;
    } catch {
        return null;
    }

    const firstDot = payload.indexOf('.');
    if (firstDot < 0) return null;
    const ts = parseInt(payload.slice(0, firstDot), 10);
    const answer = parseInt(payload.slice(firstDot + 1), 10);
    if (isNaN(ts) || isNaN(answer)) return null;

    const age = Date.now() - ts;
    // Demasiado rápido (< 4 s) o expirado (> 2 h)
    if (age < 4000 || age > 7200000) return null;

    return { answer };
}

// ── Escape HTML para el cuerpo del email ──────────────────────────────────────
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── GET /api/contact/token ───────────────────────────────────────────────────
router.get('/api/contact/token', (req, res) => {
    res.json(generateToken());
});

// ── POST /api/contact ────────────────────────────────────────────────────────
router.post('/api/contact', contactLimiter, async (req, res) => {
    const { name, email, message, token, captcha, website } = req.body || {};

    // 1. Honeypot
    if (website && String(website).trim() !== '') {
        return res.status(400).json({ error: 'Solicitud inv\u00e1lida.', code: 'CONTACT_INVALID_REQUEST' });
    }

    // 2. Token HMAC + timing
    const tokenData = validateToken(token);
    if (!tokenData) {
        return res.status(400).json({ error: 'El formulario ha expirado o es inv\u00e1lido. Recarga la p\u00e1gina.', code: 'CONTACT_FORM_EXPIRED' });
    }

    // 3. Desafío matemático
    if (parseInt(captcha, 10) !== tokenData.answer) {
        return res.status(400).json({ error: 'Respuesta incorrecta al desaf\u00edo matem\u00e1tico.', code: 'CONTACT_CHALLENGE_INCORRECT' });
    }

    // 4. Campos requeridos
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.', code: 'CONTACT_FIELDS_REQUIRED' });
    }
    const nameStr = String(name).trim();
    const emailStr = String(email).trim();
    const messageStr = String(message).trim();

    if (nameStr.length > 100 || emailStr.length > 200 || messageStr.length > 5000) {
        return res.status(400).json({ error: 'Los datos superan la longitud m\u00e1xima permitida.', code: 'CONTACT_DATA_TOO_LONG' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
        return res.status(400).json({ error: 'Email no v\u00e1lido.', code: 'CONTACT_EMAIL_INVALID' });
    }

    // 5. Envío de email
    try {
        const transporter = nodemailer.createTransport({
            host: runtimeConfig.get('SMTP_HOST'),
            port: runtimeConfig.get('SMTP_PORT'),
            secure: runtimeConfig.get('SMTP_SECURE') === 'true',
            auth: {
                user: runtimeConfig.get('SMTP_USER'),
                pass: runtimeConfig.get('SMTP_PASS')
            }
        });

        const info = await transporter.sendMail({
            from: runtimeConfig.get('SMTP_FROM') || `"XIRO! Contacto" <${runtimeConfig.get('SMTP_USER')}>`,
            to: DEST_EMAIL,
            replyTo: emailStr,
            subject: `Contacto XIRO! de ${nameStr}`,
            text: `Nombre: ${nameStr}\nEmail: ${emailStr}\n\n${messageStr}`,
            html:
                `<p><strong>Nombre:</strong> ${escapeHtml(nameStr)}</p>` +
                `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(emailStr)}">${escapeHtml(emailStr)}</a></p>` +
                `<hr><p>${escapeHtml(messageStr).replace(/\n/g, '<br>')}</p>`
        });

        // Traza del envío para cruzarla con el registro del proveedor SMTP si el
        // correo no llega: identificador y lo que respondió el servidor. Sin datos
        // del remitente ni el mensaje (solo el destino propio, DEST_EMAIL).
        const logger = require('../config/logger');
        logger.info('Email de contacto enviado', {
            messageId: info?.messageId,
            accepted: info?.accepted,
            rejected: info?.rejected,
            response: info?.response
        });

        res.json({ ok: true });
    } catch (err) {
        const logger = require('../config/logger');
        logger.error('Error al enviar email de contacto', { error: err.message });
        res.status(500).json({ error: 'Error al enviar el mensaje. Int\u00e9ntalo m\u00e1s tarde.', code: 'CONTACT_SEND_FAILED' });
    }
});

module.exports = router;
