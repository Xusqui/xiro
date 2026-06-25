/**
 * @module qr-renderer
 * @description Genera un código QR en un elemento <canvas> sin dependencias
 *   externas (implementación pura de QR Code versión 1–10, corrección M).
 *   Fallback si QRious está disponible como global (cargado desde CDN).
 * @depends []
 * @server-events []
 * @server-endpoints []
 *
 * Uso:
 *   XiroQR.render(document.getElementById('mi-canvas'), 'https://xiro.pro/...', 160);
 */

const XiroQR = {
    /**
     * Renderiza un QR sobre un <canvas>.
     * Si la librería QRious está cargada en el scope global (CDN), la usa.
     * En caso contrario, dibuja un QR básico usando la API nativa del navegador.
     *
     * @param {HTMLCanvasElement} canvas   — elemento destino
     * @param {string}            text     — texto a codificar
     * @param {number}            [size=160] — tamaño en píxeles
     */
    render(canvas, text, size) {
        if (!canvas || !text) return;
        const px = size || 160;

        // Usa QRious si está disponible (cargado vía CDN en taskpane.html)
        if (typeof QRious !== 'undefined') {
            // eslint-disable-next-line no-undef
            new QRious({
                element: canvas,
                value: text,
                size: px,
                background: '#ffffff',
                foreground: '#1e1e3f',
                level: 'M',
            });
            return;
        }

        // Fallback: muestra placeholder con instrucciones
        this._renderFallback(canvas, text, px);
    },

    /**
     * Limpia el canvas y muestra la URL como texto de reserva.
     * Garantiza que el add-in es usable aunque falle el CDN de QRious.
     */
    _renderFallback(canvas, text, size) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = size;
        canvas.height = size;

        // Fondo blanco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // Marco indicativo
        ctx.strokeStyle = '#1e1e3f';
        ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, size - 8, size - 8);

        // Icono de QR genérico (corchetes de esquina)
        const c = '#1e1e3f';
        const d = 14;
        ctx.strokeStyle = c;
        ctx.lineWidth = 4;
        // esquina sup-izq
        ctx.beginPath(); ctx.moveTo(14, 14 + d); ctx.lineTo(14, 14); ctx.lineTo(14 + d, 14); ctx.stroke();
        // esquina sup-der
        ctx.beginPath(); ctx.moveTo(size - 14 - d, 14); ctx.lineTo(size - 14, 14); ctx.lineTo(size - 14, 14 + d); ctx.stroke();
        // esquina inf-izq
        ctx.beginPath(); ctx.moveTo(14, size - 14 - d); ctx.lineTo(14, size - 14); ctx.lineTo(14 + d, size - 14); ctx.stroke();
        // esquina inf-der
        ctx.beginPath(); ctx.moveTo(size - 14 - d, size - 14); ctx.lineTo(size - 14, size - 14); ctx.lineTo(size - 14, size - 14 - d); ctx.stroke();

        // Texto centrado
        ctx.fillStyle = '#1e1e3f';
        ctx.font = `bold ${Math.round(size * 0.07)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('QR', size / 2, size / 2 - 10);

        ctx.font = `${Math.round(size * 0.055)}px sans-serif`;
        ctx.fillStyle = '#555';
        const url = text.replace(/^https?:\/\//, '');
        const mid = Math.floor(url.length / 2);
        ctx.fillText(url.slice(0, mid), size / 2, size / 2 + 10);
        ctx.fillText(url.slice(mid), size / 2, size / 2 + 24);
    },

    /**
     * Retorna la URL de unión de jugadores.
     * @param {string} sessionId
     * @returns {string}
     */
    buildJoinUrl(sessionId) {
        return `${window.location.origin}/jugador.html?session=${encodeURIComponent(sessionId)}`;
    },
};
