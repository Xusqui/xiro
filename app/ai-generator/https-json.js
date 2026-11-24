'use strict';

/**
 * @fileoverview POST con cuerpo JSON por HTTPS para los clientes de IA con API compatible
 * con OpenAI (Groq y OpenAI). Resuelve también con estados de error: cada cliente
 * traduce los suyos. Los mensajes de red, timeout y JSON inválido llevan el nombre
 * del proveedor y son los que ve el admin.
 * Exporta: postJson
 */

const https = require('https');

/**
 * Envía `payload` como JSON y devuelve la respuesta parseada.
 * @param {Object} params
 * @param {string} params.hostname
 * @param {string} params.path
 * @param {string} params.apiKey - se envía como Authorization: Bearer
 * @param {Object} params.payload
 * @param {number} params.timeout ms
 * @param {string} params.label - nombre del proveedor para los mensajes (p. ej. 'Groq')
 * @returns {Promise<{ statusCode: number, headers: Object, body: Object }>}
 * @throws {Error} timeout, error de red o cuerpo que no es JSON
 */
function postJson({ hostname, path, apiKey, payload, timeout, label }) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const headers = {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        };

        const req = https.request({ hostname, path, method: 'POST', headers }, res => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, headers: res.headers || {}, body: JSON.parse(data) });
                } catch (e) {
                    reject(new Error(`Error parseando respuesta de ${label}: ${e.message}`));
                }
            });
        });

        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error(`Timeout: ${label} no respondió en ${timeout / 1000}s`));
        });

        req.on('error', err => reject(new Error(`Error de red: ${err.message}`)));
        req.write(body);
        req.end();
    });
}

module.exports = { postJson };
