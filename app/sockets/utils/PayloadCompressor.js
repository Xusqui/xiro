/**
 * @fileoverview Payload Compressor - Compresión gzip de payloads grandes
 * @module sockets/utils/PayloadCompressor
 * 
 * Responsabilidades:
 * - Comprimir payloads >2KB con gzip
 * - Auto-detect: solo comprimir si reducción >20%
 * - Marcar payloads comprimidos para decompresión en cliente
 */

const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class PayloadCompressor {
    /**
     * Comprimir payload si cumple criterios
     * 
     * @param {Object} payload - Payload a comprimir
     * @returns {Promise<Object>} Payload original o comprimido
     */
    static async compress(payload) {
        try {
            const jsonStr = JSON.stringify(payload);
            const originalSize = Buffer.byteLength(jsonStr, 'utf8');

            // No comprimir si es pequeño
            if (originalSize < this.MIN_SIZE) {
                return {
                    compressed: false,
                    data: payload,
                    originalSize,
                    compressedSize: originalSize,
                    reduction: 0
                };
            }

            // No comprimir si supera el tope — emitir directamente para no bloquear el event loop
            if (originalSize > this.MAX_UNCOMPRESSED_BYTES) {
                const logger = require('../../config/logger');
                logger.warn('PayloadCompressor: payload exceeds MAX_UNCOMPRESSED_BYTES, skipping gzip', {
                    originalSize,
                    maxBytes: this.MAX_UNCOMPRESSED_BYTES
                });
                return {
                    compressed: false,
                    data: payload,
                    originalSize,
                    compressedSize: originalSize,
                    reduction: 0,
                    reason: 'payload-too-large'
                };
            }

            // Comprimir con gzip, con timeout de seguridad
            const gzipPromise = gzip(jsonStr, { level: this.COMPRESSION_LEVEL });
            const timeoutPromise = new Promise((resolve) =>
                setTimeout(() => resolve(null), this.GZIP_TIMEOUT_MS)
            );

            const compressed = await Promise.race([gzipPromise, timeoutPromise]);

            if (!compressed) {
                // Timeout expiró — emitir sin comprimir
                const logger = require('../../config/logger');
                logger.warn('PayloadCompressor: gzip timed out, sending uncompressed', {
                    originalSize,
                    timeoutMs: this.GZIP_TIMEOUT_MS
                });
                return {
                    compressed: false,
                    data: payload,
                    originalSize,
                    compressedSize: originalSize,
                    reduction: 0,
                    reason: 'gzip-timeout'
                };
            }

            const compressedSize = compressed.length;
            const reduction = (originalSize - compressedSize) / originalSize;

            // Solo usar compresión si reducción >20%
            if (reduction < this.MIN_REDUCTION) {
                return {
                    compressed: false,
                    data: payload,
                    originalSize,
                    compressedSize: originalSize,
                    reduction: 0,
                    reason: `Reducción insuficiente (${(reduction * 100).toFixed(1)}% < 20%)`
                };
            }

            return {
                compressed: true,
                data: compressed, // Emit the gzip Buffer directly
                originalSize,
                compressedSize,
                reduction: parseFloat((reduction * 100).toFixed(1))
            };
        } catch (error) {
            // Si falla compresión, devolver original
            return {
                compressed: false,
                data: payload,
                error: error.message
            };
        }
    }

    /**
     * Descomprimir payload (para testing o server-side)
     * 
     * @param {Buffer|string} compressedInput - Payload comprimido (Buffer o base64)
     * @returns {Promise<Object>} Payload descomprimido
     */
    static async decompress(compressedInput) {
        try {
            const compressedBuffer = Buffer.isBuffer(compressedInput)
                ? compressedInput
                : Buffer.from(compressedInput, 'base64');
            const decompressed = await gunzip(compressedBuffer);
            const jsonStr = decompressed.toString('utf8');
            return JSON.parse(jsonStr);
        } catch (error) {
            throw new Error(`Decompression failed: ${error.message}`);
        }
    }

    /**
     * Comprimir payload y preparar para Socket.IO
     * 
     * @param {Object} payload - Payload original
     * @returns {Promise<Object>} {compressed: boolean, payload: Object|String}
     */
    static async prepareForEmit(payload) {
        const result = await this.compress(payload);

        if (result.compressed) {
            return {
                _compressed: true,
                _originalSize: result.originalSize,
                _compressedSize: result.compressedSize,
                data: result.data,
                reduction: result.reduction
            };
        }

        return payload;
    }

    /**
     * Estimar tamaño de payload sin comprimir
     * 
     * @param {Object} payload - Payload
     * @returns {number} Tamaño en bytes
     */
    static estimateSize(payload) {
        const jsonStr = JSON.stringify(payload);
        return Buffer.byteLength(jsonStr, 'utf8');
    }

    /**
     * Calcular estadísticas de compresión
     * 
     * @param {Object} payload - Payload original
     * @returns {Promise<Object>} Estadísticas
     */
    static async getCompressionStats(payload) {
        const result = await this.compress(payload);

        return {
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            reduction: result.reduction,
            worthCompressing: result.compressed,
            originalKB: (result.originalSize / 1024).toFixed(2),
            compressedKB: (result.compressedSize / 1024).toFixed(2),
            savedKB: ((result.originalSize - result.compressedSize) / 1024).toFixed(2)
        };
    }

    /**
     * Comprimir múltiples payloads en batch
     * 
     * @param {Array<Object>} payloads - Array de payloads
     * @returns {Promise<Array<Object>>} Payloads procesados
     */
    static compressBatch(payloads) {
        const promises = payloads.map(payload => this.prepareForEmit(payload));
        return Promise.all(promises);
    }

    /**
     * Verificar si un payload está comprimido
     * 
     * @param {Object} payload - Payload a verificar
     * @returns {boolean} true si está comprimido
     */
    static isCompressed(payload) {
        return payload && payload._compressed === true;
    }

    /**
     * Obtener tamaño de payload (comprimido o sin comprimir)
     * 
     * @param {Object} payload - Payload
     * @returns {number} Tamaño en bytes
     */
    static getSize(payload) {
        if (this.isCompressed(payload)) {
            return payload._compressedSize;
        }
        return this.estimateSize(payload);
    }
}

// Static config values (compatible with parser ecmaVersion 2021).
PayloadCompressor.MIN_SIZE = 2048;
PayloadCompressor.MAX_UNCOMPRESSED_BYTES = 256 * 1024; // 256 KB
PayloadCompressor.GZIP_TIMEOUT_MS = 500;
PayloadCompressor.MIN_REDUCTION = 0.20;
PayloadCompressor.COMPRESSION_LEVEL = 6;

module.exports = PayloadCompressor;
