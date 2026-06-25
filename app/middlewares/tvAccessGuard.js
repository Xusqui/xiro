/**
 * @fileoverview Bloquea el acceso directo a /tv.html cuando showTvCard está desactivado.
 */

const path = require('path');
const uiSettings = require('../config/ui-settings');

const FORBIDDEN_HTML = path.resolve(__dirname, '../public/error/403.html');

function isTvAccessDisabled() {
    try {
        return uiSettings.get('showTvCard') === false;
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
