/**
 * @fileoverview Campanas de reacción, independientes de la escena: una nota por
 * respuesta (sube con la proporción de respondidos), por jugador que entra al lobby y
 * una corrida al tirar los dados del Trivial. Cuadran con la corchea siguiente del
 * Transport y, si llegan en ráfaga, se encolan corchea a corchea (con tope: las que no
 * caben se descartan). Suenan por la capa de campanas (arp): su volumen y su mute del
 * admin valen también aquí.
 *
 * Los grados vienen de music-reactions.js (pentatónica de la tonalidad de la partida).
 */

const EIGHTH_DIV = 2;          // corcheas
const MAX_QUEUE = 4;           // como mucho 4 corcheas por delante
const RANGE = [64, 96];        // registro de campana
const RUN_STEP_DIV = 4;        // corrida de los dados a semicorcheas

// Escena en la que tiene sentido cada reacción
const SCENE_OF = { answer: 'question', join: 'lobby', dice: 'board' };

/**
 * @param {object} Tone
 * @param {object} output  Canal de la capa de campanas
 * @param {{ key: () => object, scene: () => string, active: () => boolean }} ctx
 *        key: tonalidad mayor de la partida; scene: escena que suena; active: si las
 *        reacciones están activadas y no hay una revelación en curso
 */
export function createAccents(Tone, output, ctx) {
    const { theory, reactions } = self.XiroMusic;
    const transport = Tone.getTransport();
    const bell = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.5,
        modulationIndex: 9,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 1.1, sustain: 0, release: 1 },
        modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 },
        volume: -6
    }).connect(output);
    bell.maxPolyphony = 8;
    let lastSlot = -Infinity;
    let ids = [];

    /** Grados → notas, moviendo la figura entera por octavas para que quepa en el registro. */
    function notesFor(degrees) {
        const midis = degrees.map((d) => theory.degreeToMidi(ctx.key(), d));
        let shift = 0;
        while (Math.max(...midis) + shift > RANGE[1]) shift -= 12;
        while (Math.min(...midis) + shift < RANGE[0]) shift += 12;
        return midis.map((m) => theory.midiToName(m + shift));
    }

    /** Siguiente corchea libre (o null si la cola va demasiado por delante). */
    function nextSlot() {
        const grid = transport.PPQ / EIGHTH_DIV;
        const now = transport.getTicksAtTime(Tone.now());
        const first = Math.ceil((now + 1) / grid) * grid;
        const slot = Math.max(first, lastSlot + grid);
        if (slot - first >= MAX_QUEUE * grid) return null;
        lastSlot = slot;
        return slot;
    }

    function schedule(notes, vel, stepTicks) {
        if (transport.state !== 'started') return;
        const slot = nextSlot();
        if (slot === null) return;
        notes.forEach((note, i) => {
            const at = slot + i * stepTicks;
            ids.push(transport.scheduleOnce((time) => bell.triggerAttackRelease(note, '8n', time, vel), `${at}i`));
        });
        if (ids.length > 64) ids = ids.slice(-32);
    }

    const PLAY = {
        // value: proporción de respondidos (0..1); más fuerte cuantos más
        answer: (ratio) => schedule(notesFor([reactions.answerDegree(ratio)]), 0.25 + 0.2 * ratio, 0),
        // value: jugadores en el lobby
        join: (count) => schedule(notesFor([reactions.joinDegree(count)]), 0.38, 0),
        dice: () => schedule(notesFor(reactions.DICE_RUN), 0.32, transport.PPQ / RUN_STEP_DIV)
    };

    return {
        /** Reacción a un suceso del juego ('answer' | 'join' | 'dice'); fuera de su escena, nada. */
        react(kind, value) {
            if (!PLAY[kind] || !ctx.active() || ctx.scene() !== SCENE_OF[kind]) return;
            PLAY[kind](value);
        },
        cancel() {
            ids.forEach((id) => transport.clear(id));
            ids = [];
            lastSlot = -Infinity;
        },
        dispose() {
            this.cancel();
            bell.dispose();
        }
    };
}
