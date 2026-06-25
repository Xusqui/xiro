/**
 * @module api
 * @description Wrapper de fetch para los endpoints REST de Xiro.
 *   El add-in se sirve desde el mismo origen (xiro.pro), por lo que no
 *   se necesita CORS. Para endpoints de presentador se adjunta JWT del panel
 *   en Authorization cuando existe en localStorage.
 * @depends []
 * @server-events []
 * @server-endpoints
 *   GET /api/presenter-pins   → [{pin, name, type, question_count}]
 *   GET /api/quizzes/validate/:pin → {exists, gameType, gameId}
 */

const BASE = window.location.origin;

function getPanelToken() {
    try {
        return window.localStorage.getItem('adminToken') || '';
    } catch (_) {
        return '';
    }
}

/**
 * Realiza una petición GET y devuelve el JSON parseado.
 * Lanza Error si el servidor responde con status >= 400.
 * @param {string} path  — ruta relativa, ej: '/api/presenter-pins'
 * @returns {Promise<*>}
 */
async function apiGet(path) {
    const token = getPanelToken();
    const res = await fetch(`${BASE}${path}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'omit',
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return res.json();
}

/**
 * Realiza una petición POST con body JSON y devuelve el JSON parseado.
 * @param {string} path
 * @param {object} body
 * @returns {Promise<*>}
 */
async function apiPost(path, body) {
    const token = getPanelToken();
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'omit',
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return res.json();
}

const XiroApi = {
    /**
     * Lista de juegos disponibles para el presentador.
     * @returns {Promise<Array<{pin:string, name:string, type:string, question_count:number}>>}
     */
    getPresenterPins() {
        return apiGet('/api/presenter-pins');
    },

    /**
     * Valida si un PIN existe y obtiene su tipo/id.
     * @param {string} pin
     * @returns {Promise<{exists:boolean, gameType:string, gameId:number}>}
     */
    validatePin(pin) {
        return apiGet(`/api/quizzes/validate/${encodeURIComponent(pin)}`);
    },

    /**
     * Solicita al backend que genere un sessionId único para el PIN dado.
     * El backend valida que el PIN exista antes de generar el ID.
     * Formato devuelto: "PIN-DDDD" (4 dígitos).
     * @param {string} pin
     * @returns {Promise<{sessionId:string}>}
     */
    createSession(pin) {
        return apiPost('/api/addin/create-session', { pin });
    },
};
