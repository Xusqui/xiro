'use strict';

/**
 * @fileoverview Prompt de la canción con IA (pestaña «Música» del admin). La IA solo devuelve lo que
 * entiende el motor de XiRo: tónica, modo, tempo, un acorde por compás y un motivo melódico corto.
 * Las variaciones, la tensión y el acompañamiento los genera el motor, no el modelo.
 * El prompt va en inglés y pide evocar el estilo con rasgos musicales, nunca copiar una melodía.
 */

const theory = require('../../public/js/audio/music-theory.js');
const motifModule = require('../../public/js/audio/music-motif.js');

const QUALITIES = Object.keys(theory.QUALITIES).join(', ');
const { minNotes, maxNotes, minDegree, maxDegree } = motifModule.LIMITS;

const EXAMPLE = JSON.stringify({
    title: 'Dusty Ruins',
    tempo: 124,
    tonic: 9,
    mode: 'minor',
    chords: [
        { bar: 1, root: 9, quality: 'min' },
        { bar: 3, root: 5, quality: 'maj7' },
        { bar: 5, root: 0, quality: 'maj' },
        { bar: 7, root: 7, quality: 'dom7' }
    ],
    motif: { rhythm: [[0, 6], [6, 2], [8, 8], [16, 4], [20, 4], [24, 8]], rel: [0, 3, 2, 1, 2, 0] }
});

const SYSTEM_PROMPT = `You are a composer for a quiz game. You write the harmonic skeleton and a short theme for one original piece.
Reply with ONE JSON object only, no markdown and no comments, with these keys:
- "title": string, at most 40 characters.
- "tempo": integer from 80 to 140 (beats per minute).
- "tonic": integer 0-11, the key note as a pitch class (C=0, C#=1, D=2, ... B=11).
- "mode": "major" or "minor".
- "chords": the 8-bar progression as an array of {"bar", "root", "quality"}. The first chord enters at bar 1, "bar" values (1 to 8) strictly increase, and a chord lasts until the next one enters. Use 2 to 8 chords. "root" is 0-11 like "tonic". "quality" is one of: ${QUALITIES}.
- "motif": the theme, ${minNotes} to ${maxNotes} notes spanning at most 2 bars. A bar has 16 sixteenth-note steps, so steps run from 0 to 31 (strong beats at 0, 8, 16, 24). "rhythm" is an array of [start, length] pairs in steps: starts strictly increase, notes never overlap and start + length stays within 32. "rel" is one integer per note, the scale-step offset from the first note (+1 is the next note up in the scale), from ${minDegree} to ${maxDegree}, and "rel"[0] must be 0. Favor stepwise motion with a leap or two, and a singable contour.

Style: EVOKE the requested style through its traits: tempo, harmony, rhythm, melodic intervals and character. Never quote, reproduce or copy an existing melody; the theme must be original.

Example of a valid reply:
${EXAMPLE}`;

/**
 * Prompt de usuario con la petición del admin.
 * @param {string} request - Descripción libre del tema (p. ej. «música de misterio»)
 * @returns {string}
 */
function buildMusicSongPrompt(request) {
    return `Request from the user: ${request}\nCompose the piece now and reply with the JSON object only.`;
}

/**
 * Prompt de un reintento: la petición y el motivo por el que se rechazó la respuesta anterior.
 * @param {string} request
 * @param {string} problem
 * @returns {string}
 */
function buildRetryPrompt(request, problem) {
    return `${buildMusicSongPrompt(request)}\nYour previous reply was rejected: ${problem}\nFix it and reply with the corrected JSON object only.`;
}

module.exports = { SYSTEM_PROMPT, buildMusicSongPrompt, buildRetryPrompt };
