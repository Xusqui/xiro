/**
 * @fileoverview Parser XML mínimo para los formatos ofimáticos (OOXML, ODF, EPUB).
 * Construye un árbol { name, attrs, children } donde los nodos de texto son strings.
 *
 * Seguridad: nunca procesa la DTD ni entidades declaradas (inmune a XXE y a
 * «billion laughs»); solo resuelve las cinco entidades predefinidas y las
 * referencias numéricas. La profundidad está acotada.
 */

'use strict';

const PREDEFINED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' };
const MAX_DEPTH = 1000;

/**
 * Sustituye referencias de entidad (&amp; &#225; &#xE1; y las de `named`).
 * Las entidades desconocidas se dejan tal cual.
 * @param {string} str
 * @param {Object<string,string>} [named]
 * @returns {string}
 */
function decodeEntities(str, named = PREDEFINED) {
    if (str.indexOf('&') === -1) return str;
    return str.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, ref) => {
        if (ref[0] === '#') {
            const hex = ref[1] === 'x' || ref[1] === 'X';
            const code = hex ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
            return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
        }
        const value = named[ref] !== undefined ? named[ref] : named[ref.toLowerCase()];
        return value !== undefined ? value : match;
    });
}

function parseAttrs(src) {
    const attrs = {};
    const re = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        attrs[m[1]] = decodeEntities(m[2] !== undefined ? m[2] : m[3]);
    }
    return attrs;
}

/** Fin de una etiqueta respetando comillas en los atributos. */
function findTagEnd(xml, from) {
    let quote = null;
    for (let i = from + 1; i < xml.length; i++) {
        const ch = xml[i];
        if (quote) {
            if (ch === quote) quote = null;
        } else if (ch === '"' || ch === '\'') {
            quote = ch;
        } else if (ch === '>') {
            return i;
        }
    }
    return xml.length;
}

/** Salta <!DOCTYPE …> incluido un subconjunto interno [ … ] sin interpretarlo. */
function skipDeclaration(xml, from) {
    let depth = 0;
    for (let i = from + 2; i < xml.length; i++) {
        const ch = xml[i];
        if (ch === '[') depth++;
        else if (ch === ']') depth--;
        else if (ch === '>' && depth <= 0) return i + 1;
    }
    return xml.length;
}

function skipTo(xml, token, from) {
    const end = xml.indexOf(token, from);
    return end === -1 ? xml.length : end + token.length;
}

function top(stack) {
    return stack[stack.length - 1];
}

function pushText(stack, raw) {
    if (raw) top(stack).children.push(decodeEntities(raw));
}

function openTag(stack, body) {
    const selfClosing = body.endsWith('/');
    const src = selfClosing ? body.slice(0, -1) : body;
    const nameEnd = src.search(/\s/);
    const name = nameEnd === -1 ? src : src.slice(0, nameEnd);
    const node = { name, attrs: nameEnd === -1 ? {} : parseAttrs(src.slice(nameEnd)), children: [] };
    top(stack).children.push(node);
    if (!selfClosing) {
        if (stack.length > MAX_DEPTH) throw new Error('Documento XML demasiado anidado');
        stack.push(node);
    }
}

function closeTag(stack, name) {
    // Tolerante: cierra hasta la etiqueta que coincide; un cierre huérfano se ignora
    for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].name === name) {
            stack.length = i;
            return;
        }
    }
}

function parseMarkup(xml, lt, stack) {
    if (xml.startsWith('<!--', lt)) return skipTo(xml, '-->', lt);
    if (xml.startsWith('<![CDATA[', lt)) {
        const end = xml.indexOf(']]>', lt);
        const stop = end === -1 ? xml.length : end;
        top(stack).children.push(xml.slice(lt + 9, stop));
        return stop + 3;
    }
    if (xml.startsWith('<?', lt)) return skipTo(xml, '?>', lt);
    if (xml.startsWith('<!', lt)) return skipDeclaration(xml, lt);
    const gt = findTagEnd(xml, lt);
    const body = xml.slice(lt + 1, gt).trim();
    if (body[0] === '/') closeTag(stack, body.slice(1).trim());
    else if (body) openTag(stack, body);
    return gt + 1;
}

/**
 * @param {string} xml
 * @returns {{name: string, attrs: Object, children: Array}} nodo raíz '#root'
 */
function parseXml(xml) {
    const root = { name: '#root', attrs: {}, children: [] };
    const stack = [root];
    let pos = 0;
    while (pos < xml.length) {
        const lt = xml.indexOf('<', pos);
        if (lt === -1) {
            pushText(stack, xml.slice(pos));
            break;
        }
        if (lt > pos) pushText(stack, xml.slice(pos, lt));
        pos = parseMarkup(xml, lt, stack);
    }
    return root;
}

/** Hijos elemento (opcionalmente filtrados por nombre). */
function elements(node, name) {
    return node.children.filter(c => typeof c !== 'string' && (!name || c.name === name));
}

/** Primer hijo directo con ese nombre. */
function child(node, name) {
    return node.children.find(c => typeof c !== 'string' && c.name === name) || null;
}

/** Primer descendiente (en profundidad) con ese nombre. */
function findFirst(node, name) {
    for (const c of node.children) {
        if (typeof c === 'string') continue;
        if (c.name === name) return c;
        const found = findFirst(c, name);
        if (found) return found;
    }
    return null;
}

/** Todos los descendientes con ese nombre, en orden de documento. */
function findAll(node, name, out = []) {
    for (const c of node.children) {
        if (typeof c === 'string') continue;
        if (c.name === name) out.push(c);
        findAll(c, name, out);
    }
    return out;
}

/** Texto concatenado de todo el subárbol. */
function textOf(node) {
    if (typeof node === 'string') return node;
    return node.children.map(textOf).join('');
}

module.exports = { parseXml, decodeEntities, elements, child, findFirst, findAll, textOf };
