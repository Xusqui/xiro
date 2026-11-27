#!/usr/bin/env node
/**
 * Autocomprobación de la skill (para cuando cambie XiRo o la propia skill).
 *
 *   node selftest.mjs                     construye examples/*.json y los mide en Chrome: sin errores ni avisos
 *   node selftest.mjs --fast              sin Chrome (los avisos heurísticos salen como NOTA, no como fallo)
 *   node selftest.mjs --xiro <ruta/app>   además comprueba que lib/xiro/ es igual que el repo y compara la simulación
 *                                         con el importador REAL de ese repo (copia sus módulos y joi a una carpeta
 *                                         temporal: no ejecuta nada en el repo)
 */

import { readdirSync, readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPackage } from './lib/build.mjs';
import { simulateImport } from './lib/check.mjs';
import { lintCanvases } from './lib/lint.mjs';
import { previewHtml, renderPreview, reportWarnings, findChrome } from './lib/preview.mjs';
import * as R from './lib/rules.mjs';
import { VENDORED_FILES } from './lib/vendor-files.mjs';
import { validateBank, QUESTION_TYPES } from './lib/bank.mjs';
import { VENDOR_DIR, origin, presets } from './lib/xiro.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.join(here, '..', 'examples');
const args = process.argv.slice(2);
const xiro = args.includes('--xiro') ? args[args.indexOf('--xiro') + 1] : null;
const withPreview = !args.includes('--fast') && !!findChrome();
let failures = 0;
const fail = msg => {
    failures++;
    console.log(`FALLO ${msg}`);
};

