/**
 * @fileoverview Mesa de mezcla de la música: un canal por capa con panorama
 * (volumen del panel), envíos a una reverb corta y a un delay que rebota, bombeo
 * de pad/metales/bajo con cada bombo y cadena master compresor → limitador →
 * volumen del usuario. Lo crea y lo posee MusicEngine.
 *
 * Sin worklets: la reverb es un ConvolverNode con respuesta generada al vuelo
 * (ligera en un portátil; la música solo suena en el presentador).
 */

import './music-settings.js?v=20260922172926';

// Capas y mezcla por defecto: viven con los ajustes del admin (music-settings.js)
export const { LAYERS, LAYER_DB } = self.XiroMusic.settings;

// Panorama por capa: metales a la izquierda y campanas a la derecha, como en un plató
const PANS = { pad: 0, brass: -0.2, bass: 0, drums: 0, arp: 0.25, melody: 0.05 };
const PUMPED = new Set(['pad', 'brass', 'bass', 'arp']);
// Envíos por capa, después del canal (silenciar una capa en el panel silencia también su eco)
const SENDS = {
    pad: { reverb: 0.35 }, brass: { reverb: 0.45, delay: 0.08 }, drums: { reverb: 0.2 },
    arp: { reverb: 0.4, delay: 0.45 }, melody: { reverb: 0.3, delay: 0.18 }
};
const PUMP_DEPTH = 0.3;
const REVERB_LEVEL = 0.32;
const DELAY_LEVEL = 0.2;
const MIN_DB = -80;
// Reverb de sala real (respuesta al impulso): nivel frente a la generada y fundido al cambiar
const ROOM_LEVEL = 1;
const REVERB_SWAP_SECONDS = 0.4;

export function createMixer(Tone) {
    const nodes = [];
    const own = (node) => {
        nodes.push(node);
        return node;
    };

    const bus = own(new Tone.Gain(1));
    const glue = own(new Tone.Compressor({ threshold: -18, ratio: 2.5, attack: 0.02, release: 0.25 }));
    const limiter = own(new Tone.Limiter(-1));
    const master = own(new Tone.Volume(0));
    // Puerta de salida: pausa del presentador y silencio en preguntas con audio propio
    const gate = own(new Tone.Gain(1));
    const waveform = own(new Tone.Waveform(1024));
    bus.chain(glue, limiter, master, gate, Tone.getDestination());
    gate.connect(waveform);

    const reverbIn = own(new Tone.Filter(280, 'highpass'));
    const reverb = own(new Tone.Reverb({ decay: 2.2, preDelay: 0.018, wet: 1 }));
    const reverbReturn = own(new Tone.Gain(REVERB_LEVEL));
    const generated = own(new Tone.Gain(1));
    reverbIn.chain(reverb, generated, reverbReturn, bus);
    let room = null; // { url, convolver, level }

    const delay = own(new Tone.PingPongDelay({ delayTime: '8n.', feedback: 0.26, wet: 1 }));
    const delayFilter = own(new Tone.Filter(3200, 'lowpass'));
    const delayReturn = own(new Tone.Gain(DELAY_LEVEL));
    delay.chain(delayFilter, delayReturn, bus);

    const pump = own(new Tone.Gain(1)).connect(bus);
    const sendInputs = { reverb: reverbIn, delay };
    const layers = {};
    LAYERS.forEach((name) => {
        const channel = own(new Tone.Channel({ volume: LAYER_DB[name], pan: PANS[name] })).connect(PUMPED.has(name) ? pump : bus);
        Object.entries(SENDS[name] || {}).forEach(([fx, amount]) => {
            channel.connect(own(new Tone.Gain(amount)).connect(sendInputs[fx]));
        });
        layers[name] = channel;
    });

    // Avisos de fin de tiempo (subida, tic-tac): canal propio, sin bombeo
    const cues = own(new Tone.Channel({ volume: 0 })).connect(bus);

    let fxOn = true;

    return {
        layers,
        cues,
        waveform,
        /** Bombeo (sidechain): baja pad/metales/bajo un instante con cada bombo. */
        pumpAt(time) {
            if (!fxOn) return;
            pump.gain.cancelAndHoldAtTime(time);
            pump.gain.linearRampToValueAtTime(1 - PUMP_DEPTH, time + 0.008);
            pump.gain.linearRampToValueAtTime(1, time + 0.24);
        },
        /** Efectos de mezcla on/off (comparación A/B en el panel). */
        setFx(on) {
            fxOn = Boolean(on);
            reverbReturn.gain.rampTo(fxOn ? REVERB_LEVEL : 0, 0.2);
            delayReturn.gain.rampTo(fxOn ? DELAY_LEVEL : 0, 0.2);
            LAYERS.forEach((name) => layers[name].pan.rampTo(fxOn ? PANS[name] : 0, 0.2));
            if (!fxOn) pump.gain.rampTo(1, 0.05);
        },
        /**
         * Reverb: null = la generada; o la URL de la respuesta al impulso de una sala
         * real. Cambia con un fundido cruzado (si la sala no carga, se queda la anterior).
         */
        async setReverb(url) {
            const old = room && room.url !== url ? room : null;
            if (url && !(room && room.url === url)) {
                const convolver = new Tone.Convolver({ normalize: true });
                await convolver.load(url);
                const level = new Tone.Gain(0);
                reverbIn.connect(convolver);
                convolver.chain(level, reverbReturn);
                room = { url, convolver, level };
            }
            if (!url) room = null;
            generated.gain.rampTo(url ? 0 : 1, REVERB_SWAP_SECONDS);
            if (room) room.level.gain.rampTo(ROOM_LEVEL, REVERB_SWAP_SECONDS);
            if (old) {
                old.level.gain.rampTo(0, REVERB_SWAP_SECONDS);
                setTimeout(() => [old.convolver, old.level].forEach((node) => node.dispose()), REVERB_SWAP_SECONDS * 2500);
            }
        },
        /** Volumen de una capa en dB (panel de depuración). */
        setLayerVolume(name, db) {
            if (layers[name]) layers[name].volume.rampTo(db, 0.1);
        },
        setLayerMuted(name, muted) {
            if (layers[name]) layers[name].mute = Boolean(muted);
        },
        /** Volumen general 0..1; al cuadrado para que el control se sienta lineal al oído. */
        setVolume(value) {
            const v = Math.max(0, Math.min(1, Number(value) || 0));
            master.volume.rampTo(v === 0 ? MIN_DB : Tone.gainToDb(v * v), 0.1);
        },
        setMuted(muted) {
            master.mute = Boolean(muted);
        },
        /** Abre o cierra la salida con un fundido de `seconds` que empieza en `time`. */
        setGate(open, time, seconds) {
            gate.gain.cancelAndHoldAtTime(time);
            gate.gain.linearRampToValueAtTime(open ? 1 : 0, time + seconds);
        },
        dispose() {
            if (room) [room.convolver, room.level].forEach((node) => node.dispose());
            nodes.forEach((node) => node.dispose());
        }
    };
}
