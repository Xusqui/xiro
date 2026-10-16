/**
 * @fileoverview Melodía generativa basada en un MOTIVO de 2 compases:
 * exposición, secuencia, variación y cadencia. Las campanas responden a las
 * notas largas para crear una identidad reconocible de música de videojuego.
 *
 * Pasos de semicorchea y grados de escala.
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

    // Ritmos de 2 compases: anacrusas, síncopas y notas largas para la fanfarria.
    const MOTIF_RHYTHMS = [
        [[0, 6], [6, 2], [8, 8], [16, 4], [20, 4], [24, 8]],
        [[0, 4], [4, 4], [8, 6], [14, 2], [16, 12], [28, 4]],
        [[0, 2], [2, 2], [4, 12], [16, 6], [22, 2], [24, 8]],
        [[0, 3], [3, 3], [6, 2], [8, 8], [16, 8], [26, 6]]
    ];

    // Probabilidades de movimiento: -2, -1, 0, +1, +2 grados.
    // Predomina el movimiento conjunto para facilitar la memorización.
    const STEP_WEIGHTS = [1, 4, 2, 4, 1];

    /**
     * Genera un motivo con salto inicial expresivo y continuación conjunta.
     * El contorno se mantiene acotado para conservar una identidad reconocible.
     */
    function generateMotif(rng) {
        const rhythm = rng.pick(MOTIF_RHYTHMS);
        const rel = [0];
        for (let i = 1; i < rhythm.length; i++) {
            // Salto de cuarta o quinta, característico de una fanfarria.
            if (i === 1) {
                rel.push(rng.chance(0.7) ? rng.pick([3, 4]) : 1);
                continue;
            }
            // Evita saltos extremos y mantiene un contorno cantable.
            const next = rel[i - 1] + rng.weightedIndex(STEP_WEIGHTS) - 2;
            rel.push(Math.max(-3, Math.min(6, next)));
        }
        return { rhythm: rhythm, rel: rel };
    }

    /**
     * Busca la nota de acorde más cercana.
     * En caso de empate, favorece la dirección melódica indicada:
     * -1 = descendente, +1 = ascendente, 0 = descendente por defecto.
     */
    function nearestChordTone(degree, chord, direction) {
        for (let dist = 0; dist <= 3; dist++) {
            const lower = degree - dist;
            const upper = degree + dist;
            const lowerIsChordTone = theory.isChordTone(lower, chord.d, chord.k);
            const upperIsChordTone = theory.isChordTone(upper, chord.d, chord.k);
            if (dist === 0 && lowerIsChordTone) return degree;
            if (lowerIsChordTone && upperIsChordTone) return direction > 0 ? upper : lower;
            if (lowerIsChordTone) return lower;
            if (upperIsChordTone) return upper;
        }
        return degree;
    }

    /**
     * Pliega una nota por octavas dentro del registro.
     * Si el registro no contiene ninguna octava equivalente, devuelve
     * el límite más cercano en vez de entrar en un bucle infinito.
     */
    function clampOctave(degree, range) {
        const low = range[0];
        const high = range[1];
        if (low > high) return degree;
        const minOctave = Math.ceil((low - degree) / 7);
        const maxOctave = Math.floor((high - degree) / 7);
        // Conserva la octava original siempre que sea posible.
        if (minOctave <= maxOctave) return degree + Math.max(minOctave, Math.min(maxOctave, 0)) * 7;
        // Registro demasiado estrecho: evita alternar indefinidamente.
        return Math.max(low, Math.min(high, degree));
    }

    /**
     * Desplaza la base por octavas para encajar el contorno completo.
     * Si no cabe, busca la posición que minimiza el desplazamiento del centro.
     */
    function fitBase(base, rel, range) {
        if (!rel.length || range[0] > range[1]) return base;
        const min = Math.min.apply(null, rel);
        const max = Math.max.apply(null, rel);
        const minShift = Math.ceil((range[0] - (base + min)) / 7);
        const maxShift = Math.floor((range[1] - (base + max)) / 7);
        if (minShift <= maxShift) return base + Math.max(minShift, Math.min(maxShift, 0)) * 7;
        const center = base + (min + max) / 2;
        const target = (range[0] + range[1]) / 2;
        return base + Math.round((target - center) / 7) * 7;
    }

    /**
     * Realiza el motivo sobre la progresión.
     * En los tiempos fuertes prioriza las notas del acorde correspondiente.
     */
    function realize(motif, chords, startBar, base, range) {
        const b = fitBase(base, motif.rel, range);
        let previousDegree = b;
        return motif.rhythm.map(function (slot, i) {
            const bar = startBar + Math.floor(slot[0] / BAR);
            let degree = b + motif.rel[i];
            if (slot[0] % 8 === 0 && chords[bar]) {
                degree = nearestChordTone(degree, chords[bar], Math.sign(degree - previousDegree));
            }
            degree = clampOctave(degree, range);
            previousDegree = degree;
            return { step: startBar * BAR + slot[0], len: slot[1], degree: degree };
        });
    }

    /**
     * Variación ornamental:
     * divide una nota larga en dos y añade una bordadura superior.
     */
    function varyMotif(rng, motif) {
        const rhythm = motif.rhythm.map(function (slot) { return [slot[0], slot[1]]; });
        const rel = motif.rel.slice();
        const candidates = [];
        rhythm.forEach(function (slot, i) {
            if (slot[1] >= 8) candidates.push(i);
        });
        if (candidates.length && rng.chance(0.6)) {
            const idx = rng.pick(candidates);
            const start = rhythm[idx][0];
            const half = rhythm[idx][1] / 2;
            rhythm.splice(idx, 1, [start, half], [start + half, half]);
            // Bordadura: el motivo sigue siendo reconocible.
            rel.splice(idx + 1, 0, rel[idx] + 1);
        }
        return { rhythm: rhythm, rel: rel };
    }

    function headOf(motif, notes) {
        return { rhythm: motif.rhythm.slice(0, notes), rel: motif.rel.slice(0, notes) };
    }

    /**
     * Frase de 8 compases:
     * 1-2: exposición
     * 3-4: secuencia transpuesta
     * 5-6: variación ornamental
     * 7: retorno del motivo
     * 8: nota de cierre en la fundamental del último acorde
     */
    function buildThemePhrase(motif, chords, range, base, variantRng) {
        // Usa el desplazamiento diatónico más corto para evitar secuencias
        // excesivamente alejadas del registro y del centro tonal.
        let shift = chords[2].d - chords[0].d;
        shift = ((shift + 3) % 7 + 7) % 7 - 3;
        if (shift === 0) shift = variantRng.pick([1, -1, 2, -2]);
        const first = realize(motif, chords, 0, base, range);
        const sequence = realize(motif, chords, 2, base + shift, range);
        const varied = realize(varyMotif(variantRng, motif), chords, 4, base, range);
        const head = realize(motif, chords, 6, base, range).filter(function (note) {
            return note.step < 6 * BAR + 8;
        });
        // La cadencia utiliza realmente la fundamental del acorde final.
        const ending = { step: 7 * BAR, len: BAR, degree: clampOctave(chords[7].d, range) };
        return first.concat(sequence, varied, head, [ending]);
    }

    /**
     * Frase de respiro: tres notas del motivo en los compases 1 y 5.
     * Útil para transiciones, pantallas de espera o pausas entre preguntas.
     */
    function buildFragmentPhrase(motif, chords, range, base) {
        const head = headOf(motif, 3);
        return realize(head, chords, 0, base, range).concat(realize(head, chords, 4, base + 2, range));
    }

    /**
     * Melodía alternativa aleatoria para comparar con el tema principal.
     * Cada compás usa la primera mitad de un patrón rítmico de dos compases.
     */
    function buildRandomPhrase(rng, chords, range, base) {
        const notes = [];
        let degree = base;
        chords.forEach(function (chord, bar) {
            rng.pick(MOTIF_RHYTHMS).forEach(function (slot) {
                if (slot[0] >= BAR) return;
                const moved = degree + rng.int(-2, 2);
                degree = slot[0] % 8 === 0 ? nearestChordTone(moved, chord, Math.sign(moved - degree)) : moved;
                degree = clampOctave(degree, range);
                notes.push({ step: bar * BAR + slot[0], len: Math.min(slot[1], BAR - slot[0]), degree: degree });
            });
        });
        return notes;
    }

    /**
     * Respuesta de campanas en las notas largas.
     * Genera tres notas descendentes una octava por encima de la melodía.
     *
     * `chords` es opcional para mantener la compatibilidad con las llamadas
     * existentes: buildResponse(melodyNotes, range).
     *
     * Si se proporciona, se usa la armonía del compás para escoger notas
     * compatibles con el acorde sin modificar el ritmo de la respuesta.
     */
    function buildResponse(melodyNotes, range, chords) {
        const out = [];
        melodyNotes.forEach(function (note) {
            if (note.len < 8) return;
            const start = note.step + note.len - 6;
            // No generar respuestas que atraviesen el límite del compás.
            if (Math.floor(start / BAR) !== Math.floor(note.step / BAR)) return;
            const chord = chords && chords[Math.floor(note.step / BAR)];
            [2, 1, 0].forEach(function (offset, i) {
                let degree = note.degree + 7 + offset;
                if (chord) degree = nearestChordTone(degree, chord, -1);
                out.push({ step: start + i * 2, len: 2, degree: clampOctave(degree, range) });
            });
        });
        return out;
    }

    return {
        MOTIF_RHYTHMS,
        generateMotif,
        buildThemePhrase,
        buildFragmentPhrase,
        buildRandomPhrase,
        buildResponse
    };
});
