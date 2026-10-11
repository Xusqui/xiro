/**
 * @fileoverview Panel de pruebas de la música (/dev/music, solo con
 * MUSIC_DEV_PANEL=true). Maneja MusicEngine a mano para escuchar cada escena,
 * semilla, tempo y capa por separado.
 */

import { unlockAudio, loadMusicEngine } from '../music-loader.js?v=20260922172926';
import { LAYERS, LAYER_DB } from '../music-mixer.js?v=20260922172926';
import { bindQuestionControls } from './music-panel-question.js?v=20260922172926';
import { bindMomentControls } from './music-panel-moments.js?v=20260922172926';
import { bindSoundControls } from './music-panel-sounds.js?v=20260922172926';
import { readTrace } from '../music-trace.js?v=20260922172926';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const CHORD_SUFFIX = { triad: '', seventh: '7', sus2: 'sus2', sus4: 'sus4', add9: 'add9' };
const LOG_MAX = 14;
const SECTION_NAMES = {
    intro: 'intro', A: 'tema A', B: 'tema B', break: 'respiro', build: 'subida', question: 'pregunta',
    lbA: 'marcador A', lbB: 'marcador B', boardA: 'tablero A', boardB: 'tablero B',
    podBed: 'espera del podio', podEnd: 'cierre del podio'
};

const $ = (id) => document.getElementById(id);
let engine = null;
let question = null;
let moments = null;
let sounds = null;

function log(message) {
    const list = $('dm-log');
    const item = document.createElement('li');
    item.textContent = `${new Date().toLocaleTimeString()} · ${message}`;
    list.prepend(item);
    while (list.children.length > LOG_MAX) list.lastChild.remove();
}

function selectedScene() {
    const checked = document.querySelector('input[name="dm-scene"]:checked');
    return checked ? checked.value : 'lobby';
}

function describeKey(key) {
    if (!key) return '—';
    const name = self.XiroMusic.theory.midiToName(key.root).replace(/-?\d+$/, '');
    return `${name} ${key.mode}`;
}

function describeChords(chords) {
    if (!chords) return '—';
    return chords.map((c) => ROMAN[c.d % 7] + CHORD_SUFFIX[c.k]).join(' · ');
}

function renderStatus() {
    const status = engine.getStatus();
    $('dm-info-scene').textContent = status.scene;
    $('dm-info-section').textContent = status.section
        ? `${status.section.index + 1} · ${SECTION_NAMES[status.section.type]} (vuelta ${status.section.cycle + 1})`
        : '—';
    $('dm-info-position').textContent = String(status.position).split('.')[0];
    $('dm-info-bpm').textContent = status.bpm.toFixed(1);
    $('dm-info-key').textContent = describeKey(status.key);
    $('dm-info-chords').textContent = describeChords(status.chords);
    $('dm-info-context').textContent = status.context;
    $('dm-info-tension').textContent = question.describe(status);
    $('dm-info-samples').textContent = status.samples ? 'muestras reales + síntesis (cuerdas y campanas)' : 'todo sintetizado (sin muestras)';
}

