/**
 * @fileoverview Cómo reacciona la música a lo que pasa en la partida, en funciones puras:
 *  - arco de la partida: cuanto más avanzada, más alto el suelo de tensión de la
 *    pregunta; la última pregunta, más todavía (y se anuncia al entrar);
 *  - empuje de las respuestas: cada jugador que responde sube la tensión. El servidor
 *    revela en cuanto responden todos, así la revelación llega con la energía ganada;
 *  - campanas de reacción: grados de una pentatónica (respuestas, jugadores que entran,
 *    dados del Trivial). La pentatónica mayor de la partida y la menor de su relativo
 *    tienen las mismas notas: suenan bien sobre cualquier escena.
 *
 * Grados de la tonalidad MAYOR de la partida (0 = tónica; 5 = tónica del relativo menor).
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.reactions).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.reactions = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

    const ARC_FLOOR = 0.1;     // suelo de tensión en la penúltima pregunta (crece desde 0)
    const FINAL_FLOOR = 0.2;   // última pregunta: bajo y charles desde el primer compás
    const ANSWER_PUSH = 0.35;  // con todos respondidos, la tensión sube hasta aquí (desde 0)

    // Pentatónica mayor (grados 0, 1, 2, 4, 5 de la escala) en tres octavas
    const PENTATONIC = [0, 1, 2, 4, 5];
    const ladder = (from, count) => {
        const out = [];
        for (let i = 0; i < count; i++) {
            const k = from + i;
            out.push(Math.floor(k / 5) * 7 + PENTATONIC[((k % 5) + 5) % 5]);
        }
        return out;
    };
    // Respuestas: del la menor (grado 5) a dos octavas arriba; jugadores: desde la tónica
    const ANSWER_LADDER = ladder(4, 11);
    const JOIN_LADDER = ladder(0, 10);
    // Dados: corrida que sube a semicorcheas (los dados que ruedan)
    const DICE_RUN = [0, 1, 2, 4, 7];

    /**
     * Arco de la partida a partir de la pregunta que suena (0-based) y el total.
     * @returns {{ progress: number, final: boolean, floor: number }}
     */
    function gameArc(index, total) {
        const n = Number(total);
        const i = Number(index);
        if (!(n > 1) || !(i >= 0)) return { progress: 0, final: false, floor: 0 };
        const progress = clamp01(i / (n - 1));
        const final = i >= n - 1;
        return { progress, final, floor: final ? FINAL_FLOOR : ARC_FLOOR * progress };
    }

    /** Proporción 0..1 de jugadores que ya han respondido. */
    function answeredRatio(answered, total) {
        return total > 0 ? clamp01(answered / total) : 0;
    }

    /**
     * Tensión de la pregunta: la del reloj (music-tension.tensionCurve), empujada por las
     * respuestas y apoyada en el suelo del arco. Siempre ≥ la del reloj y ≤ 1.
     */
    function questionTension(timeTension, ratio, arc) {
        const t = clamp01(timeTension);
        const pushed = t + ANSWER_PUSH * clamp01(ratio) * (1 - t);
        const floor = arc ? clamp01(arc.floor) : 0;
        return floor + (1 - floor) * pushed;
    }

    /** Grado de la campana de una respuesta: sube con la proporción de respondidos. */
    function answerDegree(ratio) {
        return ANSWER_LADDER[Math.round(clamp01(ratio) * (ANSWER_LADDER.length - 1))];
    }

    /** Grado de la campana del jugador n.º `count` (1, 2…): sube y baja por la escalera. */
    function joinDegree(count) {
        const span = JOIN_LADDER.length - 1;
        const k = Math.max(0, Math.floor(Number(count) || 1) - 1) % (2 * span);
        return JOIN_LADDER[k <= span ? k : 2 * span - k];
    }

    return {
        ANSWER_PUSH, ARC_FLOOR, FINAL_FLOOR, ANSWER_LADDER, JOIN_LADDER, DICE_RUN,
        gameArc, answeredRatio, questionTension, answerDegree, joinDegree
    };
});
