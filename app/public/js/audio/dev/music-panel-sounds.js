/**
 * @fileoverview Panel de pruebas: juego de sonidos (metales, melodía, bajo, batería, reverb) para
 * comparar de oído. Cada cambio se aplica al motor en marcha y se recuerda en este
 * navegador (localStorage, solo comodidad del panel).
 */

const $ = (id) => document.getElementById(id);
const GROUPS = ['brass', 'melody', 'bass', 'drums', 'reverb'];
const STORE_KEY = 'xiro_music_sounds';
const NAMES = {
    vsco: 'VSCO 2', iowa: 'Iowa pp/mf/ff', brass: 'melodía de metales', altosax: 'saxo alto', sopsax: 'saxo soprano',
    flute: 'flauta', clarinet: 'clarinete', oboe: 'oboe', violins: 'violines', finger: 'bajo a dedo', stac: 'bajo staccato', babyblue: 'bajo Babyblue',
    upright: 'contrabajo', rusty: 'Big Rusty', virtuosity: 'Virtuosity', naked: 'Naked Drums',
    generated: 'reverb generada', liverpool: 'Liverpool Philharmonic', nordea: 'Nordea Hall', knights: 'Knights Hall'
};

function selected() {
    const out = {};
    GROUPS.forEach((group) => {
        const input = document.querySelector(`input[name="dm-sound-${group}"]:checked`);
        if (input) out[group] = input.value;
    });
    return out;
}

function restore() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    } catch (err) {
        saved = null;
    }
    if (!saved) return;
    GROUPS.forEach((group) => {
        const input = document.querySelector(`input[name="dm-sound-${group}"][value="${saved[group]}"]`);
        if (input) input.checked = true;
    });
}

function save(sounds) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(sounds));
    } catch (err) {
        // sin almacenamiento: no se recuerda, sin más
    }
}

// «synth» vale para melodía y bajo: el nombre depende del grupo
const nameOf = (group, value) => {
    if (value === 'synth') return group === 'bass' ? 'bajo sintetizado' : 'melodía sintetizada';
    return NAMES[value] || value;
};
const describe = (sounds) => GROUPS.map((group) => nameOf(group, sounds[group])).join(' · ');

/**
 * @param {() => object|null} getEngine
 * @param {(msg: string) => void} log
 * @returns {{ apply: () => Promise<void> }} apply: aplica la selección al motor (al arrancar y en cada cambio)
 */
export function bindSoundControls(getEngine, log) {
    restore();
    const status = $('dm-sound-status');
    let pending = 0;

    async function apply() {
        const engine = getEngine();
        const sounds = selected();
        save(sounds);
        if (!engine) return;
        const id = ++pending;
        const started = performance.now();
        status.textContent = `Cargando ${describe(sounds)}…`;
        const applied = await engine.setSounds(sounds);
        if (id !== pending) return;
        const seconds = ((performance.now() - started) / 1000).toFixed(1);
        status.textContent = `Suena: ${describe(applied)}${engine.bank ? '' : ' (sin muestras: sintetizado)'} · listo en ${seconds} s`;
        log(`Sonidos: ${describe(applied)}`);
    }

    $('dm-sounds').addEventListener('change', () => { void apply(); });
    return { apply };
}
