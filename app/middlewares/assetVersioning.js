/**
 * @fileoverview Versiona automáticamente los assets (.js, .css, .svg) referenciados en
 * HTML y en imports ES6 de JS, añadiendo ?v=<hash-del-contenido>. Sustituye a
 * scripts/update-assets-version.js: no requiere ejecutar nada, el hash se recalcula
 * solo cuando el fichero referenciado cambia (detectado por mtime).
 *
 * IMPORTANTE: en los HTML solo se versionan referencias a assets EXTERNOS
 * (src="...js", href="...css"/"...svg"). El contenido de bloques <script
 * type="module"> INLINE nunca se toca, porque algunas páginas (p. ej.
 * juego-concluido.html) fijan esos scripts inline en el CSP mediante un hash
 * sha256 calculado sobre el fichero fuente sin modificar. Si se reescribiera
 * el "import ... from" dentro de ese bloque (añadiendo ?v=hash), el contenido
 * servido dejaría de coincidir con el hash del CSP y el navegador bloquearía
 * el script silenciosamente (sin excepción JS visible), rompiendo cualquier
 * lógica que dependa de él.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const JS_REGEX = /src="(?!https?:\/\/)([^"]+\.js)(?:\?v=[a-zA-Z0-9_-]+)?"/g;
const CSS_REGEX = /href="(?!https?:\/\/)([^"]+\.css)(?:\?v=[a-zA-Z0-9_-]+)?"/g;
const SVG_REGEX = /(src|href)="(?!https?:\/\/)([^"]+\.svg)(?:\?v=[a-zA-Z0-9_-]+)?"/g;
const JS_IMPORT_REGEX = /(from\s+|import\s+|import\s*\(\s*)(['"])(?!https?:\/\/)([^'"]+\.js)(?:\?v=[a-zA-Z0-9_-]+)?\2/g;

const hashCache = new Map();

function getFileHash(absPath) {
    try {
        const stat = fs.statSync(absPath);
        const cached = hashCache.get(absPath);
        if (cached && cached.mtimeMs === stat.mtimeMs) {
            return cached.hash;
        }
        const buffer = fs.readFileSync(absPath);
        const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10);
        hashCache.set(absPath, { mtimeMs: stat.mtimeMs, hash });
        return hash;
    } catch {
        return null;
    }
}

function resolveAssetAbsPath(baseDir, assetPath) {
    const cleanPath = decodeURIComponent(assetPath.split('?')[0]);
    const abs = cleanPath.startsWith('/')
        ? path.join(PUBLIC_DIR, cleanPath)
        : path.resolve(baseDir, cleanPath);

    if (abs !== PUBLIC_DIR && !abs.startsWith(PUBLIC_DIR + path.sep)) {
        return null; // fuera de public/, posible path traversal
    }
    return abs;
}

function hashFor(assetPath, baseDir) {
    const abs = resolveAssetAbsPath(baseDir, assetPath);
    return abs ? getFileHash(abs) : null;
}

// Versiona referencias a assets externos: src="...js", href="...css", src/href="...svg".
// Se usa tanto para HTML como para JS (por si un .js referencia un .svg, etc.), pero
// NUNCA para el "import ... from" de un módulo, que se trata aparte.
function versionExternalRefs(content, baseDir) {
    return content
        .replace(JS_REGEX, (match, assetPath) => {
            const hash = hashFor(assetPath, baseDir);
            return hash ? `src="${assetPath}?v=${hash}"` : match;
        })
        .replace(CSS_REGEX, (match, assetPath) => {
            const hash = hashFor(assetPath, baseDir);
            return hash ? `href="${assetPath}?v=${hash}"` : match;
        })
        .replace(SVG_REGEX, (match, attr, assetPath) => {
            const hash = hashFor(assetPath, baseDir);
            return hash ? `${attr}="${assetPath}?v=${hash}"` : match;
        });
}

// Versiona imports ES6 ("import ... from '/x.js'"). Solo se invoca sobre ficheros
// .js reales servidos como archivo (nunca sobre HTML), para no tocar el contenido
// de <script type="module"> inline protegidos por hash en el CSP.
function versionJsImports(content, baseDir) {
    return content.replace(JS_IMPORT_REGEX, (match, prefix, quote, assetPath) => {
        const hash = hashFor(assetPath, baseDir);
        return hash ? `${prefix}${quote}${assetPath}?v=${hash}${quote}` : match;
    });
}

function assetVersioningMiddleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
    }

    const reqPath = req.path === '/' ? '/index.html' : req.path;
    const isHtml = reqPath.endsWith('.html');
    const isJs = reqPath.endsWith('.js');
    if (!isHtml && !isJs) {
        return next();
    }

    const absFile = path.join(PUBLIC_DIR, decodeURIComponent(reqPath));
    if (absFile !== PUBLIC_DIR && !absFile.startsWith(PUBLIC_DIR + path.sep)) {
        return next();
    }

    fs.readFile(absFile, 'utf8', (err, content) => {
        if (err) {
            return next(); // no existe / no legible: deja que static devuelva 404
        }
        if (isJs && !content.includes('import')) {
            return next(); // script sin imports locales: static lo sirve tal cual
        }

        const baseDir = path.dirname(absFile);
        let versioned = versionExternalRefs(content, baseDir);
        if (isJs) {
            // Solo los ficheros .js externos versionan sus "import ... from"; el
            // contenido de scripts inline en HTML (fijados por hash CSP) no se toca.
            versioned = versionJsImports(versioned, baseDir);
        }

        if (isHtml) {
            res.type('html');
            res.setHeader('Cache-Control', 'no-cache');
        } else {
            res.type('application/javascript');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        res.send(versioned);
    });
}

module.exports = assetVersioningMiddleware;
