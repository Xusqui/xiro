/**
 * @fileoverview Panel de pruebas: simulador de pregunta. Calcula la tensión con las
 * mismas funciones que usará el juego (music-tension.js: progreso desde un instante de
 * inicio, pausa/reanudación, curva) y se la pasa al motor; el intervalo solo muestrea.
 */

const SAMPLE_MS = 200;
const $ = (id) => document.getElementById(id);

/**
 * @param {() => object|null} getEngine  Motor ya creado (o null si aún no hay audio)
 * @param {(msg: string) => void} log
 */
export function bindQuestionControls(getEngine, log) {
    let sim = null; // { state, timer }

    const T = () => self.XiroMusic.tension;

    function showTension(t) {
        $('dm-tension').value = String(t);
        $('dm-tension-value').textContent = t.toFixed(2);
    }

    function stopSim() {
        if (!sim) return;
        clearInterval(sim.timer);
        sim = null;
        $('dm-q-pause').disabled = true;
        $('dm-q-pause').textContent = 'Pausar';
    }

    function sample() {
        const engine = getEngine();
        if (!engine || !sim) return;
        const now = Date.now();
        const progress = T().questionProgress(sim.state, now);
        const t = T().tensionCurve(progress);
        engine.setTension(t);
        showTension(t);
        $('dm-q-left').textContent = `${(T().remainingMs(sim.state, now) / 1000).toFixed(1)} s · ${Math.round(progress * 100)} %`;
        if (progress >= 1) {
            log('Tiempo agotado: revelación');
            stopSim();
            engine.triggerReveal(document.getElementById('dm-reveal-next').checked ? 'leaderboard' : null);
        }
    }

    function startSim() {
        const engine = getEngine();
        if (!engine) return;
        stopSim();
        const seconds = Math.max(5, Math.min(120, Number($('dm-q-seconds').value) || 20));
        document.querySelector('input[name="dm-scene"][value="question"]').checked = true;
        engine.debug.cues.setTickSound($('dm-tick-sound').value);
        engine.setTension(0);
        engine.setScene('question');
        sim = { state: { startedAt: Date.now(), durationMs: seconds * 1000, pausedAt: null }, timer: setInterval(sample, SAMPLE_MS) };
        engine.startQuestionClock(seconds * 1000);
        $('dm-q-pause').disabled = false;
        log(`Pregunta simulada de ${seconds} s`);
    }

    function togglePause() {
        const engine = getEngine();
        if (!engine || !sim) return;
        const now = Date.now();
        if (sim.state.pausedAt == null) {
            sim.state = T().pauseQuestion(sim.state, now);
            engine.stopQuestionClock();
            $('dm-q-pause').textContent = 'Reanudar';
            log('Temporizador en pausa');
        } else {
            sim.state = T().resumeQuestion(sim.state, now);
            engine.startQuestionClock(T().remainingMs(sim.state, now));
            $('dm-q-pause').textContent = 'Pausar';
            log('Temporizador reanudado');
        }
    }

    $('dm-tick-sound').addEventListener('change', (e) => {
        const engine = getEngine();
        if (engine) engine.debug.cues.setTickSound(e.target.value);
        log(`Tic-tac: ${e.target.selectedOptions[0].textContent}`);
    });
    $('dm-tick-preview').addEventListener('click', () => {
        const engine = getEngine();
        if (!engine) return;
        engine.debug.cues.setTickSound($('dm-tick-sound').value);
        engine.debug.cues.preview();
    });

    $('dm-q-start').addEventListener('click', startSim);
    $('dm-q-pause').addEventListener('click', togglePause);
    $('dm-q-stop').addEventListener('click', () => {
        stopSim();
        const engine = getEngine();
        if (engine) engine.stopQuestionClock();
    });
    // Mover la tensión a mano detiene la simulación
    $('dm-tension').addEventListener('input', (e) => {
        stopSim();
        const engine = getEngine();
        if (engine) engine.stopQuestionClock();
        const t = Number(e.target.value);
        $('dm-tension-value').textContent = t.toFixed(2);
        if (engine) engine.setTension(t);
    });

    return {
        /** Para la simulación (p. ej. al revelar la respuesta). */
        stop() {
            stopSim();
        },
        /** Resumen legible de lo que hace la tensión ahora (para el bloque de estado). */
        describe(status) {
            const p = status.tensionParams;
            if (!p) return '—';
            return `t=${status.tension.toFixed(2)} · batería ${p.drums} · bajo ${p.bass} · armonía ${p.harmony}`
                + ` · filtro ${p.filterHz} Hz · tempo ×${p.tempoFactor.toFixed(2)}`;
        }
    };
}
