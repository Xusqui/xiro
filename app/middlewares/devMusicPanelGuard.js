/**
 * @fileoverview Panel de pruebas de la música (/dev/music). Solo existe con
 * MUSIC_DEV_PANEL=true en el entorno (beta en el NAS); en producción (imagen de
 * Docker Hub) responde 404 igual que cualquier ruta desconocida.
 *
 * No se decide por NODE_ENV: beta y producción corren ambos con 'production'.
 * Con el panel activo, /dev/music se reescribe a /dev/music.html para que pase
 * por el versionado de assets y por express.static como cualquier página.
 */

const path = require('path');

const NOT_FOUND_HTML = path.resolve(__dirname, '../public/error/404.html');
const PANEL_PATHS = new Set(['/dev/music', '/dev/music/', '/dev/music.html']);

function isPanelEnabled() {
    return process.env.MUSIC_DEV_PANEL === 'true';
}

function devMusicPanelGuard(req, res, next) {
    if (!PANEL_PATHS.has(req.path)) return next();

    if (!isPanelEnabled()) {
        if (req.method === 'HEAD') return res.status(404).end();
        return res.status(404).sendFile(NOT_FOUND_HTML);
    }

    if (req.path !== '/dev/music.html') req.url = '/dev/music.html';
    return next();
}

module.exports = devMusicPanelGuard;
module.exports.isPanelEnabled = isPanelEnabled;
