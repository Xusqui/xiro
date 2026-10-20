/**
 * @fileoverview Entidades HTML con nombre más habituales en textos en español y
 * otros idiomas europeos. Las letras acentuadas se generan por composición
 * Unicode (á = a + U+0301) en lugar de listarlas una a una.
 */

'use strict';

const MARKS = { acute: '́', grave: '̀', circ: '̂', uml: '̈', tilde: '̃', cedil: '̧', ring: '̊' };
const LETTERS = 'aeiouyncAEIOUYNC';

const HTML_ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: '\'',
    nbsp: ' ',
    ensp: ' ',
    emsp: ' ',
    thinsp: ' ',
    shy: '',
    zwnj: '',
    zwj: '',
    iexcl: '¡',
    iquest: '¿',
    laquo: '«',
    raquo: '»',
    lsaquo: '‹',
    rsaquo: '›',
    lsquo: '‘',
    rsquo: '’',
    sbquo: '‚',
    ldquo: '“',
    rdquo: '”',
    bdquo: '„',
    ndash: '–',
    mdash: '—',
    hellip: '…',
    bull: '•',
    middot: '·',
    prime: '′',
    Prime: '″',
    ordm: 'º',
    ordf: 'ª',
    deg: '°',
    sect: '§',
    para: '¶',
    copy: '©',
    reg: '®',
    trade: '™',
    euro: '€',
    pound: '£',
    yen: '¥',
    cent: '¢',
    dollar: '$',
    percnt: '%',
    permil: '‰',
    times: '×',
    divide: '÷',
    plusmn: '±',
    minus: '−',
    le: '≤',
    ge: '≥',
    ne: '≠',
    asymp: '≈',
    infin: '∞',
    frac12: '½',
    frac14: '¼',
    frac34: '¾',
    sup1: '¹',
    sup2: '²',
    sup3: '³',
    micro: 'µ',
    szlig: 'ß',
    aelig: 'æ',
    AElig: 'Æ',
    oslash: 'ø',
    Oslash: 'Ø',
    oelig: 'œ',
    OElig: 'Œ',
    alpha: 'α',
    beta: 'β',
    gamma: 'γ',
    delta: 'δ',
    pi: 'π',
    sigma: 'σ',
    omega: 'ω',
    mu: 'μ',
    larr: '←',
    rarr: '→',
    uarr: '↑',
    darr: '↓',
    harr: '↔'
};

for (const letter of LETTERS) {
    for (const [name, mark] of Object.entries(MARKS)) {
        const composed = (letter + mark).normalize('NFC');
        if (composed.length === 1) HTML_ENTITIES[letter + name] = composed;
    }
}

module.exports = { HTML_ENTITIES };
