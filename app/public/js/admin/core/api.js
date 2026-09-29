/**
 * @fileoverview Capa de API con autenticación
 * Función fetchWithAuth extraída 1:1 del original admin.js
 */

// Helper para hacer peticiones autenticadas.
// La autenticación viaja en la cookie HttpOnly adminToken (enviada automáticamente).
async function fetchWithAuth(url, options = {}) {
    const authOptions = {
        ...options,
        credentials: 'include',
        headers: {
            ...options.headers
        }
    };

    const response = await fetch(url, authOptions);

    // Si recibimos 401, la sesión expiró
    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Unauthorized');
    }

    return response;
}
