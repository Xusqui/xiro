/**
 * @fileoverview Melodía compuesta a partir de un MOTIVO de 2 compases que se expone,
 * se secuencia, se varía y cadencia (como un tema de televisión), más la respuesta
 * de las campanas en las notas largas. Pasos de semicorchea y grados de la escala.
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.melody).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(module.require('./music-theory.js'));
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.melody = factory(root.XiroMusic.theory);
    }
})(typeof self !== 'undefined' ? self : this, function (theory) {
    'use strict';

    const BAR = theory.STEPS_PER_BAR;

    // Ritmos de motivo de 2 compases [paso, duración]: largos con anacrusa, de fanfarria
    const MOTIF_RHYTHMS = [
        [[0, 6], [6, 2], [8, 8], [16, 4], [20, 4], [24, 8]],
        [[0, 4], [4, 4], [8, 6], [14, 2], [16, 12], [28, 4]],
        [[0, 2], [2, 2], [4, 12], [16, 6], [22, 2], [24, 8]],
        [[0, 3], [3, 3], [6, 2], [8, 8], [16, 8], [26, 6]]
    ];
    const STEP_WEIGHTS = [1, 4, 1, 3, 1]; // -2, -1, 0, +1, +2: tras el salto, se baja por grados

    /** Motivo: ritmo + contorno relativo. Abre con salto de 4ª/5ª (grados +3/+4) como un metal. */
    function generateMotif(rng) {
        const rhythm = rng.pick(MOTIF_RHYTHMS);
        const rel = [0];
        for (let i = 1; i < rhythm.length; i++) {
            if (i === 1) rel.push(rng.chance(0.65) ? rng.pick([3, 4]) : 1);
            else rel.push(Math.max(-3, Math.min(6, rel[i - 1] + rng.weightedIndex(STEP_WEIGHTS) - 2)));
        }
        return { rhythm: rhythm, rel: rel };
    }

    function nearestChordTone(degree, chord) {
        for (let dist = 0; dist <= 3; dist++) {
            if (theory.isChordTone(degree - dist, chord.d, chord.k)) return degree - dist;
            if (theory.isChordTone(degree + dist, chord.d, chord.k)) return degree + dist;
        }
        return degree;
    }

    function clampOctave(degree, range) {
        let d = degree;
        while (d > range[1]) d -= 7;
        while (d < range[0]) d += 7;
        return d;
    }

    /** Desplaza la base por octavas para que el contorno entero quepa en el registro. */
    function fitBase(base, rel, range) {
        let b = base;
        const max = Math.max.apply(null, rel);
        const min = Math.min.apply(null, rel);
        while (b + max > range[1] && b + min - 7 >= range[0]) b -= 7;
        while (b + min < range[0] && b + max + 7 <= range[1]) b += 7;
        return b;
    }

    /** Coloca el motivo desde `startBar`; los tiempos fuertes caen en nota del acorde. */
    function realize(motif, chords, startBar, base, range) {
        const b = fitBase(base, motif.rel, range);
        return motif.rhythm.map(function (slot, i) {
            const bar = startBar + Math.floor(slot[0] / BAR);
            let degree = b + motif.rel[i];
            if (slot[0] % 8 === 0) degree = nearestChordTone(degree, chords[bar]);
            return { step: startBar * BAR + slot[0], len: slot[1], degree: clampOctave(degree, range) };
        });
    }

    /** Variación: parte la primera nota larga en dos (la segunda, bordadura superior). */
    function varyMotif(rng, motif) {
        const rhythm = motif.rhythm.map(function (s) { return [s[0], s[1]]; });
        const rel = motif.rel.slice();
        const idx = rhythm.findIndex(function (s) { return s[1] >= 8; });
        if (idx >= 0 && rng.chance(0.6)) {
            const half = rhythm[idx][1] / 2;
            rhythm.splice(idx, 1, [rhythm[idx][0], half], [rhythm[idx][0] + half, half]);
            rel.splice(idx + 1, 0, rel[idx] + 1);
        }
        return { rhythm: rhythm, rel: rel };
    }

    function headOf(motif, notes) {
        return { rhythm: motif.rhythm.slice(0, notes), rel: motif.rel.slice(0, notes) };
    }

    /**
     * Frase de 8 compases: motivo (1-2), secuencia (3-4), motivo variado (5-6) y
     * cadencia (7-8) en la fundamental del último acorde. `variantRng` cambia los
     * detalles de cada aparición sin perder el tema.
     */
    function buildThemePhrase(motif, chords, range, base, variantRng) {
        let shift = chords[2].d - chords[0].d;
        if (shift === 0) shift = variantRng.pick([2, -1]);
        const first = realize(motif, chords, 0, base, range);
        const sequence = realize(motif, chords, 2, base + shift, range);
        const varied = realize(varyMotif(variantRng, motif), chords, 4, base, range);
        const head = realize(motif, chords, 6, base, range).filter(function (n) { return n.step < 6 * BAR + 8; });
        const near = head.length ? head[head.length - 1].degree : base;
        const ending = clampOctave(nearestChordTone(near, { d: chords[7].d, k: 'triad' }), range);
        return first.concat(sequence, varied, head, [{ step: 7 * BAR, len: BAR, degree: ending }]);
    }

    /** Respiro: solo la cabeza del motivo (3 notas) en los compases 1 y 5, con aire. */
    function buildFragmentPhrase(motif, chords, range, base) {
        const head = headOf(motif, 3);
        return realize(head, chords, 0, base, range).concat(realize(head, chords, 4, base + 2, range));
    }

    /** Melodía sin motivo (paseo aleatorio por grados): solo para comparar A/B en el panel. */
    function buildRandomPhrase(rng, chords, range, base) {
        const notes = [];
        let degree = base;
        chords.forEach(function (chord, bar) {
            rng.pick(MOTIF_RHYTHMS).forEach(function (slot) {
                if (slot[0] >= BAR) return;
                const moved = degree + rng.int(-2, 2);
                degree = clampOctave(slot[0] % 8 === 0 ? nearestChordTone(moved, chord) : moved, range);
                notes.push({ step: bar * BAR + slot[0], len: slot[1], degree: degree });
            });
        });
        return notes;
    }

    /**
     * Respuesta de campanas: en cada nota larga de la melodía, tres notas que bajan
     * por grados hacia la nota sostenida una octava arriba (pregunta-respuesta).
     */
    function buildResponse(melodyNotes, range) {
        const out = [];
        melodyNotes.forEach(function (n) {
            if (n.len < 8) return;
            const start = n.step + n.len - 6;
            if (Math.floor(start / BAR) !== Math.floor(n.step / BAR)) return;
            [2, 1, 0].forEach(function (offset, i) {
                out.push({ step: start + i * 2, len: 2, degree: clampOctave(n.degree + 7 + offset, range) });
            });
        });
        return out;
    }

    return { MOTIF_RHYTHMS, generateMotif, buildThemePhrase, buildFragmentPhrase, buildRandomPhrase, buildResponse };
});
