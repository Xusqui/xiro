/**
 * @fileoverview Pantalla de «Nube de palabras» (word_cloud) en el móvil: enunciado y casillas de
 * palabra (HTML en core/word-cloud-view.js, estilos en css/word-cloud.css); tras enviar, la nube.
 * El envío por el socket está en player-answer-wordcloud.js; el estado y el cupo, en
 * player-wordcloud-state.js. El diseño final llega con la fase de pantallas.
 */

import { getNickname, setHaRespondido, setCanAnswer, setCurrentSlideType } from './player-state.js?v=20260922172926';
import { getResponsiveFontClass } from './player-question-utils.js?v=20260922172926';
import { startWordCloud, getWordCloudMaxWords } from './player-wordcloud-state.js?v=20261128000000';
import { showWordCloudResult } from './player-wordcloud-result.js?v=20261128000000';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';
import { t } from '../core/translate.js?v=20261105120000';

function viewLabels() {
    return {
        placeholder: t('player.wordcloud.placeholder', 'Escribe una palabra'),
        send: t('player.wordcloud.send', 'Enviar'),
        upTo: t('player.wordcloud.up_to', 'Puedes enviar hasta {n} palabras'),
        done: t('player.wordcloud.done', 'Palabras enviadas')
    };
}

function entryHtml() {
    return window.XiroWordCloudView.inputHtml({
        maxWords: getWordCloudMaxWords(),
        sentWords: [],
        labels: viewLabels()
    });
}

function bindForm() {
    const form = document.querySelector('[data-wc-form]');
    const inputs = document.querySelectorAll('[data-wc-input]');
    if (!form || inputs.length === 0) return;
    form.addEventListener('submit', event => {
        event.preventDefault();
        const values = Array.from(inputs, input => input.value);
        if (typeof window.enviarPalabrasNube === 'function') window.enviarPalabrasNube(values);
    });
    inputs[0].focus();
}

/** Aviso bajo el campo (palabra repetida, no permitida…); texto vacío lo borra. */
export function showWordCloudNotice(notice) {
    const element = document.querySelector('[data-wc-notice]');
    if (element) element.textContent = notice ? t(notice.key, notice.fallback) : '';
}

/**
 * Tras enviar, sustituye las casillas por la nube en directo (la de la respuesta al enviar; las
 * siguientes llegan por el evento word-cloud-update).
 * @param {{words: Array, total?: number}|undefined} cloud - Nube actual, si el servidor la mandó
 */
export function showWordCloudAfterSending(cloud) {
    showWordCloudResult(cloud, { empty: t('player.wordcloud.empty', 'Nadie escribió palabras') });
}

/**
 * Pantalla de la pregunta «Nube de palabras».
 * @param {Object} pregunta - Pregunta saneada (question_text y max_words)
 */
export function renderizarPreguntaWordCloud(pregunta) {
    setHaRespondido(false);
    setCanAnswer(true);
    setCurrentSlideType('word_cloud');
    startWordCloud(pregunta.max_words);

    document.body.innerHTML = _tHtml(`
        <div class="h-dvh w-screen flex flex-col bg-slate-900 overflow-hidden">
            <div class="bg-plum-600 relative px-3 py-2 text-center shrink-0" data-player-timer-slot>
                <p class="text-white font-black text-base uppercase">${escapeHtml(getNickname())}</p>
            </div>
            <div class="bg-white p-4 border-b-8 border-plum-600 text-slate-800 text-center min-h-[12vh] max-h-[20vh] flex items-center justify-center shrink-0 overflow-y-auto">
                <h2 class="${getResponsiveFontClass(pregunta.question_text)} font-black italic hyphens-auto" lang="es">${escapeHtml(pregunta.question_text)}</h2>
            </div>
            <div class="flex-1 px-4 pt-6 pb-4 flex flex-col items-center justify-start overflow-y-auto">
                <div class="w-full flex flex-col items-center" data-wc-area>${entryHtml()}</div>
                <p class="wc-notice" data-wc-notice role="status" aria-live="polite"></p>
            </div>
        </div>
    `);
    bindForm();
}
