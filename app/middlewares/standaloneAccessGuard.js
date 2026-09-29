/**
 * @fileoverview Bloquea el acceso directo a /standalone.html cuando showStandaloneCard está desactivado.
 */

const path = require('path');
const uiSettings = require('../config/ui-settings');

const FORBIDDEN_HTML = path.resolve(__dirname, '../public/error/403.html');

function isStandaloneAccessDisabled() {
    try {
        return uiSettings.get('showStandaloneCard') === false;
    } catch {
        // En caso de error al leer configuración, bloqueamos por seguridad.
        return true;
    }
}

function isStandalonePath(requestPath) {
    return requestPath === '/standalone.html' || requestPath === '/standalone.html/';
}

function standaloneAccessGuard(req, res, next) {
    if (!isStandalonePath(req.path)) return next();
    if (!isStandaloneAccessDisabled()) return next();

    if (req.method === 'HEAD') {
        return res.status(403).end();
    }

    return res.status(403).sendFile(FORBIDDEN_HTML);
}

module.exports = standaloneAccessGuard;
