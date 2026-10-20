/**
 * @fileoverview Renderiza preguntas tipo "fill_blanks" (Completa la frase) en Standalone.
 * Contrato: { answerType:'fill_blanks', words: ['PALABRA', '', …] } — una palabra por hueco.
 * Misma interacción que player-fillblanks-ui.js: la frase con una casilla por letra, un
 * <input> invisible por hueco, pistas que destapan letras (la palabra pasa a valer
 * 70/40/25 %) y un único envío. Sin equipos. Como en individual, si se agota el tiempo
 * sin enviar no hay puntos (no se envía solo).
 */

'use strict';

globalThis.StandaloneQuestionFillBlanks = (() => {
    const { escapeHtml, submitAnswer } = StandaloneQuestionCommon;
    const HINT_COSTS = [30, 60, 75];
    const MAX_HINTS = 3;
    let lastText = '';

    function _t(key, fallback, vars) {
        const value = window.XiroI18n?.t(key, vars, fallback);
        return value && value !== key
            ? value
            : fallback.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
    }

    function hintButtonHtml(i, used) {
        const exhausted = used >= MAX_HINTS;
        const label = exhausted
            ? _t('standalone.game.fillblanks_hint_none', 'Sin pistas')
            : _t('standalone.game.fillblanks_hint_cost', 'Pista −{pct} %', { pct: HINT_COSTS[used] });
        return `<button type="button" class="fb-hint-btn" data-hint="${i}" ${exhausted ? 'disabled' : ''}>
            <span class="fb-hint-btn__num">${i + 1}</span><span>${escapeHtml(label)}</span></button>`;
    }

    function render(container, question, { onSubmitted }) {
        const FB = window.XiroFillBlanks;
        const lengths = Array.isArray(question.fb_lengths) ? question.fb_lengths : [];
        const model = { typed: lengths.map(() => ''), fixed: lengths.map(() => ({})), hints: lengths.map(() => 0) };
        let sent = false;
        lastText = question.question_text || '';

        container.innerHTML = `
            <div class="pl-viewport">
                <div class="pl-nickname-bar"><p>${escapeHtml(StandaloneState.get().nickname)}</p></div>
                <div class="pl-question-panel fb-question"><h2>${_t('standalone.game.fillblanks_title', 'Completa la frase')}</h2></div>
                <div class="fb-play">
                    <div class="fb-play__card">${FB.sanitizeSentenceHtml(lastText, lengths, { sizeClass: 'fb-sentence--player' })}</div>
                    <p class="fb-play__help">${_t('standalone.game.fillblanks_help', 'Toca un hueco y escribe la palabra. Envía cuando tengas todas las que sepas.')}</p>
                    <div class="fb-hints">${lengths.map((_, i) => hintButtonHtml(i, 0)).join('')}</div>
                </div>
                <div class="pl-submit-bar">
                    <button type="button" class="pl-submit-btn" data-standalone-action="submit-fillblanks">
                        <i class="fas fa-paper-plane"></i> ${_t('standalone.game.submit', 'Enviar respuesta')}
                    </button>
                </div>
            </div>
        `;

        const freeCount = i => lengths[i] - Object.keys(model.fixed[i]).length;
        const merged = i => FB.mergeLetters(lengths[i], model.fixed[i], model.typed[i]);
        const isComplete = i => model.typed[i].length === freeCount(i);

        /** Foco en el siguiente hueco sin completar desde `from`; sin ninguno, suelta el teclado */
        function focusNextOpenBlank(from) {
            for (let step = 0; step < lengths.length; step++) {
                const i = (from + step) % lengths.length;
                const input = container.querySelector(`.fb-blank[data-blank="${i}"] .fb-input`);
                if (!isComplete(i) && input && !input.disabled) {
                    input.focus();
                    return;
                }
            }
            if (document.activeElement?.classList.contains('fb-input')) document.activeElement.blur();
        }

        function renderBlank(i) {
            const blank = container.querySelector(`.fb-blank[data-blank="${i}"]`);
            if (!blank) return;
            const letters = merged(i);
            const active = letters.findIndex((letter, pos) => !letter && !model.fixed[i][pos]);
            blank.querySelectorAll('.fb-cell').forEach((cell, pos) => {
                cell.textContent = letters[pos] || '';
                cell.classList.toggle('fb-cell--filled', Boolean(letters[pos]) && !model.fixed[i][pos]);
                cell.classList.toggle('fb-cell--hint', Boolean(model.fixed[i][pos]));
                cell.classList.toggle('fb-cell--active', pos === active);
            });
            const input = blank.querySelector('.fb-input');
            if (input) {
                input.maxLength = Math.max(1, freeCount(i));
                input.value = model.typed[i];
            }
            const button = container.querySelector(`.fb-hint-btn[data-hint="${i}"]`);
            if (button) button.outerHTML = hintButtonHtml(i, model.hints[i]);
        }

        container.querySelectorAll('.fb-blank').forEach(blank => {
            const i = Number(blank.dataset.blank);
            const input = document.createElement('input');
            input.className = 'fb-input';
            input.type = 'text';
            input.autocomplete = 'off';
            input.autocapitalize = 'characters';
            input.spellcheck = false;
            input.setAttribute('aria-label', _t('standalone.game.fillblanks_blank_aria', 'Hueco {n}', { n: i + 1 }));
            blank.appendChild(input);
            input.addEventListener('input', () => {
                model.typed[i] = input.value
                    .replace(/[^A-Za-zÀ-ɏ]/g, '')
                    .toUpperCase()
                    .slice(0, freeCount(i));
                renderBlank(i);
                // Palabra completa: seguir escribiendo en el siguiente hueco
                if (isComplete(i)) focusNextOpenBlank(i + 1);
            });
            input.addEventListener('focus', () => blank.classList.add('fb-blank--focus'));
            input.addEventListener('blur', () => blank.classList.remove('fb-blank--focus'));
            blank.addEventListener('click', () => input.focus());
            renderBlank(i);
        });

        container.querySelector('.fb-hints').addEventListener('click', async event => {
            const button = event.target.closest('.fb-hint-btn');
            if (!button || button.disabled || sent) return;
            const i = Number(button.dataset.hint);
            button.disabled = true;
            const ack = await StandaloneSocket.requestFillBlanksHint(i);
            if (!ack || !ack.ok) {
                renderBlank(i);
                return;
            }
            // La letra tecleada que ocupaba esa posición se retira (no se desplaza)
            if (!model.fixed[i][ack.position]) {
                model.typed[i] = FB.dropTypedAt(lengths[i], model.fixed[i], model.typed[i], ack.position);
            }
            model.fixed[i][ack.position] = ack.letter;
            model.hints[i] = ack.hintCount;
            model.typed[i] = model.typed[i].slice(0, freeCount(i));
            renderBlank(i);
            if (isComplete(i)) focusNextOpenBlank(i + 1);
        });

        async function send() {
            if (sent || StandaloneState.get().currentQuestion !== question) return;
            sent = true;
            container.querySelectorAll('button, input').forEach(el => {
                el.disabled = true;
            });
            const ack = await submitAnswer({ words: lengths.map((_, i) => merged(i).join('')) }, 'fill_blanks');
            if (ack && ack.ok === false) {
                sent = false;
                StandaloneState.get().answered = false;
                container.querySelectorAll('button, input').forEach(el => {
                    el.disabled = false;
                });
                return;
            }
            onSubmitted();
        }

        container.querySelector('[data-standalone-action="submit-fillblanks"]').addEventListener('click', send);

        // Empezar a escribir sin tocar nada: foco en el primer hueco
        focusNextOpenBlank(0);
    }

    /** Frase completa con cada hueco en verde o rojo (resultado) */
    function sentenceHtml(details) {
        if (!lastText || !window.XiroFillBlanks) return '';
        const states = (details.blanksCorrect || []).map(ok => (ok ? 'fb-blank--ok' : 'fb-blank--ko'));
        return `<div class="fb-result__sentence">${window.XiroFillBlanks.sanitizeSentenceHtml(lastText, details.lengths || [], { letters: details.words || [], states, sizeClass: 'fb-sentence--player' })}</div>`;
    }

    /** Mensaje de la pantalla de resultado (lo usa standalone-reveal.js). */
    function resultMessage(data, pointsPill) {
        const details = data.fillBlanksDetails || {};
        const total = details.totalBlanks || (details.words || []).length;
        const summary = _t('standalone.game.fillblanks_correct', '{n} de {total} palabras', {
            n: details.correctCount || 0,
            total
        });
        const rows = (details.words || [])
            .map((word, i) => {
                const ok = Boolean(details.blanksCorrect?.[i]);
                const given =
                    !ok && details.given?.[i]
                        ? `<span class="fb-result__given">${escapeHtml(details.given[i])}</span>`
                        : '';
                return `<div class="fb-result__row"><span><i class="fas ${ok ? 'fa-check' : 'fa-times'}"></i> ${escapeHtml(word)} ${given}</span><span>+${details.wordPoints?.[i] || 0}</span></div>`;
            })
            .join('');
        return `
            <i class="fas fa-i-cursor pl-reveal-icon"></i>
            <h2>${escapeHtml(summary)}</h2>
            ${sentenceHtml(details)}
            <div style="display:flex;flex-direction:column;gap:6px;margin:12px 0;">${rows}</div>
            ${pointsPill(data.points)}
        `;
    }

    /** Color del resultado: verde con todo, azul con la mitad o más, rojo con menos (null si no es fill_blanks) */
    function resultColor(data) {
        const details = data.fillBlanksDetails;
        if (!details) return null;
        if (details.totalBlanks > 0 && details.correctCount === details.totalBlanks) return 'bg-green-500';
        return data.correct ? 'bg-blue-500' : 'bg-red-500';
    }

    /** Frase completa en la pantalla de tiempo agotado (payload fillBlanks del reveal) */
    function revealSentence(fillBlanks) {
        if (!fillBlanks || !Array.isArray(fillBlanks.words) || !window.XiroFillBlanks) return '';
        const states = fillBlanks.words.map(() => 'fb-blank--ok');
        return `<div class="fb-result__sentence" style="margin:12px 0;">${window.XiroFillBlanks.sanitizeSentenceHtml(fillBlanks.text, fillBlanks.lengths || [], { letters: fillBlanks.words, states, sizeClass: 'fb-sentence--player' })}</div>`;
    }

    return { render, resultMessage, resultColor, revealSentence };
})();
