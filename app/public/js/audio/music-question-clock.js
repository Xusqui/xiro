/**
 * @fileoverview Reloj de la pregunta del controlador de la música. Lleva la pregunta en
 * hora del SERVIDOR (desfase medido al recibir cada mensaje) con sus pausas, cuántos
 * jugadores han respondido y el arco de la partida; mientras corre, le pasa al motor la
 * tensión cada 250 ms: la del reloj, empujada por las respuestas y apoyada en el arco
 * (music-tension.js y music-reactions.js).
 */

import './music-tension.js?v=20260922172926';
import './music-reactions.js?v=20260922172926';
import { trace } from './music-trace.js?v=20260922172926';

const SAMPLE_MS = 250;

/** @param {() => object|null} getEngine  Motor, si ya está creado */
export function createQuestionClock(getEngine) {
    const T = self.XiroMusic.tension;
    const R = self.XiroMusic.reactions;
    let question = null; // { startedAt, durationMs, pausedAt } en hora del servidor
    let offset = 0; // servidor − local (ms)
    let timer = null;
    let arc = R.gameArc(0, 0);
    let answered = 0;
    let ratio = 0;

    const serverNow = () => Date.now() + offset;

    function tension() {
        if (!question) return 0;
        return R.questionTension(T.tensionCurve(T.questionProgress(question, serverNow())), ratio, arc);
    }

    function sample() {
        const engine = getEngine();
        if (engine && question) engine.setTension(tension());
    }

    function stop() {
        if (timer) clearInterval(timer);
        timer = null;
        const engine = getEngine();
        if (engine) engine.stopQuestionClock();
    }

    return {
        /** Mide el desfase con la hora del servidor que trae un mensaje (si la trae). */
        sync(serverTime) {
            if (typeof serverTime === 'number') offset = T.clockOffset(serverTime, Date.now());
        },
        /** Pregunta nueva: { durationMs, startedAt?, index?, total? }. Devuelve su arco. */
        begin(q) {
            question = { startedAt: q.startedAt || serverNow(), durationMs: q.durationMs, pausedAt: null };
            arc = R.gameArc(q.index, q.total);
            answered = 0;
            ratio = 0;
            return arc;
        },
        /** Sin pregunta en juego (pantalla previa, diapositiva). */
        clear() {
            question = null;
            answered = 0;
            ratio = 0;
        },
        get arc() {
            return arc;
        },
        tension,
        /**
         * Respondidos `count` de `total`: la tensión sube al momento. Devuelve la proporción
         * si hay respuestas nuevas (para la campana) o null si no.
         */
        answered(count, total) {
            if (!question || !(count > answered)) return null;
            answered = count;
            ratio = R.answeredRatio(count, total);
            sample();
            return ratio;
        },
        pause() {
            if (question) question = T.pauseQuestion(question, serverNow());
        },
        /** remainingMs: lo que manda el servidor al reanudar (o null: lo que quedaba). */
        resume(remainingMs) {
            if (question) question = T.resumeQuestion(question, serverNow(), remainingMs);
        },
        /** Pone en marcha la tensión y los avisos de fin de tiempo (subida y tic-tac). */
        start() {
            stop();
            const engine = getEngine();
            if (!question || !engine) return;
            sample();
            engine.startQuestionClock(T.remainingMs(question, serverNow()));
            timer = setInterval(sample, SAMPLE_MS);
            trace(`  reloj de pregunta en marcha (desfase ${offset} ms)`);
        },
        stop
    };
}
