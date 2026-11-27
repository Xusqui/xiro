#!/usr/bin/env node
/**
 * Copia en scripts/lib/xiro/ los módulos reales de XiRo que usa la skill, con la misma estructura
 * de carpetas que en el repo, para que sus require() relativos funcionen tal cual:
 *
 *   node sync-xiro.mjs <ruta a la carpeta app de XiRo>
 *
 * Así la skill normaliza, valida y pinta con el mismo código que XiRo, en vez de con una copia
 * hecha a mano que se desfasa. Solo lee del repo: no ejecuta nada dentro de él.
 * Además deja:
 *   - node_modules/joi: el build de navegador de joi (un solo fichero, sin dependencias);
 *   - config/multer.js y package.json mínimos, que pide import.service.js al cargarse;
 *   - las fuentes del lienzo (woff2) y su fonts.css, para que la vista previa no necesite internet;
 *   - origin.json: versión y commit de XiRo del que salió la copia.
 */

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VENDORED_FILES, CANVAS_FONT_FAMILIES } from './lib/vendor-files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, 'lib', 'xiro');

function fail(message) {
    console.error(`ERROR ${message}`);
    process.exitCode = 1;
}

/** fonts.css de XiRo reducido a las familias del lienzo, y los woff2 que nombra. */
function fontFaces(appDir) {
    const css = readFileSync(path.join(appDir, 'public/css/fonts.css'), 'utf8');
    const rules = css.match(/@font-face\{[^}]*\}/g) || [];
    const kept = rules.filter(rule => CANVAS_FONT_FAMILIES.some(family => rule.includes(`font-family:'${family}'`)));
    const files = kept.map(rule => /url\(\/fonts\/([^)]+)\)/.exec(rule)).filter(Boolean).map(m => m[1]);
    return { css: kept.join('\n') + '\n', files };
}

function gitCommit(appDir) {
    try {
        return execFileSync('git', ['-C', appDir, 'log', '-1', '--format=%h %cs'], { encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
}

function copyJoi(appDir) {
    const joi = path.join(appDir, 'node_modules/joi');
    const version = JSON.parse(readFileSync(path.join(joi, 'package.json'), 'utf8')).version;
    const dest = path.join(target, 'node_modules/joi');
    mkdirSync(dest, { recursive: true });
    cpSync(path.join(joi, 'dist/joi-browser.min.js'), path.join(dest, 'joi-browser.min.js'));
    cpSync(path.join(joi, 'LICENSE.md'), path.join(dest, 'LICENSE.md'));
    writeFileSync(path.join(dest, 'package.json'), JSON.stringify({ name: 'joi', version, main: 'index.js' }, null, 2) + '\n');
    // El build de navegador nombra `self` al cargarse; en Node no existe
    writeFileSync(
        path.join(dest, 'index.js'),
        "if (typeof self === 'undefined') globalThis.self = globalThis;\nmodule.exports = require('./joi-browser.min.js');\n"
    );
    return version;
}

function writeStubs(version) {
    writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'xiro-vendored', version, private: true }, null, 2) + '\n');
    mkdirSync(path.join(target, 'config'), { recursive: true });
    writeFileSync(
        path.join(target, 'config/multer.js'),
        "// Sustituto mínimo: la skill nunca escribe en /uploads (import.service.js solo lee uploadDir)\nmodule.exports = { uploadDir: require('path').join(__dirname, '../uploads') };\n"
    );
}

function sync(appDir) {
    const missing = VENDORED_FILES.filter(f => !existsSync(path.join(appDir, f)));
    if (missing.length) return fail(`no encuentro en ${appDir}: ${missing.join(', ')}`);
    rmSync(target, { recursive: true, force: true });
    for (const file of VENDORED_FILES) {
        mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
        cpSync(path.join(appDir, file), path.join(target, file));
    }
    const fonts = fontFaces(appDir);
    writeFileSync(path.join(target, 'public/css/fonts.css'), fonts.css);
    mkdirSync(path.join(target, 'public/fonts'), { recursive: true });
    fonts.files.forEach(f => cpSync(path.join(appDir, 'public/fonts', f), path.join(target, 'public/fonts', f)));
    // Esquema de bancos de preguntas: lo usa la parte «banco» de la skill (references/banco.md)
    cpSync(path.join(appDir, 'public/data/schema.json'), path.join(here, '..', 'references', 'banco-schema.json'));
    const joi = copyJoi(appDir);
    const version = JSON.parse(readFileSync(path.join(appDir, 'package.json'), 'utf8')).version;
    writeStubs(version);
    const origin = { xiro: version, commit: gitCommit(appDir), joi, syncedAt: new Date().toISOString(), files: VENDORED_FILES };
    writeFileSync(path.join(target, 'origin.json'), JSON.stringify(origin, null, 2) + '\n');
    console.log(`OK    ${VENDORED_FILES.length} módulos, ${fonts.files.length} fuentes y joi ${joi} copiados de XiRo ${version}${origin.commit ? ` (${origin.commit})` : ''}`);
}

const appDir = process.argv[2];
if (!appDir) fail('uso: node sync-xiro.mjs <ruta a la carpeta app de XiRo>');
else sync(path.resolve(appDir));
