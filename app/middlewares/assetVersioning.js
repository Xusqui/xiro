/**
 * @fileoverview Versiona automáticamente los assets (.js, .css, .svg) referenciados en
 * HTML y en imports ES6 de JS, añadiendo ?v=<hash-del-contenido>. Sustituye a
 * scripts/update-assets-version.js: no requiere ejecutar nada, el hash se recalcula
 * solo cuando el fichero referenciado cambia (detectado por mtime).
 *
 * En los .js el hash cubre también todo lo que el módulo importa (directa o
 * indirectamente): ver getModuleVersion().
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
// Mismo patrón sin /g: ¿el fichero importa o reexporta (export … from) algún módulo local?
const HAS_JS_IMPORT_REGEX = new RegExp(JS_IMPORT_REGEX.source);

// Recalcular el árbol de un módulo en cada petición sería caro (el presentador
// importa ~40 módulos); dentro de una misma carga de página basta con uno.
const MODULE_VERSION_TTL_MS = 1000;

const fileInfoCache = new Map(); // abs → { mtimeMs, hash, imports }
const moduleVersionCache = new Map(); // abs → { hash, at }

// i18n-core.js pide los diccionarios JSON con ?v=CONFIG.version; esas URLs no
// pasan por aquí, así que se sustituye CONFIG.version por un hash de todos los
// JSON y ese hash entra también en el ?v= de i18n-core.js.
const I18N_DIR = path.join(PUBLIC_DIR, 'js', 'i18n');
const I18N_CORE = path.join(I18N_DIR, 'i18n-core.js');
const I18N_VERSION_REGEX = /(version:\s*)(['"])[^'"]*\2/;

let i18nJsonHash; // se calcula una sola vez por proceso: cambiar un JSON exige reiniciar

function sha1(data) {
    return crypto.createHash('sha1').update(data).digest('hex').slice(0, 10);
}

function getI18nJsonHash() {
    if (i18nJsonHash === undefined) {
        try {
            const files = fs.readdirSync(I18N_DIR, { recursive: true })
                .filter((file) => file.endsWith('.json'))
                .sort();
            i18nJsonHash = files.length
                ? sha1(files.map((file) => `${file}:${sha1(fs.readFileSync(path.join(I18N_DIR, file)))}`).join('\n'))
                : null;
        } catch {
            i18nJsonHash = null;
        }
    }
    return i18nJsonHash;
}

function parseImports(content, baseDir) {
    const deps = [];
    for (const match of content.matchAll(JS_IMPORT_REGEX)) {
        const abs = resolveAssetAbsPath(baseDir, match[3]);
        if (abs) deps.push(abs);
    }
    return deps;
}

function getFileInfo(absPath) {
    try {
        const stat = fs.statSync(absPath);
        const cached = fileInfoCache.get(absPath);
        if (cached && cached.mtimeMs === stat.mtimeMs) {
            return cached;
        }
        const buffer = fs.readFileSync(absPath);
        const imports = absPath.endsWith('.js') ? parseImports(buffer.toString('utf8'), path.dirname(absPath)) : [];
        const info = { mtimeMs: stat.mtimeMs, hash: sha1(buffer), imports };
        fileInfoCache.set(absPath, info);
        return info;
    } catch {
        return null;
    }
}

// Versión de un módulo JS: hash de su contenido y del de todo lo que importa.
// Si dependiera solo de su propio contenido, un módulo sin cambios conservaría
// su URL (servida immutable) y seguiría apuntando a la versión antigua de sus
// dependencias, mientras los módulos modificados apuntan a la nueva: el navegador
// cargaría dos copias del mismo módulo, cada una con su propio estado.
// Se recorre el conjunto de ficheros alcanzables, así que los ciclos no son problema.
function getModuleVersion(absPath) {
    const cached = moduleVersionCache.get(absPath);
    if (cached && Date.now() - cached.at < MODULE_VERSION_TTL_MS) {
        return cached.hash;
    }
    const seen = new Map();
    const pending = [absPath];
    while (pending.length) {
        const current = pending.pop();
        if (seen.has(current)) continue;
        const info = getFileInfo(current);
        if (!info) {
            if (current === absPath) return null;
            continue;
        }
        seen.set(current, info.hash);
        pending.push(...info.imports);
    }
    const digest = [...seen.entries()]
        .map(([file, hash]) => `${path.relative(PUBLIC_DIR, file)}:${hash}`)
        .sort()
        .join('\n');
    const hash = sha1(digest);
    moduleVersionCache.set(absPath, { hash, at: Date.now() });
    return hash;
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
    if (!abs) return null;
    if (!abs.endsWith('.js')) return getFileInfo(abs)?.hash ?? null;
    const hash = getModuleVersion(abs);
    return hash && abs === I18N_CORE ? sha1(`${hash}:${getI18nJsonHash()}`) : hash;
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

const INLINE_SCRIPT_REGEX = /<script(?![^>]*\bsrc\b)[^>]*>[\s\S]*?<\/script>/gi;

// Igual que versionExternalRefs, pero para HTML: preserva intacto el contenido
// de los bloques <script> inline (sin src). Ese contenido es JS, no HTML, y
// puede incluir literales como src="foo.svg" dentro de plantillas de cadena
// que no son atributos reales. Si se reescribieran, el SHA-256 servido dejaría
// de coincidir con el hash fijado en el CSP (middlewares/security.js) y el
// navegador bloquearía el script inline sin excepción JS visible.
function versionHtmlExternalRefs(content, baseDir) {
    let result = '';
    let lastIndex = 0;
    let match;
    INLINE_SCRIPT_REGEX.lastIndex = 0;
    while ((match = INLINE_SCRIPT_REGEX.exec(content))) {
        result += versionExternalRefs(content.slice(lastIndex, match.index), baseDir);
        result += match[0];
        lastIndex = INLINE_SCRIPT_REGEX.lastIndex;
    }
    result += versionExternalRefs(content.slice(lastIndex), baseDir);
    return result;
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
        const isI18nCore = absFile === I18N_CORE;
        if (isJs && !isI18nCore && !HAS_JS_IMPORT_REGEX.test(content)) {
            return next(); // script sin imports locales: static lo sirve tal cual
        }
        if (isI18nCore) {
            const jsonHash = getI18nJsonHash();
            if (jsonHash) content = content.replace(I18N_VERSION_REGEX, `$1$2${jsonHash}$2`);
        }

        const baseDir = path.dirname(absFile);
        let versioned = isHtml
            ? versionHtmlExternalRefs(content, baseDir)
            : versionExternalRefs(content, baseDir);
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
