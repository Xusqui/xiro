#!/usr/bin/env node
/**
 * Diapositivas libres de XiRo (.xiroslide) desde la terminal. Sin dependencias (Node 18+).
 *
 *   build   <spec.json> [--out DIR|archivo.xiroslide] [--preview-dir DIR] [--no-copy] [--no-preview]
 *   check   <archivo.xiroslide> [--preview] [--preview-dir DIR]
 *   preview <spec.json|archivo.xiroslide> [--preview-dir DIR]
 *   unpack  <archivo.xiroslide> [--dir DIR]
 *   copy    <archivo.xiroslide>
 *   bank    <banco.json> [--out DIR|archivo.json] [--no-write]   valida un banco de preguntas y lo deja en Descargas
 *
 * Formato del spec y guía de diseño: ../references/formato.md y ../references/diseno.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as R from './lib/rules.mjs';
import { buildPackage, SpecError, TOOL_MARK } from './lib/build.mjs';
import { simulateImport, fetchRemoteImages, PackageError, describeWarning } from './lib/check.mjs';
import { lintCanvases } from './lib/lint.mjs';
import { previewHtml, renderPreview, reportWarnings } from './lib/preview.mjs';
import { copyToClipboard } from './lib/clipboard.mjs';
import { unpackPackage } from './lib/unpack.mjs';
import { validateBank } from './lib/bank.mjs';

const USAGE = `Uso:
  node xiroslide.mjs build   <spec.json> [--out DIR|archivo.xiroslide] [--preview-dir DIR] [--no-copy] [--no-preview]
  node xiroslide.mjs check   <archivo.xiroslide> [--preview] [--preview-dir DIR]
  node xiroslide.mjs preview <spec.json|archivo.xiroslide> [--preview-dir DIR]
  node xiroslide.mjs unpack  <archivo.xiroslide> [--dir DIR]
  node xiroslide.mjs copy    <archivo.xiroslide>
  node xiroslide.mjs bank    <banco.json> [--out DIR|archivo.json] [--no-write]   (banco de preguntas, no diapositivas)`;

const kb = bytes => (bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);
const home = p => (p && p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p);
const say = (tag, msg) => console.log(`${tag.padEnd(6)}${msg}`);

function parseArgs(argv) {
    const opts = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--no-copy') opts.copy = false;
        else if (a === '--no-preview') opts.preview = false;
        else if (a === '--preview') opts.preview = true;
        else if (a === '--no-write') opts.write = false;
        else if (['--out', '--dir', '--preview-dir'].includes(a)) opts[a.slice(2).replace('-d', 'D')] = home(argv[++i]);
        else if (a.startsWith('--')) throw new SpecError(`opción desconocida ${a}\n${USAGE}`);
        else opts._.push(home(a));
    }
    return opts;
}

function readJson(file) {
    const text = readFileSync(file, 'utf8');
    try {
        return JSON.parse(text);
    } catch (err) {
        const pos = /position (\d+)/.exec(err.message);
        const line = pos ? text.slice(0, Number(pos[1])).split('\n').length : null;
        throw new SpecError(`${file} no es JSON válido${line ? ` (línea ${line})` : ''}: ${err.message}`);
    }
}

function defaultOutDir() {
    if (existsSync('/mnt/user-data/outputs')) return '/mnt/user-data/outputs';
    const downloads = path.join(os.homedir(), 'Downloads');
    return existsSync(downloads) ? downloads : process.cwd();
}

/** ¿Lo generó esta herramienta? (solo esos se sobrescriben sin preguntar) */
function isOurs(file) {
    try {
        const data = JSON.parse(readFileSync(file, 'utf8'));
        return !!(data && data.generator && data.generator.tool === TOOL_MARK);
    } catch {
        return false;
    }
}

function outputFile(out, name) {
    if (out && /\.xiroslide$/i.test(out)) {
        mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
        return path.resolve(out);
    }
    const dir = out ? path.resolve(out) : defaultOutDir();
    mkdirSync(dir, { recursive: true });
    const base = R.fileNameFor(name);
    let file = path.join(dir, base);
    for (let n = 2; existsSync(file) && !isOurs(file); n++) file = path.join(dir, base.replace(/\.xiroslide$/, `-${n}.xiroslide`));
    return file;
}

const dataUri = (mime, buffer) => `data:${mime};base64,${buffer.toString('base64')}`;

/**
 * Pinta la vista previa, la mide con Chrome y devuelve todos los avisos de diseño (sin vista previa,
 * solo los que se pueden calcular sin navegador).
 */
