/**
 * @fileoverview Middleware de modo mantenimiento
 *
 * Se activa cuando:
 *   - La variable de entorno MAINTENANCE_MODE=true está definida, O
 *   - Existe el archivo lock indicado por MAINTENANCE_LOCK_FILE
 *     (por defecto: <raíz del proyecto>/.maintenance.lock)
 *
 * Rutas exentas (siempre pasan):
 *   - /api/health  — endpoint de health-check
 *   - /api/admin*  — panel de administración (para poder desactivar mantenimiento)
 *   - /admin*      — vistas de administración
 *   - /css/*       — hojas de estilo (necesarias para renderizar maintenance.html)
 *   - /images/*    — imágenes (necesarias para renderizar maintenance.html)
 *   - /js/*        — scripts de soporte de las páginas de error
 *   - /favicon.svg
 */

const fs = require('fs');
const path = require('path');

const LOCK_FILE_PATH = process.env.MAINTENANCE_LOCK_FILE
    || path.resolve(__dirname, '../../.maintenance.lock');
const MAINTENANCE_HTML = path.resolve(__dirname, '../public/error/maintenance.html');

// Caché para evitar acceso a disco en cada petición
const _cache = { active: false, checkedAt: 0 };
const CACHE_TTL_MS = 5_000; // revisar cada 5 segundos

/**
 * Comprueba si el modo mantenimiento está activo.
 * El resultado se memoriza durante CACHE_TTL_MS milisegundos.
 * @returns {boolean}
 */
function isMaintenanceActive() {
    const now = Date.now();
    if (now - _cache.checkedAt < CACHE_TTL_MS) {
        return _cache.active;
    }

    _cache.checkedAt = now;

    if (process.env.MAINTENANCE_MODE === 'true') {
        _cache.active = true;
        return true;
    }

    try {
        _cache.active = fs.existsSync(LOCK_FILE_PATH);
    } catch {
        _cache.active = false;
    }

    return _cache.active;
}

/**
 * Lista de prefijos de ruta que deben seguir funcionando durante el mantenimiento.
 */
const EXEMPT_PREFIXES = [
    '/api/health',
    '/api/admin',
    '/admin',
    '/css/',
    '/images/',
    '/js/',
    '/favicon',
];

/**
 * Middleware de modo mantenimiento.
 * Devuelve maintenance.html (503) a clientes navegador o JSON a clientes API.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function maintenanceMiddleware(req, res, next) {
    if (!isMaintenanceActive()) return next();

    // Rutas exentas
    const isExempt = EXEMPT_PREFIXES.some(prefix => req.path.startsWith(prefix));
    if (isExempt) return next();

    // Clientes API reciben JSON
    if (req.path.startsWith('/api/')) {
        return res.status(503).json({
            error: 'Servicio en mantenimiento',
            message: 'El sistema está temporalmente fuera de servicio. Inténtalo de nuevo en unos minutos.',
            code: 'MAINTENANCE_MODE'
        });
    }

    // Navegador recibe la página de mantenimiento
    res.status(503).sendFile(MAINTENANCE_HTML);
}

module.exports = maintenanceMiddleware;
