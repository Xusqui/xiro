/**
 * @module session
 * @description Genera sessionIds y provee utilidades de sesión.
 *   En la nueva arquitectura, la sesión la gestiona session-keeper.js.
 *   Este módulo solo provee la generación del ID.
 * @depends []
 */

const XiroSession = (() => {

    /**
     * Genera un sessionId único con formato PIN-DDDD (4 dígitos decimales).
     * Fallback offline — en producción usar XiroApi.createSession(pin) para
     * que el backend valide el PIN y genere el ID de forma autoritativa.
     * @param {string} pin
     * @returns {string}
     */
    function generateId(pin) {
        const suffix = String(Math.floor(Math.random() * 9000) + 1000); // 1000–9999
        return `${pin}-${suffix}`;
    }

    return { generateId };
})();