function designWarnings({ canvases, resolve, title, dir, notes, preview }) {
    if (!preview) return [...notes, ...lintCanvases(canvases)];
    const html = list => previewHtml({ canvases, resolve, title, notes: list });
    const result = renderPreview({ html: html(notes), outDir: dir, slideCount: canvases.length, canvases });
    const all = [...notes, ...lintCanvases(canvases, { contrast: !result.contrast, overlap: !result.report }), ...reportWarnings(result, canvases)];
    writeFileSync(result.htmlPath, html(all));
    say('OK', `Vista previa: ${result.htmlPath}`);
    result.pngs.forEach(p => say('', `  ${p}`));
    if (!result.chrome) say('NOTA', 'sin Chrome/Chromium: no hay PNG ni medidas de texto (abre el index.html en un navegador)');
    else if (!result.report) say('AVISO', 'Chrome no devolvió las medidas de texto: los avisos de letra reducida, contraste real y solapes no están comprobados');
    return all;
}

function printWarnings(list, measured) {
    if (!list.length) return say('OK', measured ? 'Sin avisos de diseño' : 'Sin avisos de diseño (estimado sin navegador)');
    console.log(measured ? `AVISOS (${list.length}):` : `AVISOS estimados sin navegador (${list.length}); --preview los mide de verdad:`);
    list.forEach(w => console.log(`  - ${w}`));
}

async function build(specPath, opts, write) {
    const spec = readJson(specPath);
    const result = await buildPackage(spec, { baseDir: path.dirname(path.resolve(specPath)) });
    const count = result.canvases.reduce((n, c) => n + c.elements.length, 0);
    const imgs = result.assets.length;
    say('OK', `«${result.name}»: ${result.canvases.length} diapositiva${result.canvases.length > 1 ? 's' : ''}, ${count} elementos, ${imgs} ${imgs === 1 ? 'imagen' : 'imágenes'} — XiRo la importaría sin avisos`);
    result.notes.forEach(n => say('NOTA', n));
    if (write) {
        const file = outputFile(opts.out, result.name);
        writeFileSync(file, result.text);
        say('OK', `Archivo: ${file} (${kb(result.bytes)})`);
        if (opts.copy !== false) {
            const clip = copyToClipboard(result.text);
            if (clip) say('OK', `Portapapeles: copiado${clip.verified ? ' y verificado' : ''} (${clip.tool}) — en XiRo: «Diapositiva libre» → «Pegar»`);
            else say('NOTA', 'no hay portapapeles en este equipo; usa el archivo con «Importar archivo»');
        }
    }
    const byId = new Map(result.assets.map(a => [a.id, a]));
    const resolve = url => {
        const id = R.assetIdOf(url);
        return id ? dataUri(byId.get(id).mime, byId.get(id).buffer) : url;
    };
    const slug = R.fileNameFor(result.name).replace(/\.xiroslide$/, '');
    const dir = opts.previewDir || path.join(path.dirname(path.resolve(specPath)), `${slug}-preview`);
    const measured = opts.preview !== false;
    printWarnings(designWarnings({ canvases: result.canvases, resolve, title: result.name, dir, notes: result.warnings, preview: measured }), measured);
}

async function check(file, opts) {
    const text = readFileSync(file, 'utf8');
    // XiRo descarga al importar las imágenes de otras webs: se intenta lo mismo para saber si las conseguirá
    const result = simulateImport(text, { remote: await fetchRemoteImages(text) });
    const { pkg, slides, warnings, skipped, usable } = result;
    const gen = pkg.generator ? `${pkg.generator.app || '?'}${pkg.generator.version ? ' ' + pkg.generator.version : ''}${pkg.generator.tool ? ` (${pkg.generator.tool})` : ''}` : 'desconocido';
    say('OK', `${path.basename(file)}: formato ${pkg.format} v${pkg.formatVersion}, generado por ${gen}, ${kb(Buffer.byteLength(text))}`);
    slides.forEach((c, i) => {
        const types = {};
        c.elements.forEach(e => (types[e.type] = (types[e.type] || 0) + 1));
        const desc = Object.entries(types).map(([t, n]) => `${n} ${t}`).join(', ') || 'vacía';
        say('', `  Diapositiva ${i + 1}: ${desc}; fondo ${c.background.color}${c.background.image ? ' + imagen' : ''}${R.firstText(c) ? ` — «${R.firstText(c)}»` : ''}`);
    });
    usable.forEach(a => say('', `  Imagen ${a.id}: ${a.type}, ${kb(a.buffer.length)}`));
    if (warnings.length) {
        console.log('XiRo la importaría CON AVISOS:');
        warnings.forEach(w => console.log(`  - ${describeWarning(w)}`));
        skipped.forEach(s => console.log(`  - diapositiva ${s.n}: ${s.errors.join('; ')}`));
    } else say('OK', 'XiRo la importaría sin avisos');
    const byName = new Map([...usable.values()].map(a => [`/uploads/${a.filename}`, a]));
    const resolve = url => (byName.has(url) ? dataUri(byName.get(url).type, byName.get(url).buffer) : url);
    const slug = path.basename(file).replace(/\.[^.]+$/, '');
    const dir = opts.previewDir || path.join(os.tmpdir(), 'xiroslide-preview', slug);
    printWarnings(designWarnings({ canvases: slides, resolve, title: slug, dir, notes: [], preview: !!opts.preview }), !!opts.preview);
    return warnings.length === 0;
}

