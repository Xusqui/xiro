/**
 * @fileoverview Escenas de espera en bucle (marcador, tablero del Trivial, podio) y el
 * final del podio: planes de sección en la tonalidad del lobby, sin subidas.
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.loops). En el navegador
 * depende de prng, theory y arrangement (en ese orden).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        const req = module.require.bind(module);
        module.exports = factory(req('./music-prng.js'), req('./music-theory.js'), req('./music-arrangement.js'));
    } else {
        const m = root.XiroMusic;
        m.loops = factory(m.prng, m.theory, m.arrangement);
    }
})(typeof self !== 'undefined' ? self : this, function (prng, theory, arrangement) {
    'use strict';

    /*
     * Escenas de espera en bucle, en la tonalidad del lobby y sin subidas:
     * marcador (versión ligera del tema: fragmentos del motivo A, campanas, piano partido,
     * batería suave) y tablero del Trivial (espera tranquila: pad, piano, campanas y bajo pedal).
     */
    const LOOP_TYPES = {
        lbA: {
            prog: 'A',
            layers: { pad: 0.8, brass: 0, piano: 0.6, bass: 0.8, drums: 0.55, arp: 0.8, melody: 0.65 },
            drums: 'light',
            bass: 'pop',
            arp: 'sparkle',
            brass: 'none',
            piano: 'arp',
            melody: 'response'
        },
        lbB: {
            prog: 'B',
            layers: { pad: 0.9, brass: 0, piano: 0.6, bass: 0.75, drums: 0.5, arp: 0.9, melody: 0 },
            drums: 'light',
            bass: 'pop',
            arp: 'sparkle',
            brass: 'none',
            piano: 'stabs',
            melody: 'none'
        },
        boardA: {
            prog: 'break',
            layers: { pad: 1, brass: 0, piano: 0.7, bass: 0.55, drums: 0, arp: 0.9, melody: 0 },
            drums: 'none',
            bass: 'pedal',
            arp: 'sparse',
            brass: 'none',
            piano: 'arp',
            melody: 'none'
        },
        boardB: {
            prog: 'intro',
            layers: { pad: 1, brass: 0, piano: 0.55, bass: 0.55, drums: 0.35, arp: 0.8, melody: 0.45 },
            drums: 'light',
            bass: 'pedal',
            arp: 'sparkle',
            brass: 'none',
            piano: 'arp',
            melody: 'response'
        }
    };
    // Podio: espera mientras salen los puestos y cierre tras el ganador (sin batería)
    LOOP_TYPES.podBed = {
        prog: 'podium',
        layers: { pad: 0.9, brass: 0, piano: 0.55, bass: 0.5, drums: 0.55, arp: 0.6, melody: 0 },
        drums: 'intro',
        bass: 'pedal',
        arp: 'sparse',
        brass: 'none',
        piano: 'pulse',
        melody: 'none'
    };
    LOOP_TYPES.podEnd = {
        prog: 'podiumEnd',
        layers: { pad: 1, brass: 0, piano: 0.65, bass: 0.6, drums: 0, arp: 0.8, melody: 0 },
        drums: 'none',
        bass: 'pedal',
        arp: 'sparkle',
        brass: 'none',
        piano: 'arp',
        melody: 'none'
    };
    const LOOP_FORMS = {
        leaderboard: ['lbA', 'lbB'],
        board: ['boardA', 'boardB'],
        podium: ['podBed'],
        podiumEnd: ['podEnd']
    };

    /**
     * Plan de la sección `index` de una escena en bucle ('leaderboard' | 'board' |
     * 'podium' | 'podiumEnd'), en la tonalidad de la partida.
     */
    function planLoopSection(scene, seed, index) {
        const form = LOOP_FORMS[scene];
        const typeName = form[index % form.length];
        const type = LOOP_TYPES[typeName];
        const round = Math.floor(index / form.length);
        return {
            index: index,
            type: typeName,
            cycle: round,
            position: index % form.length,
            prevType: scene,
            key: arrangement.baseKey(seed),
            chords: prng.createRng(seed, 'prog:' + typeName + ':' + round).pick(theory.PROGRESSIONS[type.prog]),
            bars: arrangement.SECTION_BARS,
            layers: Object.assign({}, type.layers),
            styles: {
                drums: type.drums,
                bass: type.bass,
                arp: type.arp,
                brass: type.brass,
                piano: type.piano,
                melody: type.melody
            },
            variant: scene + ':' + index,
            climax: false
        };
    }

    /**
     * Final del podio, en la tonalidad de la partida: la sección 0 es el tema A completo (clímax, con
     * trompetas doblando; el golpe de entrada lo pone el propio podio) y después, cierre.
     */
    function planPodiumFinale(seed, index) {
        if (index > 0) return planLoopSection('podiumEnd', seed, index);
        const type = arrangement.SECTION_TYPES.A;
        return {
            index: 0,
            type: 'A',
            cycle: 0,
            position: 0,
            prevType: 'podium',
            key: arrangement.baseKey(seed),
            chords: theory.PROGRESSIONS.A[0],
            bars: arrangement.SECTION_BARS,
            layers: Object.assign({}, type.layers, { melody: 1, brass: 1 }),
            styles: {
                drums: 'disco',
                bass: type.bass,
                arp: 'sparkle',
                brass: type.brass,
                piano: type.piano,
                melody: type.melody
            },
            variant: 'podium:finale',
            climax: true
        };
    }

    return { LOOP_TYPES, LOOP_FORMS, planLoopSection, planPodiumFinale };
});
