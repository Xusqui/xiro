/**
 * @fileoverview Bloquea el acceso directo a /tv.html cuando tvCardMode está en "never".
 * Los modos "always" y "old_devices_only" solo afectan a la visibilidad de la
 * tarjeta en el menú principal, no al acceso directo por URL.
 */

const path = require('path');
const uiSettings = require('../config/ui-settings');

const FORBIDDEN_HTML = path.resolve(__dirname, '../public/error/403.html');

function isTvAccessDisabled() {
    try {
        return uiSettings.get('tvCardMode') === 'never';
    } catch {
        // En caso de error al leer configuración, bloqueamos por seguridad.
        return true;
    }
}

function isTvPath(requestPath) {
    return requestPath === '/tv.html' || requestPath === '/tv.html/';
}

function tvAccessGuard(req, res, next) {
    if (!isTvPath(req.path)) return next();
    if (!isTvAccessDisabled()) return next();

    if (req.method === 'HEAD') {
        return res.status(403).end();
    }

    return res.status(403).sendFile(FORBIDDEN_HTML);
}

module.exports = tvAccessGuard;