/** ¿Es un banco con ese nombre (resto de una ejecución anterior de esta herramienta)? Solo esos se sobrescriben. */
function isBankNamed(file, name) {
    try {
        return JSON.parse(readFileSync(file, 'utf8')).name === name;
    } catch {
        return false;
    }
}

function bankOutputFile(out, name) {
    if (out && /\.json$/i.test(out)) {
        mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
        return path.resolve(out);
    }
    const dir = out ? path.resolve(out) : defaultOutDir();
    mkdirSync(dir, { recursive: true });
    const base = R.fileNameFor(name).replace(/\.xiroslide$/, '');
    let file = path.join(dir, `${base}.json`);
    for (let n = 2; existsSync(file) && !isBankNamed(file, name); n++) file = path.join(dir, `${base}-${n}.json`);
    return file;
}

/** Valida un banco de preguntas y, si es correcto, lo deja listo para «Importar» en el panel de bancos de XiRo. */
function bank(file, opts) {
    const data = readJson(file);
    const errors = validateBank(data);
    if (errors.length) throw new SpecError(`el banco no es válido para XiRo (${errors.length}):\n${errors.map(e => `  - ${e}`).join('\n')}`);
    const types = {};
    data.questions.forEach(q => (types[q.type] = (types[q.type] || 0) + 1));
    say('OK', `«${data.name}»: ${data.questions.length} preguntas (${Object.entries(types).map(([t, n]) => `${n} ${t}`).join(', ')}) — formato válido`);
    if (opts.write === false) return;
    const dest = bankOutputFile(opts.out, data.name);
    writeFileSync(dest, JSON.stringify(data, null, 4) + '\n');
    say('OK', `Archivo: ${dest} — en XiRo: Banco de preguntas → «Importar»`);
}

async function main(argv) {
    const [cmd, ...rest] = argv;
    const opts = parseArgs(rest);
    const target = opts._[0];
    if (!cmd || cmd === '--help' || cmd === '-h' || !target) {
        console.log(USAGE);
        return cmd && cmd !== '--help' && cmd !== '-h' ? 2 : 0;
    }
    if (!existsSync(target)) throw new SpecError(`no existe ${target}`);
    if (cmd === 'bank') bank(target, opts);
    else if (cmd === 'build') await build(target, opts, true);
    else if (cmd === 'check') return (await check(target, opts)) ? 0 : 1;
    else if (cmd === 'preview') {
        if (/\.json$/i.test(target)) await build(target, opts, false);
        else await check(target, { ...opts, preview: true });
    } else if (cmd === 'unpack') {
        const slug = path.basename(target).replace(/\.[^.]+$/, '');
        const dir = path.resolve(opts.dir || path.join(os.tmpdir(), 'xiroslide-unpack', slug));
        const r = unpackPackage(readFileSync(target, 'utf8'), dir, slug);
        say('OK', `Spec: ${r.specPath}`);
        r.files.forEach(f => say('', `  ${path.join(dir, f)}`));
        r.warnings.forEach(w => say('AVISO', w));
    } else if (cmd === 'copy') {
        const text = readFileSync(target, 'utf8');
        const r = simulateImport(text);
        if (r.warnings.length) say('AVISO', `XiRo la importaría con avisos: ${r.warnings.map(describeWarning).join('; ')}`);
        const clip = copyToClipboard(text);
        if (!clip) throw new SpecError('no hay portapapeles en este equipo');
        say('OK', `Portapapeles: copiado${clip.verified ? ' y verificado' : ''} (${clip.tool}) — en XiRo: «Diapositiva libre» → «Pegar»`);
    } else {
        console.log(USAGE);
        return 2;
    }
    return 0;
}

// process.exitCode y no process.exit(): en Node 26 salir a la fuerza con el GC trabajando puede dejar el proceso colgado
main(process.argv.slice(2)).then(
    code => {
        process.exitCode = code || 0;
    },
    err => {
        if (err instanceof SpecError || err instanceof PackageError) {
            console.log(`ERROR ${err.message}`);
            console.log('No se ha generado nada.');
        } else console.log(`ERROR inesperado: ${err.stack || err.message}`);
        process.exitCode = 1;
    }
);
