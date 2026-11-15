/**
 * Vista previa fiel de las diapositivas: el HTML y el CSS de XiRo (public/js/core/slide-canvas-render.js
 * y css/slide-canvas.css, copiados en lib/xiro/), con las imágenes del paquete en data: URI y las fuentes
 * del lienzo incrustadas (sin internet). Con Chrome/Chromium en modo headless saca un PNG de 1920x1080
 * por diapositiva y mide cada texto (letra final tras el ajuste, palabras partidas...).
 */

import { writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { mapCanvasMedia } from './rules.mjs';
import { render, canvasCss, fontsCss } from './xiro.mjs';
import { readPng, pixel } from './png.mjs';
import { rgba, over, contrast, minContrast, elementLabel } from './lint.mjs';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"'`]/g, ch => ESC[ch]);
const FAMILY = {
    sans: 'DM Sans',
    serif: 'Merriweather',
    display: 'Bebas Neue',
    mono: 'JetBrains Mono',
    rounded: 'Nunito',
    condensed: 'Oswald',
    elegant: 'Playfair Display',
    hand: 'Caveat'
};

const PAGE_CSS = `
html,body{margin:0;padding:0}
body{background:#14121c;color:#e8e6f0;font:15px/1.4 system-ui,-apple-system,sans-serif}
.slot{position:relative;width:1920px;height:1080px;overflow:hidden}
body.gallery{padding:24px}
body.gallery .item{margin:0 auto 28px;width:max-content}
body.gallery .cap{margin:0 0 8px;font-weight:600;color:#b9b3d1}
body.gallery .slot{box-shadow:0 8px 30px #0008;border-radius:6px}
body.shot .cap,body.shot .notes,body.report .notes{display:none}
body.shot .item{display:none}
body.shot .item.on{display:block}
body.notext .xsc-text-inner{visibility:hidden}
/* El render va en modo editor (marcadores de vídeo): los elementos ocultos no los ve nadie, así que no se pintan */
.xsc-el--hidden{display:none}
.notes{max-width:1100px;margin:0 auto 20px;padding:12px 16px;background:#221e30;border-radius:8px}
.notes h1{font-size:18px;margin:0 0 6px}
.notes li{margin:2px 0}`;

/** Familias de letra que usa el lienzo: la del cuadro, la de cada tramo y la de las tablas. */
function familiesOf(canvases) {
    const keys = new Set(['sans']);
    for (const canvas of canvases) {
        for (const el of canvas.elements) {
            if (el.props.font) keys.add(el.props.font);
            (el.props.runs || []).forEach(run => run.font && keys.add(run.font));
        }
    }
    return [...keys].map(k => FAMILY[k]).filter(Boolean);
}

/**
 * HTML del escenario con el render de XiRo. Ese render solo admite imágenes de /uploads/ o http(s):
 * se pinta con una ruta provisional por imagen y luego se cambia por su data: URI.
 */
function stageHtml(canvas, resolve) {
    const tokens = new Map();
    const token = url => {
        if (!tokens.has(url)) tokens.set(url, `/uploads/xiro-preview-${tokens.size}.png`);
        return tokens.get(url);
    };
    const mapped = mapCanvasMedia(canvas, { image: token }).canvas;
    let html = render.stageHtml(mapped, { mode: 'editor', labels: { video: 'vídeo', localVideo: 'vídeo' } });
    for (const [url, tok] of tokens) html = html.split(tok).join(esc(resolve(url)));
    // Datos que necesita la medición del navegador (tipo, fuente y estilo de cada texto)
    for (const el of canvas.elements) {
        const p = el.props;
        const extra = ` data-type="${el.type}"` + (el.type === 'text' ? ` data-font="${p.font}" data-bold="${p.bold ? 1 : 0}" data-italic="${p.italic ? 1 : 0}"` : '');
        html = html.replace(`data-el-id="${esc(el.id)}"`, `data-el-id="${esc(el.id)}"${extra}`);
    }
    return html;
}

// Script de la página: ajuste 'shrink' igual que XiRo (fitText), medidas y modos #slide=N / #report / galería
const PAGE_JS = `
(function () {
  var FAMILY = ${JSON.stringify(FAMILY)};
  var m = /^#slide=(\\d+)(&notext)?$/.exec(location.hash);
  var mode = m ? 'shot' : location.hash === '#report' ? 'report' : 'gallery';
  document.body.className = mode + (m && m[2] ? ' notext' : '');
  var items = [].slice.call(document.querySelectorAll('.item'));
  if (m && items[+m[1]]) items[+m[1]].className += ' on';
  function fitText(root) {
    var boxes = root.querySelectorAll('.xsc-el--text[data-fit="shrink"] .xsc-text');
    for (var i = 0; i < boxes.length; i++) {
      var text = boxes[i];
      var size = parseFloat(text.getAttribute('data-size')) || 64;
      text.style.fontSize = size + 'px';
      for (var n = 0; n < 200 && size > 8 && text.scrollHeight > text.clientHeight + 1; n++) {
        size = Math.max(8, size - 2);
        text.style.fontSize = size + 'px';
      }
    }
  }
  function layout() {
    if (mode !== 'gallery') return;
    var s = Math.min(1, (window.innerWidth - 48) / 1920);
    [].forEach.call(document.querySelectorAll('.slot'), function (slot) {
      slot.style.width = 1920 * s + 'px';
      slot.style.height = 1080 * s + 'px';
      slot.querySelector('.xsc-stage').style.transform = 'scale(' + s + ')';
    });
  }
  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var jobs = [];
    Object.keys(FAMILY).forEach(function (k) {
      ['400 ', '700 ', 'italic 400 ', 'italic 700 '].forEach(function (v) {
        jobs.push(document.fonts.load(v + '40px "' + FAMILY[k] + '"', 'aá').catch(function () {}));
      });
    });
    return Promise.all(jobs);
  }
  // Palabra sola en la última línea de un párrafo partido por el navegador (los saltos puestos a mano no
  // cuentan). Con texto enriquecido cada línea es un div.xsc-p y las palabras van en varios nodos (tramos)
  function findWidows(inner, el) {
    var turned = el.style.transform;
    el.style.transform = 'none';
    var blocks = inner.querySelectorAll('.xsc-p');
    if (!blocks.length) blocks = [inner];
    var paras = {}, found = [];
    [].forEach.call(blocks, function (block, b) {
      var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null), node, nl = 0;
      while ((node = walker.nextNode())) {
        var text = node.data, re = /\\S+/g, m2;
        while ((m2 = re.exec(text))) {
          var range = document.createRange();
          range.setStart(node, m2.index);
          range.setEnd(node, m2.index + m2[0].length);
          var rects = range.getClientRects();
          if (!rects.length) continue;
          var p = b + ':' + (nl + text.slice(0, m2.index).split('\\n').length - 1);
          (paras[p] = paras[p] || []).push({ word: m2[0], top: Math.round(rects[rects.length - 1].top) });
        }
        nl += text.split('\\n').length - 1;
      }
    });
    Object.keys(paras).forEach(function (k) {
      var words = paras[k], tops = [];
      words.forEach(function (w) { if (tops.every(function (t) { return Math.abs(t - w.top) > 2; })) tops.push(w.top); });
      if (tops.length < 2) return;
      var last = Math.max.apply(null, tops);
      var onLast = words.filter(function (w) { return Math.abs(w.top - last) <= 2; });
      if (onLast.length === 1) found.push(onLast[0].word);
    });
    el.style.transform = turned;
    return found;
  }
  function measure() {
    var loaded = {};
    if (document.fonts) document.fonts.forEach(function (f) { if (f.status === 'loaded') loaded[f.family.replace(/["']/g, '')] = 1; });
    var report = { fontsMissing: [], slides: [] };
    var wanted = {};
    items.forEach(function (item) {
      var list = [];
      [].forEach.call(item.querySelectorAll('.xsc-el'), function (el) {
        var type = el.getAttribute('data-type');
        if (type === 'text') {
          var box = el.querySelector('.xsc-text');
          var inner = box.querySelector('.xsc-text-inner');
          var finalSize = parseFloat(box.style.fontSize) || parseFloat(box.getAttribute('data-size'));
          var avail = box.clientWidth - 32;
          var probe = document.createElement('span');
          probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:pre';
          box.appendChild(probe);
          var broken = [];
          (inner.innerText || inner.textContent).split(/\\s+/).forEach(function (w) {
            if (!w) return;
            probe.textContent = w;
            if (probe.offsetWidth > avail + 0.5 && broken.indexOf(w) < 0) broken.push(w);
          });
          box.removeChild(probe);
          wanted[FAMILY[el.getAttribute('data-font')]] = 1;
          var widows = findWidows(inner, el);
          var sr = item.querySelector('.xsc-stage').getBoundingClientRect();
          var br = box.getBoundingClientRect();
          var range = document.createRange();
          range.selectNodeContents(inner);
          var rects = [];
          [].forEach.call(range.getClientRects(), function (r) {
            var x0 = Math.max(r.left, br.left + 16, sr.left), y0 = Math.max(r.top, br.top + 16, sr.top);
            var x1 = Math.min(r.right, br.right - 16, sr.right), y1 = Math.min(r.bottom, br.bottom - 16, sr.bottom);
            if (x1 - x0 >= 2 && y1 - y0 >= 2) rects.push([Math.round(x0 - sr.left), Math.round(y0 - sr.top), Math.round(x1 - x0), Math.round(y1 - y0)]);
          });
          list.push({ id: el.getAttribute('data-el-id'), type: type, requested: parseFloat(box.getAttribute('data-size')),
            final: finalSize, fit: el.getAttribute('data-fit'), overflow: box.scrollHeight > box.clientHeight + 1,
            lines: Math.max(1, Math.round(inner.offsetHeight / (finalSize * 1.2))), broken: broken,
            textHeight: inner.offsetHeight, boxHeight: box.clientHeight - 32, rects: rects, widows: widows });
        } else if (type === 'image') {
          var img = el.querySelector('img');
          list.push({ id: el.getAttribute('data-el-id'), type: type, loaded: !!(img && img.complete && img.naturalWidth > 0) });
        }
      });
      report.slides.push(list);
    });
    Object.keys(wanted).forEach(function (f) { if (!loaded[f]) report.fontsMissing.push(f); });
    return report;
  }
  function done() {
    fitText(document);
    var report = measure();
    if (mode === 'report') {
      var json = JSON.stringify(report);
      document.body.innerHTML = '<pre id="xiro-report">' + btoa(unescape(encodeURIComponent(json))) + '</pre>';
    }
  }
  layout();
  window.addEventListener('resize', layout);
  fitText(document);
  window.addEventListener('load', function () { loadFonts().then(done, done); });
})();`;

/**
 * HTML de la vista previa.
 * @param {{canvases: Object[], resolve: Function, title: string, notes?: string[]}} o - resolve(url) da la URL o data: URI de cada imagen
 */
export function previewHtml({ canvases, resolve, title, notes }) {
    try {
        new Function(PAGE_JS); // eslint-disable-line no-new-func -- solo comprueba la sintaxis, no lo ejecuta
    } catch (err) {
        throw new Error(`el script de la vista previa tiene un error de sintaxis: ${err.message}`);
    }
    const list = notes && notes.length ? `<div class="notes"><h1>Avisos</h1><ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : '';
    const slides = canvases
        .map((c, i) => `<section class="item"><div class="cap">Diapositiva ${i + 1}</div><div class="slot">${stageHtml(c, resolve)}</div></section>`)
        .join('\n');
    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vista previa · ${esc(title)}</title>
<style>${fontsCss(familiesOf(canvases))}</style>
<style>${canvasCss()}${PAGE_CSS}</style></head>
<body class="gallery">
${list}
${slides}
<script>${PAGE_JS}</script>
</body></html>`;
}

/** Ejecutable de Chrome, Chromium, Edge o Brave (CHROME_PATH manda), o null. */
export function findChrome() {
    if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    const home = os.homedir();
    const mac = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ];
    if (process.platform === 'darwin') return mac.find(p => existsSync(p)) || null;
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
        const r = spawnSync('which', [name], { encoding: 'utf8' });
        if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
    }
    return null;
}