function drawWave(canvas, ctx2d) {
    const samples = engine.debug.mixer.waveform.getValue();
    const { width, height } = canvas;
    ctx2d.clearRect(0, 0, width, height);
    ctx2d.strokeStyle = getComputedStyle(canvas).color;
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    for (let i = 0; i < samples.length; i++) {
        const x = (i / (samples.length - 1)) * width;
        const y = (1 - (samples[i] + 1) / 2) * height;
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
}

function startRenderLoop() {
    const canvas = $('dm-wave');
    const ctx2d = canvas.getContext('2d');
    let frame = 0;
    const tick = () => {
        drawWave(canvas, ctx2d);
        if (frame++ % 6 === 0) renderStatus(); // la info no necesita 60 fps
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

function buildLayerControls() {
    const container = $('dm-layers');
    LAYERS.forEach((layer) => {
        const row = document.createElement('div');
        row.className = 'dm-layer';
        row.innerHTML = `
            <span class="dm-layer-name">${layer}</span>
            <input type="range" min="-40" max="6" step="1" value="${LAYER_DB[layer]}" data-layer-volume="${layer}" aria-label="Volumen ${layer}">
            <output data-layer-value="${layer}">${LAYER_DB[layer]} dB</output>
            <label><input type="checkbox" data-layer-mute="${layer}"> mute</label>`;
        container.appendChild(row);
    });
    container.addEventListener('input', (e) => {
        const layer = e.target.dataset.layerVolume;
        if (!layer) return;
        container.querySelector(`[data-layer-value="${layer}"]`).textContent = `${e.target.value} dB`;
        if (engine) engine.debug.mixer.setLayerVolume(layer, Number(e.target.value));
    });
    container.addEventListener('change', (e) => {
        const layer = e.target.dataset.layerMute;
        if (layer && engine) engine.debug.mixer.setLayerMuted(layer, e.target.checked);
    });
}

/** Reaplica la mezcla del panel (al crear el motor o tras recargarlo). */
function applyMixFromControls() {
    engine.setVolume(Number($('dm-volume').value));
    engine.mute($('dm-mute').checked);
    document.querySelectorAll('[data-layer-volume]').forEach((input) => {
        engine.debug.mixer.setLayerVolume(input.dataset.layerVolume, Number(input.value));
    });
    document.querySelectorAll('[data-layer-mute]').forEach((input) => {
        engine.debug.mixer.setLayerMuted(input.dataset.layerMute, input.checked);
    });
}

async function onStart() {
    unlockAudio(); // en el propio gesto, antes de cualquier await
    $('dm-start').disabled = true;
    $('dm-status').textContent = 'Cargando Tone.js y las muestras (~3,5 MB)…';
    try {
        engine = await loadMusicEngine({ seed: $('dm-seed').value.trim() || undefined });
    } catch (err) {
        $('dm-status').textContent = `No se pudo cargar el motor: ${err.message}`;
        $('dm-start').disabled = false;
        return;
    }
    $('dm-seed').value = engine.seed;
    engine.on((type, detail) => {
        if (moments.onEvent(type, detail)) return;
        if (type === 'scene') log(`Escena «${detail.name}» programada en el compás ${detail.bar + 1}`);
        else if (type === 'section') {
            if (detail.type !== 'question' || detail.index % 4 === 0) {
                log(`Sección ${detail.index + 1}: ${SECTION_NAMES[detail.type]} en ${describeKey(detail.key)}`);
            }
        }
        else log(`${type}: ${detail}`);
    });
    applyMixFromControls();
    void sounds.apply();
    document.querySelectorAll('[data-option]').forEach((input) => engine.setOption(input.dataset.option, input.checked));
    engine.debug.setBpm(Number($('dm-bpm').value));
    engine.setScene(selectedScene());
    $('dm-stop').disabled = false;
    $('dm-status').textContent = 'Sonando. Cambia escena, semilla o capas.';
    log(`Motor listo · semilla ${engine.seed} · ${engine.bank ? 'con muestras' : 'SIN muestras (sintetizado)'}`);
    startRenderLoop();
}

function bindControls() {
    $('dm-start').addEventListener('click', onStart);
    $('dm-stop').addEventListener('click', () => {
        document.querySelector('input[name="dm-scene"][value="idle"]').checked = true;
        if (engine) engine.setScene('idle');
    });
    $('dm-scenes').addEventListener('change', () => {
        if (!engine) return;
        if (selectedScene() === 'question') engine.setTension(Number($('dm-tension').value));
        engine.setScene(selectedScene());
    });
    $('dm-seed-apply').addEventListener('click', () => {
        const seed = $('dm-seed').value.trim();
        if (engine && seed) {
            engine.setSeed(seed);
            log(`Semilla ${seed}`);
        }
    });
    $('dm-seed-random').addEventListener('click', () => {
        $('dm-seed').value = Math.floor(Math.random() * 0xFFFFFF).toString(36);
        $('dm-seed-apply').click();
    });
    $('dm-bpm').addEventListener('input', (e) => {
        $('dm-bpm-value').textContent = e.target.value;
        if (engine) engine.debug.setBpm(Number(e.target.value));
    });
    $('dm-volume').addEventListener('input', (e) => {
        $('dm-volume-value').textContent = Number(e.target.value).toFixed(2);
        if (engine) engine.setVolume(Number(e.target.value));
    });
    $('dm-mute').addEventListener('change', (e) => engine && engine.mute(e.target.checked));
    $('dm-options').addEventListener('change', (e) => {
        const name = e.target.dataset.option;
        if (!name || !engine) return;
        engine.setOption(name, e.target.checked);
        log(`${e.target.parentElement.textContent.trim()}: ${e.target.checked ? 'sí' : 'no'}`);
    });
}

// Cualquier error de la página, al registro (para diagnosticar en navegadores sin consola a mano)
window.addEventListener('error', (e) => log(`ERROR: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => log(`ERROR (promesa): ${e.reason && e.reason.message ? e.reason.message : e.reason}`));

function showTrace() {
    const list = $('dm-trace');
    list.replaceChildren(...readTrace().reverse().map((line) => Object.assign(document.createElement('li'), { textContent: line })));
}

buildLayerControls();
bindControls();
showTrace();
$('dm-trace-clear').addEventListener('click', () => {
    try { localStorage.removeItem('xiro_music_trace'); } catch { }
    showTrace();
});
question = bindQuestionControls(() => engine, log);
moments = bindMomentControls(() => engine, log, question);
sounds = bindSoundControls(() => engine, log);
