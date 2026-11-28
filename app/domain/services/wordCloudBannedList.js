/**
 * @fileoverview Lista base de palabras prohibidas de «Nube de palabras», una por idioma de la
 * app. Cada entrada ya está normalizada como clave de agrupado (minúsculas, sin tildes ni
 * signos; la ñ se conserva). Se evitan a propósito las palabras que en otro idioma o contexto
 * son corrientes (p. ej. «pute» es «pavo» en alemán, «dick» es Moby Dick): para eso está el
 * ocultar a mano del presentador. Ampliar la lista no exige tocar nada más.
 */

'use strict';

const BANNED_BY_LANGUAGE = Object.freeze({
    ca: ['merda', 'puta', 'cony', 'collons', 'cabro', 'gilipolles', 'follar'],
    de: [
        'scheiße',
        'scheisse',
        'scheiß',
        'arschloch',
        'fotze',
        'wichser',
        'hurensohn',
        'schlampe',
        'ficken',
        'schwuchtel'
    ],
    en: [
        'fuck',
        'fucker',
        'fucking',
        'shit',
        'bitch',
        'asshole',
        'bastard',
        'cunt',
        'pussy',
        'slut',
        'whore',
        'nigger',
        'faggot'
    ],
    es: [
        'puta',
        'puto',
        'mierda',
        'cabron',
        'cabrona',
        'gilipollas',
        'joder',
        'coño',
        'follar',
        'pendejo',
        'culero',
        'zorra',
        'maricon',
        'hijoputa',
        'capullo'
    ],
    eu: ['madarikatu', 'putakume', 'puta', 'kabroi', 'zakila'],
    fr: ['merde', 'putain', 'connard', 'connasse', 'salope', 'encule', 'couille', 'couilles', 'niquer', 'batard'],
    gl: ['carallo', 'merda', 'puta', 'cona', 'cabron', 'foder'],
    ja: ['くそ', 'クソ', '死ね', 'しね', 'ちんこ', 'まんこ', 'ファック'],
    pt: ['caralho', 'merda', 'puta', 'foda', 'foder', 'buceta', 'viado', 'vadia', 'cacete', 'filhodaputa'],
    zh: ['他妈的', '妈的', '傻逼', '草泥马', '狗屎', '婊子', '王八蛋']
});

module.exports = { BANNED_BY_LANGUAGE };