/** Paquetes mutados: lo que XiRo debe rechazar, recortar o aceptar tal cual. */
function mutations(base) {
    const b64 = s => Buffer.from(s).toString('base64');
    const el = (id, type, props) => ({ id, type, x: 0, y: 0, w: 100, h: 100, props });
    const longText = n => Array.from({ length: n }, (_, i) => el('el_big' + String(i).padStart(4, '0'), 'text', { text: 'x'.repeat(1990) }));
    const svgAsset = svg => ({ id: 'a99', mime: 'image/svg+xml', name: 'x.svg', data: b64(svg) });
    const cases = {
        svg_script: p => { p.assets.push(svgAsset('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')); p.slides[0].slide_canvas.background.image = 'asset:a99'; },
        svg_url_comillas: p => { p.assets.push(svgAsset("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 9 9'><rect fill=\"url('#g')\" width='9' height='9'/></svg>")); p.slides[0].slide_canvas.background.image = 'asset:a99'; },
        svg_entidad: p => { p.assets.push(svgAsset('<svg xmlns="http://www.w3.org/2000/svg"><a href="&#106;avascript:x()"><rect width="5" height="5"/></a></svg>')); p.slides[0].slide_canvas.background.image = 'asset:a99'; },
        asset_bmp: p => { p.assets.push({ id: 'a99', mime: 'image/png', name: 'x.png', data: b64('BM' + 'x'.repeat(100)) }); p.slides[0].slide_canvas.background.image = 'asset:a99'; },
        asset_grande: p => { const buf = Buffer.alloc(R.MAX_ASSET_BYTES + 10); buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); p.assets.push({ id: 'a99', mime: 'image/png', name: 'x.png', data: buf.toString('base64') }); p.slides[0].slide_canvas.background.image = 'asset:a99'; },
        video_malo: p => { p.slides[0].slide_canvas.elements.push(el('el_vid99', 'video', { url: 'https://example.com/video' })); },
        video_local: p => { p.slides[0].slide_canvas.elements.push(el('el_vid99', 'video', { url: '/uploads/v.mp4' })); },
        video_vimeo: p => { p.slides[0].slide_canvas.elements.push(el('el_vid99', 'video', { url: '  https://vimeo.com/123456  ', autoplay: true })); },
        tipo_raro: p => { p.slides[0].slide_canvas.elements.push(el('el_poly99', 'polygon', {})); },
        valores_fuera: p => { p.slides[0].slide_canvas.elements.push({ id: 'el_clamp9', type: 'text', x: 99999, y: -99999, w: 5, h: 1e9, rotation: 400.6, props: { text: 'a\r\nb', size: 999, font: 'comic', color: 'red', align: 'justify', fill: 'blue', extra: 1 } }); },
        figura_por_defecto: p => { p.slides[0].slide_canvas.elements.push({ id: 'el_shape99', type: 'shape', x: 10.4, y: 10.6, w: 30, h: 30, props: {} }); },
        formato_nuevo: p => { p.formatVersion = R.FORMAT_VERSION + 1; },
        lienzo_v2: p => { p.slides[0].slide_canvas.version = 2; },
        sin_diapositivas: p => { p.slides = []; },
        assets_repetidos: p => { p.assets.push({ ...p.assets[0] }); },
        lienzo_enorme: p => { p.slides[0].slide_canvas.elements = longText(40); },
        asset_inexistente: p => { p.slides[0].slide_canvas.background.image = 'asset:a77'; },
        texto_2500: p => { p.slides[0].slide_canvas.elements.push(el('el_long99', 'text', { text: 'y'.repeat(2500) })); },
        sesenta: p => { for (let i = 0; i < 60; i++) p.slides[0].slide_canvas.elements.push({ ...el('el_many' + String(i).padStart(4, '0'), 'shape', { shape: 'ellipse' }), w: 20, h: 20 }); },
        exportedAt_vacio: p => { p.exportedAt = ''; },
        generator_null: p => { p.generator = null; },
        sin_assets: p => { delete p.assets; p.slides[0].slide_canvas.background.image = null; },
        base64_con_salto: p => { p.assets[0].data = p.assets[0].data.slice(0, 20) + '\n' + p.assets[0].data.slice(20); },
        fondo_externo: p => { p.slides[0].slide_canvas.background.image = 'https://example.com/fondo.jpg'; },
        imagen_externa: p => { p.slides[0].slide_canvas.elements.push(el('el_imgw99', 'image', { src: 'https://example.com/foto.png' })); },
        imagen_externa_falla: p => { p.slides[0].slide_canvas.elements.push(el('el_imgw99', 'image', { src: 'https://example.com/falla.png' })); },
        imagen_data_svg: p => { p.slides[0].slide_canvas.elements.push(el('el_imgd99', 'image', { src: "data:image/svg+xml;utf8,<svg viewBox='0 0 10 10'><circle cx='5' cy='5' r='4' fill='#e11d48'/></svg>" })); },
        imagen_data_codificada: p => { p.slides[0].slide_canvas.elements.push(el('el_imgd99', 'image', { src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%%22 viewBox=%220 0 4 4%22%3E%3C/svg%3E' })); },
        imagen_data_almohadilla: p => { p.slides[0].slide_canvas.elements.push(el('el_imgd99', 'image', { src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 4'><rect width='4' height='4' fill='%23f9b518'/></svg>" })); },
        imagen_data_rota: p => { p.slides[0].slide_canvas.elements.push(el('el_imgd99', 'image', { src: 'data:image/png;base64,@@no@@' })); },
        imagen_data_script: p => { p.slides[0].slide_canvas.elements.push(el('el_imgd99', 'image', { src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' onload='x()'></svg>" })); },
        imagen_javascript: p => { p.slides[0].slide_canvas.elements.push(el('el_imgx99', 'image', { src: 'javascript:alert(1)' })); },
        version_texto: p => { p.formatVersion = '1'; },
        no_canvas: p => { p.slides[0].slide_type = 'text'; },
        tabla_irregular: p => { p.slides[0].slide_canvas.elements.push(el('el_tab99', 'table', { rows: [['a', 'b', 'c'], ['1'], [2, true, null]] })); },
        tabla_enorme: p => { p.slides[0].slide_canvas.elements.push(el('el_tab98', 'table', { rows: Array.from({ length: 25 }, () => Array(12).fill('x'.repeat(250))), size: 300, borderWidth: 50 })); },
        tabla_mala: p => { p.slides[0].slide_canvas.elements.push(el('el_tab97', 'table', { rows: 'no' })); },
        runs_descuadrados: p => { p.slides[0].slide_canvas.elements.push(el('el_run99', 'text', { text: 'otra cosa', runs: [{ text: 'Hola ' }, { text: 'mundo', bold: true, color: '#ff0000' }] })); },
        runs_sin_formato: p => { p.slides[0].slide_canvas.elements.push(el('el_run98', 'text', { runs: [{ text: 'igual' }, { text: ' que el cuadro', bold: false }] })); },
        tramo_raro: p => { p.slides[0].slide_canvas.elements.push(el('el_run97', 'text', { runs: [{ text: 'x', size: 999, font: 'comic', script: 'sup', highlight: '#ffff00', strike: true }] })); },
        parrafos_de_mas: p => { p.slides[0].slide_canvas.elements.push(el('el_par99', 'text', { text: 'uno\ndos', list: 'number', paras: [{ indent: 1, list: 'alpha' }, { list: 'none' }, { indent: 3 }] })); },
        parrafo_none_sin_lista: p => { p.slides[0].slide_canvas.elements.push(el('el_par98', 'text', { text: 'uno', paras: [{ list: 'none', lineHeight: 1.5, style: 'quote', indent: 20 }] })); },
        trazado_malo: p => { p.slides[0].slide_canvas.elements.push(el('el_pth99', 'shape', { shape: 'path', d: 'M0 0 X 5', viewBox: [10, 10] })); },
        trazado_bueno: p => { p.slides[0].slide_canvas.elements.push(el('el_pth98', 'shape', { shape: 'path', d: 'm0,0 l10 0 l-5 8z', viewBox: [10, 8] })); },
        estilo: p => { p.slides[0].slide_canvas.elements.push({ ...el('el_sty99', 'shape', {}), opacity: 0.333, shadow: { x: 4.4, y: 300, blur: 10, color: '#00000080' }, locked: true, groupId: 'g_abcd1234' }); },
        estilo_malo: p => { p.slides[0].slide_canvas.elements.push({ ...el('el_sty98', 'shape', {}), opacity: 0.01, shadow: { x: 1, y: 1, blur: 1, color: 'negro' }, locked: 'si', groupId: 'grupo' }); },
        imagen_extras: p => { p.slides[0].slide_canvas.elements.push(el('el_imge99', 'image', { src: 'asset:' + p.assets[0].id, alt: '  un   trofeo ', borderWidth: 99, borderColor: 'rojo' })); },
        degradado: p => { p.slides[0].slide_canvas.background.gradient = { to: '#000000', angle: 400 }; },
        degradado_malo: p => { p.slides[0].slide_canvas.background.gradient = { to: 'negro' }; },
        texto_justificado: p => { p.slides[0].slide_canvas.elements.push(el('el_jus99', 'text', { text: 'a', align: 'justify', underline: true, list: 'roman' })); },
        una_mala_de_dos: p => { p.slides.push({ slide_type: 'canvas', slide_canvas: { version: 1, background: { color: '#000000' }, elements: longText(40) } }); }
    };
    const out = Object.entries(cases).map(([name, fn]) => {
        const p = JSON.parse(base);
        fn(p);
        return [name, JSON.stringify(p)];
    });
    out.push(['bom', String.fromCharCode(0xfeff) + base], ['no_json', '{"format": "xiro-slide", ']);
    return out;
}

/** Copia a una carpeta temporal lo que necesita import.service.js de XiRo y lo carga. */
function loadRealImporter(appDir) {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'xiroslide-selftest-'));
    const files = [...VENDORED_FILES.filter(f => f.endsWith('.js')), 'package.json'];
    for (const f of files) {
        mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
        cpSync(path.join(appDir, f), path.join(tmp, f));
    }
    mkdirSync(path.join(tmp, 'config'), { recursive: true });
    writeFileSync(path.join(tmp, 'config/multer.js'), "module.exports = { uploadDir: require('path').join(__dirname, '../uploads') };\n");
    const req = createRequire(path.join(appDir, 'package.json'));
    const pkgJoi = path.dirname(req.resolve('joi/package.json'));
    const deps = Object.keys(JSON.parse(readFileSync(path.join(pkgJoi, 'package.json'), 'utf8')).dependencies || {});
    cpSync(pkgJoi, path.join(tmp, 'node_modules/joi'), { recursive: true });
    for (const dep of deps) {
        const src = path.join(appDir, 'node_modules', dep);
        if (existsSync(src)) cpSync(src, path.join(tmp, 'node_modules', dep), { recursive: true });
    }
    const { importSlidePackage } = createRequire(path.join(tmp, 'index.js'))('./services/slide-package/import.service');
    return { importSlidePackage, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

// Descarga simulada de las imágenes de otras webs, la misma para XiRo y para la skill: falla si la URL dice «falla»
const FAKE_PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png-body')]);
const fakeRemote = url => (url.includes('falla') ? null : FAKE_PNG);

async function compareWithReal(importer, name, text) {
    let real = null;
    let mine = null;
    let realErr = null;
    let mineErr = null;
    const fetchImage = async url => {
        const buffer = fakeRemote(url);
        if (!buffer) throw new Error('404');
        return buffer;
    };
    try {
        real = await importer.importSlidePackage(Buffer.from(text, 'utf8'), { uploadDir: '/nonexistent', writeFile: async () => {}, fetchImage });
    } catch (e) {
        realErr = e.code || e.message;
    }
    try {
        mine = simulateImport(text, { remote: { get: fakeRemote } });
    } catch (e) {
        mineErr = e.code || e.message;
    }
    const same =
        realErr === mineErr &&
        (!real || (JSON.stringify(real.slides.map(s => s.slide_canvas)) === JSON.stringify(mine.slides) && JSON.stringify(real.warnings) === JSON.stringify(mine.warnings)));
    if (!same) fail(`${name}: XiRo real=${realErr || JSON.stringify(real.warnings)} skill=${mineErr || JSON.stringify(mine && mine.warnings)}`);
    return same;
}

const built = [];
/** Specs que el generador debe rechazar, con un mensaje que diga qué corregir (error de spec, no de XiRo). */
const SPEC_ERRORS = [
    ['rol sin patrón ni caja', { elements: [{ type: 'text', role: 'title', props: { text: 'x' } }] }, 'falta'],
    ['rol que no vale en ese tipo', { layout: 'cover', elements: [{ type: 'shape', role: 'title', x: 0, y: 0, w: 100, h: 100, props: { fill: '#000000', stroke: null } }] }, 'role'],
    ['patrón desconocido', { layout: 'portada', elements: [] }, 'layout'],
    ['más textos con rol que huecos', { layout: 'cover', elements: [1, 2, 3].map(n => ({ type: 'text', role: 'title', props: { text: String(n), color: '#ffffff' } })) }, 'hueco'],
    ['gráfico con datos y con source a la vez', { elements: [{ type: 'chart', x: 0, y: 0, w: 600, h: 400, props: { source: { tableId: 'el_datos' }, data: { categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] } } }] }, 'data'],
    ['gráfico con una sola categoría', { elements: [{ type: 'chart', x: 0, y: 0, w: 600, h: 400, props: { data: { categories: ['a'], series: [{ name: 's', values: [1] }] } } }] }, 'categor'],
    ['gráfico sin números', { elements: [{ type: 'chart', x: 0, y: 0, w: 600, h: 400, props: { data: { categories: ['a', 'b'], series: [{ name: 's', values: ['x', 'y'] }] } } }] }, 'número'],
    ['tabla con columns pero sin rows', { elements: [{ type: 'table', x: 0, y: 0, w: 600, props: { columns: ['a', 'b'] } }] }, 'rows']
];

for (const [name, spec, expected] of SPEC_ERRORS) {
    try {
        await buildPackage(JSON.parse(JSON.stringify(spec)), { baseDir: examples });
        fail(`spec inválido «${name}»: el generador lo aceptó`);
    } catch (err) {
        if (String(err.message).toLowerCase().includes(expected)) console.log(`OK    spec inválido «${name}»: rechazado`);
        else fail(`spec inválido «${name}»: el mensaje no menciona «${expected}»: ${err.message}`);
    }
}

/** Las figuras que ofrece el editor (catálogo de XiRo) tienen que estar documentadas: si XiRo añade una, falla aquí. */
const formato = readFileSync(path.join(here, '..', 'references', 'formato.md'), 'utf8');
const undocumented = presets.list().map(p => p.name).filter(name => !formato.includes('`' + name + '`'));
if (undocumented.length) fail(`figuras del editor sin documentar en references/formato.md: ${undocumented.join(', ')}`);
else console.log(`OK    figuras: las ${presets.list().length} del editor están documentadas`);

for (const file of readdirSync(examples).filter(f => f.endsWith('.json')).sort()) {
    try {
        const spec = JSON.parse(readFileSync(path.join(examples, file), 'utf8'));
        const result = await buildPackage(spec, { baseDir: examples });
        let warnings = result.warnings;
        if (!withPreview) lintCanvases(result.imported).forEach(n => console.log(`NOTA  ${file}: ${n}`));
        else {
            const byId = new Map(result.assets.map(a => [a.id, a]));
            const resolve = url => (R.assetIdOf(url) ? `data:${byId.get(R.assetIdOf(url)).mime};base64,${byId.get(R.assetIdOf(url)).buffer.toString('base64')}` : url);
            const dir = mkdtempSync(path.join(os.tmpdir(), 'xiroslide-selftest-preview-'));
            const html = previewHtml({ canvases: result.canvases, resolve, title: file, notes: [] });
            const preview = renderPreview({ html, outDir: dir, slideCount: result.canvases.length, canvases: result.canvases });
            if (preview.chrome && !preview.report) fail(`${file}: Chrome no devolvió medidas`);
            warnings = [...result.warnings, ...lintCanvases(result.imported, { contrast: !preview.contrast, overlap: !preview.report }), ...reportWarnings(preview, result.canvases)];
            rmSync(dir, { recursive: true, force: true });
        }
        if (warnings.length) fail(`${file}: ${warnings.join(' | ')}`);
        else console.log(`OK    ${file}: ${result.canvases.length} diapositiva(s), ${Math.round(result.bytes / 1024)} KB, sin avisos${withPreview ? ' (medido en Chrome)' : ''}`);
        built.push([file, result.text]);
    } catch (err) {
        fail(`${file}: ${err.message}`);
    }
}

/** La copia de lib/xiro/ debe ser idéntica a los ficheros del repo (si no, toca sync-xiro.mjs). */
function compareVendored(appDir) {
    const stale = VENDORED_FILES.filter(f => !existsSync(path.join(appDir, f)) || readFileSync(path.join(appDir, f), 'utf8') !== readFileSync(path.join(VENDOR_DIR, f), 'utf8'));
    if (stale.length) fail(`la copia de XiRo en lib/xiro/ está desfasada (${stale.join(', ')}): ejecuta node scripts/sync-xiro.mjs ${appDir}`);
    else console.log(`OK    copia de XiRo al día: ${VENDORED_FILES.length} ficheros iguales que en el repo (copiados de ${origin.xiro}${origin.commit ? `, ${origin.commit}` : ''})`);
}

/** El esquema de bancos copiado en references/ es válido para el validador y cubre todos los tipos. */
function checkBankSchema() {
    const copy = JSON.parse(readFileSync(path.join(here, '..', 'references', 'banco-schema.json'), 'utf8'));
    const errors = validateBank(copy);
    const missing = QUESTION_TYPES.filter(type => !copy.questions.some(q => q.type === type));
    if (errors.length) fail(`banco-schema.json no pasa bank.mjs: ${errors.join('; ')}`);
    else if (missing.length) fail(`banco-schema.json no trae ejemplo de: ${missing.join(', ')}`);
    else console.log(`OK    banco-schema.json válido, con los ${QUESTION_TYPES.length} tipos de pregunta`);
    const bad = validateBank({ ...copy, questions: [{ ...copy.questions[0], options: copy.questions[0].options.map(o => ({ ...o, is_correct: false })) }] });
    if (!bad.length) fail('bank.mjs aceptó un quiz sin respuesta correcta');
}

/** El esquema de bancos de la skill es idéntico al del repo. */
function compareBankSchema(appDir) {
    const same = readFileSync(path.join(appDir, 'public/data/schema.json'), 'utf8') === readFileSync(path.join(here, '..', 'references', 'banco-schema.json'), 'utf8');
    if (same) console.log('OK    banco-schema.json igual que public/data/schema.json');
    else fail(`references/banco-schema.json desfasado: ejecuta node scripts/sync-xiro.mjs ${appDir}`);
}

checkBankSchema();

if (xiro) {
    compareVendored(path.resolve(xiro));
    compareBankSchema(path.resolve(xiro));
    const importer = loadRealImporter(path.resolve(xiro));
    try {
        let same = 0;
        const cases = [...built, ...mutations(built.find(([, t]) => JSON.parse(t).assets.length)[1])];
        for (const [name, text] of cases) if (await compareWithReal(importer, name, text)) same++;
        console.log(`${same === cases.length ? 'OK   ' : 'FALLO'} importador real de XiRo: ${same}/${cases.length} paquetes con el mismo resultado`);
    } finally {
        importer.cleanup();
    }
}

console.log(failures ? `${failures} fallo(s)` : 'Todo bien');
process.exitCode = failures ? 1 : 0;
