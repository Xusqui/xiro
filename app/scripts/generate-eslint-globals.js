#!/usr/bin/env node
/**
 * Genera eslint-public-globals.json para el lint del frontend (public/):
 *  - globals: identificadores que comparten los ficheros <script> clásicos.
 *  - modules: ficheros ES module (con import/export), que se analizan con
 *    sourceType 'module'; el resto se analiza como 'script' para que ESLint
 *    trate sus declaraciones de nivel superior como globales.
 *
 * Se consideran globales:
 *  - Declaraciones de nivel superior en scripts clásicos (sin import/export)
 *    y en <script> inline no-módulo de los .html.
 *  - Asignaciones `window.X = …` / `globalThis.X = …` en cualquier fichero.
 *
 * Uso: npm run lint:globals   (regenerar tras añadir globales nuevos)
 */
const fs = require('fs');
const path = require('path');
const espree = require('espree');

const ROOT = path.join(__dirname, '..', 'public');
const OUT = path.join(__dirname, '..', 'eslint-public-globals.json');
const APP_ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules']);
const IS_MODULE = /^\s*(import|export)\s/m;

function walk(dir, acc = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return acc;
    }
    for (const e of entries) {
        if (e.name.startsWith('._') || SKIP_DIRS.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, acc);
        else if (/\.(js|html)$/.test(e.name) && !e.name.endsWith('.min.js')) acc.push(full);
    }
    return acc;
}

function parse(code, sourceType) {
    try {
        return espree.parse(code, { ecmaVersion: 'latest', sourceType });
    } catch {
        return null;
    }
}

function collectTopLevel(ast, names) {
    for (const node of ast.body) {
        if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) {
            names.add(node.id.name);
        } else if (node.type === 'VariableDeclaration') {
            for (const d of node.declarations) {
                if (d.id.type === 'Identifier') names.add(d.id.name);
            }
        }
    }
}

const WINDOW_ASSIGN = /\b(?:window|globalThis|self)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;

function collectWindowAssignments(code, names) {
    for (const m of code.matchAll(WINDOW_ASSIGN)) names.add(m[1]);
}

function scriptsFromHtml(html) {
    const out = [];
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    for (const [, attrs, body] of html.matchAll(re)) {
        if (/\bsrc=/.test(attrs) || !body.trim()) continue;
        const type = (attrs.match(/\btype=["']?([\w/+-]+)/) || [])[1];
        if (type && type !== 'module' && type !== 'text/javascript') continue; // JSON, plantillas…
        out.push({ code: body, isModule: type === 'module' });
    }
    return out;
}

function main() {
    const names = new Set();
    const modules = [];
    for (const file of walk(ROOT)) {
        let content;
        try {
            content = fs.readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        const chunks = file.endsWith('.html')
            ? scriptsFromHtml(content)
            : [{ code: content, isModule: IS_MODULE.test(content) }];
        if (!file.endsWith('.html') && chunks[0].isModule) {
            modules.push(path.relative(APP_ROOT, file).split(path.sep).join('/'));
        }
        if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
        for (const { code, isModule } of chunks) {
            collectWindowAssignments(code, names);
            if (isModule) continue;
            const ast = parse(code, 'script');
            if (ast) collectTopLevel(ast, names);
        }
    }
    const globals = Object.fromEntries([...names].sort().map((n) => [n, 'writable']));
    fs.writeFileSync(OUT, JSON.stringify({ globals, modules: modules.sort() }, null, 2) + '\n');
    console.log(`${names.size} globales y ${modules.length} módulos escritos en ${path.relative(process.cwd(), OUT)}`);
}

main();
