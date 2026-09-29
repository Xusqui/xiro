/**
 * @fileoverview Decoder transparente de eventos socket comprimidos (gzip).
 *
 * Envuelve `socket.on` para descomprimir payloads marcados con `_compressed`
 * antes de entregarlos al callback. Extraído a su propio módulo dual
 * (browser via globalThis + CommonJS via module.exports) para poder testearlo.
 *
 * CRÍTICO: el wrapper DEBE invocar el callback preservando `this` (el emitter).
 * `socket.once()` (component-emitter) registra un wrapper interno que hace
 * `this.off(event, on)`; si perdemos `this`, lanza
 * "Cannot read properties of undefined (reading 'off')" y el callback nunca se
 * ejecuta (p.ej. la respuesta `session-validation-result` se pierde y la
 * validación de sesión cae en timeout).
 */

(function attachPlayerSocketDecompress(root) {
    async function decompressGzip(arrayBuffer) {
        if (typeof DecompressionStream === 'undefined') {
            try {
                if (typeof process !== 'undefined' && process.release && process.release.name === 'node') {
                    const zlib = eval('require(\'zlib\')');
                    const decompressed = zlib.gunzipSync(new Uint8Array(arrayBuffer));
                    return JSON.parse(decompressed.toString('utf8'));
                }
            } catch (e) {
                console.error('Node fallback decompression failed:', e);
            }
            throw new Error('DecompressionStream not supported');
        }
        const ds = new DecompressionStream('gzip');
        const decompressedStream = new Response(arrayBuffer).body.pipeThrough(ds);
        const text = await new Response(decompressedStream).text();
        return JSON.parse(text);
    }

    /**
     * Instala el decoder sobre un socket reemplazando su método `on`.
     * @param {object} socket - socket.io client (o emitter compatible).
     * @returns {object} el mismo socket.
     */
    function applyDecompressionDecoder(socket) {
        const originalOn = socket.on;

        socket.on = function (event, callback) {
            function decoderListener(payload, ...args) {
                // Preservar `this` (el emitter lo pasa vía apply). Ver nota
                // CRÍTICA en la cabecera: socket.once() depende de ello.
                const self = this;
                if (payload && payload._compressed === true) {
                    const isBase64 = typeof payload.data === 'string';
                    let promise;
                    if (isBase64) {
                        const binaryString = atob(payload.data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        promise = decompressGzip(bytes.buffer);
                    } else {
                        promise = decompressGzip(payload.data);
                    }
                    promise.then(decompressedData => {
                        callback.call(self, decompressedData, ...args);
                    }).catch(err => {
                        console.error('Failed to decompress socket payload:', err);
                        callback.call(self, payload, ...args);
                    });
                } else {
                    callback.call(self, payload, ...args);
                }
            }
            // Preservar el bookkeeping de component-emitter: `off`/`once`
            // identifican el listener por `cb === fn || cb.fn === fn`. Sin esto,
            // socket.off(event, listener) y la autoeliminación de socket.once()
            // no encuentran el wrapper y el listener nunca se desregistra.
            decoderListener.fn = callback;
            originalOn.call(socket, event, decoderListener);
            return socket;
        };

        return socket;
    }

    const api = { applyDecompressionDecoder, decompressGzip };

    if (root) {
        root.PlayerSocketDecompress = api;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));
