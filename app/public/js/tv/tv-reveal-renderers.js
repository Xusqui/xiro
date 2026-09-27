window.TVApp = window.TVApp || {};
/**
 * Pintado del "reveal" de la TV según el tipo de pregunta: numérica, anagrama
 * o de opciones (quiz, encuesta, múltiple…). Lo usa tv-socket-answers.js.
 */
window.TVApp.RevealRenderers = (function () {
    'use strict';

    const getEl = window.TVApp.Utils.getEl;
    const escapeHtml = window.TVApp.Utils.escapeHtml;
    const formatToleranceLabel = window.TVApp.Tolerance.formatToleranceLabel;

    const TOP_N = 5;

    /**
     * Sustituye el placeholder de la respuesta por `html` o, si no existe,
     * lo inserta antes del botón "siguiente".
     */
    function insertRevealBlock(placeholder, html) {
        if (placeholder) {
            placeholder.outerHTML = html;
            return;
        }
        const nextBtn = getEl('btn-next');
        if (nextBtn) nextBtn.insertAdjacentHTML('beforebegin', _tHtml(html));
    }

    function pointsColor(pts, positiveHex) {
        return pts > 0 ? positiveHex : 'ef4444';
    }

    function numericRankingHtml(ranking) {
        if (!ranking || ranking.length === 0) return '';
        let html = '<div style="margin-top:25px;border-top:2px solid rgba(34,197,94,0.3);padding-top:20px">';
        html += '<div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:10px">📊 RESPUESTAS REGISTRADAS</div>';
        ranking.slice(0, TOP_N).forEach((p, i) => {
            const pts = p.pts || 0;
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(34,197,94,0.2)">';
            html += '<span style="font-size:14px">' + (i + 1) + '. ' + escapeHtml(p.name) + '</span><span style="font-size:14px;font-weight:bold;color:#' + pointsColor(pts, '22c55e') + '">' + pts + ' pts</span></div>';
        });
        return html + '</div>';
    }

    function renderNumericReveal(data, question) {
        const correctAnswer = question.correct_answer ?? data.correctAnswer ?? '?';
        const maxPoints = question.max_points ?? data.maxPoints ?? 0;

        let html = '<div style="background:rgba(34,197,94,0.15);padding:30px 20px;border-radius:15px;margin:20px 0;border:3px solid #22c55e">';
        html += '<div style="text-align:center"><div style="font-size:16px;color:rgba(255,255,255,0.7);margin-bottom:15px">✅ RESPUESTA CORRECTA</div>';
        html += '<div style="font-size:56px;font-weight:bold;color:#22c55e;margin:15px 0">' + escapeHtml(correctAnswer) + '</div>';
        if (data.stats) {
            const toleranceLabel = formatToleranceLabel(correctAnswer, question, data);
            html += '<div style="font-size:14px;color:rgba(255,255,255,0.6);margin-top:15px">Rango de tolerancia: ' + escapeHtml(toleranceLabel) + '</div>';
            html += '<div style="font-size:14px;color:rgba(255,255,255,0.6);margin-top:6px">Puntos máximos: ' + escapeHtml(maxPoints) + '</div>';
        }
        html += numericRankingHtml(data.ranking) + '</div></div>';

        const main = getEl('main-container');
        if (main) insertRevealBlock(main.querySelector('#numeric-placeholder'), html);
    }

    function wordScrambleRankingHtml(ranking) {
        if (!ranking || ranking.length === 0) return '';
        let html = '<div style="margin-top:20px;border-top:2px solid rgba(245,158,11,0.3);padding-top:15px">';
        ranking.slice(0, TOP_N).forEach((p, i) => {
            const pts = p.pts || 0;
            html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(245,158,11,0.2)">';
            html += '<span>' + (i + 1) + '. ' + escapeHtml(p.name) + '</span><span style="font-weight:bold;color:#' + pointsColor(pts, 'fbbf24') + '">' + pts + ' pts</span></div>';
        });
        return html + '</div>';
    }

    function renderWordScrambleReveal(data, question) {
        const main = getEl('main-container');
        if (!main) return;
        const word = (data.correctWord || question.correct_word || '').toUpperCase();

        let html = '<div style="background:rgba(245,158,11,0.15);padding:30px 20px;border-radius:15px;margin:20px 0;border:3px solid #f59e0b;text-align:center">';
        html += '<div style="font-size:16px;color:rgba(255,255,255,0.7);margin-bottom:15px">✅ RESPUESTA CORRECTA</div>';
        html += '<div style="font-size:52px;font-weight:bold;color:#fbbf24;letter-spacing:0.2em;margin:15px 0">' + escapeHtml(word) + '</div>';
        html += wordScrambleRankingHtml(data.ranking) + '</div>';

        insertRevealBlock(main.querySelector('#word-scramble-placeholder') || main.querySelector('#ws-tv-boxes'), html);
    }

    /** Marca la tarjeta de la opción `k` como correcta (con ✓) o incorrecta. */
    function markOptionCorrectness(tarjeta, k, data) {
        let isCorrect;
        if (Array.isArray(data.correctIndices)) isCorrect = data.correctIndices.indexOf(k) !== -1;
        else if (data.correctIndex !== undefined) isCorrect = k === data.correctIndex;
        else return;

        if (!isCorrect) {
            tarjeta.className += ' option-incorrect';
            return;
        }
        tarjeta.className += ' option-correct';
        const check = document.createElement('div');
        check.className = 'option-check';
        check.textContent = _t('✓');
        tarjeta.appendChild(check);
    }

    function addOptionVotes(tarjeta, k, data) {
        const votes = document.createElement('div');
        votes.className = 'option-votes';
        if (data.percentages) {
            votes.textContent = _t('📊 ' + (data.percentages[k] ? data.percentages[k].percentage : 0) + '%');
        } else {
            votes.textContent = _t('👤👤 ' + ((data.stats && data.stats[k]) || 0));
            markOptionCorrectness(tarjeta, k, data);
        }
        tarjeta.appendChild(votes);
    }

    function optionsRankingHtml(data) {
        if (!data.ranking || data.ranking.length === 0 || data.percentages || data.isSurvey) return '';
        let html = '<div class="ranking-box"><div class="ranking-title">🏆 TOP 5</div>';
        data.ranking.slice(0, TOP_N).forEach((p, i) => {
            html += '<div class="ranking-item ' + (i === 0 ? 'ranking-item-first' : '') + '"><table><tr><td><strong>' + (i + 1) + '. ' + escapeHtml(p.name) + '</strong></td><td>' + escapeHtml(p.pts) + '</td></tr></table></div>';
        });
        return html + '</div>';
    }

    function renderOptionsReveal(data) {
        const optCount = document.querySelectorAll('#options-grid > div').length;
        for (let k = 0; k < optCount; k++) {
            const tarjeta = getEl('opt-' + k);
            if (tarjeta) addOptionVotes(tarjeta, k, data);
        }

        let afterHtml = '';
        if (data.justification && data.justification.trim()) {
            afterHtml += '<div class="justification"><div class="justification-title">💡 ¿Por qué es correcta?</div><div class="justification-text">' + escapeHtml(data.justification) + '</div></div>';
        }
        afterHtml += optionsRankingHtml(data);

        const optGrid = getEl('options-grid');
        if (optGrid) optGrid.insertAdjacentHTML('afterend', _tHtml(afterHtml));
    }

    return {
        renderNumericReveal: renderNumericReveal,
        renderWordScrambleReveal: renderWordScrambleReveal,
        renderOptionsReveal: renderOptionsReveal
    };
})();
