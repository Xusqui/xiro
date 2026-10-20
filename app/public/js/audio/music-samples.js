/**
 * @fileoverview Carga del banco de muestras (metales, bajo, batería, timbales) del
 * juego de sonidos elegido ({ brass, bass, drums }, ver music-sample-map.js). Cada fichero
 * se descarga y decodifica una vez aunque lo usen varios instrumentos. Si algo falla
 * o tarda demasiado, devuelve null y la música sigue con instrumentos sintetizados.
 */

const LOAD_TIMEOUT_MS = 30000;

/**
 * @param {object} Tone
 * @param {{ brass?: string, bass?: string, drums?: string }} [sounds]  Juego de sonidos (por defecto, el de siempre)
 * @returns {Promise<null | { sounds: object, pitched(group: string): object, pitchedLayers(group: string): object[],
 *           drum(piece: string): { urls: object, notes: string[][] } }>}
 */
export async function loadSampleBank(Tone, sounds) {
    // Un fallo puntual de red (un fichero que no llega) no debe dejar la partida sin muestras
    return (await loadOnce(Tone, sounds)) || loadOnce(Tone, sounds);
}

function loadOnce(Tone, sounds) {
    const map = self.XiroMusic.sampleMap;
    const chosen = Object.assign({}, map.DEFAULT_SOUNDS, sounds);
    const byKey = map.allUrls(chosen);
    const files = Array.from(new Set(Object.values(byKey)));
    const fileIds = {};
    files.forEach((file, i) => {
        fileIds[file] = 'f' + i;
    });
    const urls = {};
    files.forEach(file => {
        urls[fileIds[file]] = file;
    });

    return new Promise(resolve => {
        let settled = false;
        const finish = value => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const timer = setTimeout(() => finish(null), LOAD_TIMEOUT_MS);
        const buffers = new Tone.ToneAudioBuffers({
            urls,
            baseUrl: map.BASE_URL,
            onload: () => {
                clearTimeout(timer);
                finish(createBank(map, buffers, fileIds, chosen));
            },
            onerror: () => {
                clearTimeout(timer);
                finish(null);
            }
        });
    });
}

function createBank(map, buffers, fileIds, sounds) {
    const toBuffers = noteUrls => {
        const out = {};
        Object.keys(noteUrls).forEach(note => {
            out[note] = buffers.get(fileIds[noteUrls[note]]);
        });
        return out;
    };
    return {
        sounds,
        /** { nota: ToneAudioBuffer } de un instrumento afinado (lead, stab, bass…): la capa más fuerte. */
        pitched(group) {
            const layers = map.pitchedLayers(group, sounds);
            return layers.length ? toBuffers(layers[layers.length - 1]) : {};
        },
        /** Capas de intensidad de un instrumento afinado ([{ nota: buffer }], de suave a fuerte). */
        pitchedLayers(group) {
            return map.pitchedLayers(group, sounds).map(toBuffers);
        },
        /** Sonido de tic-tac: buffers por nota y notas de tic y tac. */
        tick(name) {
            const sound = map.TICK_SOUNDS[name];
            return { urls: toBuffers(sound.urls), notes: sound.notes };
        },
        /** Pieza de batería: buffers por nota y tabla notes[capa][alternancia]. */
        drum(piece) {
            const kit = map.drumKit(piece, sounds.drums);
            return { urls: toBuffers(kit.urls), notes: kit.notes };
        },
        dispose() {
            buffers.dispose();
        }
    };
}