function chrome(binary, profile, args) {
    const base = [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-sync',
        '--use-mock-keychain',
        '--password-store=basic',
        '--mute-audio',
        `--user-data-dir=${profile}`,
        '--window-size=1920,1080',
        '--virtual-time-budget=20000',
        '--run-all-compositor-stages-before-draw'
    ];
    return spawnSync(binary, [...base, ...args], { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Contraste medido de verdad: compara el color de cada texto con los píxeles que tiene debajo en la
 * captura sin textos (peor 10 % y mediana), así vale también para texto sobre fotos o degradados.
 */
function measureContrast(report, bgPngs, canvases) {
    const results = [];
    report.slides.forEach((list, i) => {
        if (!bgPngs[i]) return;
        let png;
        try {
            png = readPng(bgPngs[i]);
        } catch {
            png = null;
        }
        if (!png) return;
        list.forEach(r => {
            if (r.type !== 'text' || !r.rects || !r.rects.length) return;
            const el = canvases[i].elements.find(e => e.id === r.id);
            if (!el || !el.props.text.trim()) return;
            const fg = rgba(el.props.color);
            const values = [];
            for (const [x, y, w, h] of r.rects) {
                const step = Math.max(2, Math.round(Math.sqrt((w * h) / 4000)));
                for (let yy = y; yy < Math.min(y + h, png.height); yy += step) {
                    for (let xx = x; xx < Math.min(x + w, png.width); xx += step) {
                        const bg = pixel(png, xx, yy);
                        values.push(contrast(over(fg, bg), bg));
                    }
                }
            }
            if (!values.length) return;
            values.sort((a, b) => a - b);
            results.push({
                slide: i,
                id: r.id,
                worst: values[Math.floor(values.length * 0.1)],
                median: values[Math.floor(values.length / 2)],
                min: minContrast(el.props)
            });
        });
    });
    return results;
}

/** Avisos legibles a partir de las medidas del navegador. */
export function reportWarnings(result, canvases) {
    const out = [];
    const report = result && result.report;
    if (!report) return out;
    if (report.fontsMissing.length) {
        out.push(`no se cargaron las fuentes ${report.fontsMissing.join(', ')} (¿sin internet?): medidas aproximadas`);
    }
    const label = (i, id) => elementLabel(i, canvases[i].elements.find(e => e.id === id));
    report.slides.forEach((list, i) => {
        list.forEach(r => {
            const where = label(i, r.id);
            if (r.type === 'image' && !r.loaded) out.push(`${where}: la imagen no se pudo pintar (¿SVG mal formado?)`);
            if (r.type !== 'text') return;
            if (r.fit === 'shrink' && r.final < r.requested) {
                out.push(`${where}: la letra baja de ${r.requested} a ${r.final} px para caber; agranda la caja o acorta el texto`);
            }
            if (r.overflow) out.push(`${where}: el texto no cabe en la caja y se corta`);
            if (r.broken.length) out.push(`${where}: no cabe en el ancho y se parte la palabra «${r.broken[0]}»`);
            if (r.widows && r.widows.length && !r.broken.length) {
                out.push(`${where}: queda «${r.widows[0]}» sola en la última línea; parte la línea con \\n donde suene natural, ajusta el ancho o acorta el texto`);
            }
        });
    });
    report.slides.forEach((list, i) => {
        const texts = list.filter(r => r.type === 'text' && r.rects && r.rects.length);
        for (let a = 0; a < texts.length; a++) {
            for (let b = a + 1; b < texts.length; b++) {
                const hit = texts[a].rects.some(([x1, y1, w1, h1]) =>
                    texts[b].rects.some(([x2, y2, w2, h2]) => Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2) > 8 && Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2) > 8)
                );
                if (hit) out.push(`${label(i, texts[a].id)}: sus líneas se montan con las de ${label(i, texts[b].id).split(' · ')[1]}`);
            }
        }
    });
    (result.contrast || []).forEach(c => {
        if (c.worst >= c.min) return;
        const median = c.median >= c.min ? `; la mediana ${c.median.toFixed(1)}:1 sí llega, así que hay zonas del fondo que lo estropean` : '';
        out.push(`${label(c.slide, c.id)}: contraste real ${c.worst.toFixed(1)}:1 en el peor 10 % del texto (mínimo ${c.min}:1)${median}`);
    });
    return out;
}

/**
 * Escribe index.html y, si hay Chrome, slide-N.png, las medidas de cada texto y su contraste real.
 * @returns {{htmlPath: string, pngs: string[], report: Object|null, contrast: Object[]|null, chrome: string|null}}
 */
export function renderPreview({ html, outDir, slideCount, canvases }) {
    mkdirSync(outDir, { recursive: true });
    // Fuera las capturas de una construcción anterior (pudo tener más diapositivas)
    readdirSync(outDir)
        .filter(f => /^slide-\d+\.png$/.test(f))
        .forEach(f => rmSync(path.join(outDir, f), { force: true }));
    const htmlPath = path.join(outDir, 'index.html');
    writeFileSync(htmlPath, html);
    const binary = findChrome();
    if (!binary) return { htmlPath, pngs: [], report: null, contrast: null, chrome: null };
    const profile = mkdtempSync(path.join(os.tmpdir(), 'xiroslide-chrome-'));
    try {
        const url = pathToFileURL(htmlPath).href;
        const dump = chrome(binary, profile, ['--dump-dom', `${url}#report`]);
        const match = /<pre id="xiro-report">([A-Za-z0-9+/=]*)<\/pre>/.exec(dump.stdout || '');
        const report = match ? JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')) : null;
        const pngs = [];
        const bgPngs = [];
        for (let i = 0; i < slideCount; i++) {
            const png = path.join(outDir, `slide-${i + 1}.png`);
            chrome(binary, profile, [`--screenshot=${png}`, `${url}#slide=${i}`]);
            if (existsSync(png)) pngs.push(png);
            const bg = path.join(profile, `bg-${i + 1}.png`);
            if (report) chrome(binary, profile, [`--screenshot=${bg}`, `${url}#slide=${i}&notext`]);
            bgPngs.push(existsSync(bg) ? bg : null);
        }
        const contrastResults = report ? measureContrast(report, bgPngs, canvases) : null;
        return { htmlPath, pngs, report, contrast: contrastResults, chrome: binary };
    } finally {
        rmSync(profile, { recursive: true, force: true });
    }
}
