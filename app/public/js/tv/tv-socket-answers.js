window.TVApp = window.TVApp || {};
window.TVApp.SocketAnswers = (function () {
    'use strict';

    var getEl = window.TVApp.Utils.getEl;
    var debounceUpdate = window.TVApp.Utils.debounceUpdate;
    var updatePlayersPanel = window.TVApp.RenderPlayers.updatePlayersPanel;
    var updateAnswerCounter = window.TVApp.RenderPlayers.updateAnswerCounter;
    var stopQuestionAudio = window.TVApp.Audio.stopQuestionAudio;
    var formatToleranceLabel = window.TVApp.Tolerance.formatToleranceLabel;

    function initAnswersSocket() {
        var socket = window.TVApp.socket;
        var state = window.TVApp.State;

        if (!socket) {
            console.error('Socket no inicializado');
            return;
        }

        socket.on('answer-result', function (data) {
            if (!data || !data.nickname) return;
            var nick = data.nickname;
            if (state.playersData[nick]) {
                state.playersData[nick].answered = true;
                state.playersData[nick].correct = data.isCorrect;
                if (typeof data.totalScore === 'number') {
                    state.playersData[nick].score = data.totalScore;
                }
                debounceUpdate(updatePlayersPanel);
                updateAnswerCounter();
            }
        });

        socket.on('answer-result-batch', function (data) {
            if (!data || !data.answers || !Array.isArray(data.answers)) return;
            for (var i = 0; i < data.answers.length; i++) {
                var answer = data.answers[i];
                if (answer.nickname && state.playersData[answer.nickname]) {
                    state.playersData[answer.nickname].answered = true;
                    state.playersData[answer.nickname].correct = answer.isCorrect;
                    if (typeof answer.totalScore === 'number') {
                        state.playersData[answer.nickname].score = answer.totalScore;
                    }
                }
            }
            debounceUpdate(updatePlayersPanel);
            updateAnswerCounter();
        });

        socket.on('ranking-update', function (data) {
            if (data.ranking) {
                for (var i = 0; i < data.ranking.length; i++) {
                    var player = data.ranking[i];
                    if (state.playersData[player.nickname]) {
                        state.playersData[player.nickname].score = player.score;
                    }
                }
                debounceUpdate(updatePlayersPanel);
            }
        });

        socket.on('reveal-answer', function (data) {
            if (data.stopAudio) stopQuestionAudio();
            window.TVApp.RenderSlides.resetTimers(); // Detiene timer

            if (data.ranking) {
                for (var i = 0; i < data.ranking.length; i++) {
                    var player = data.ranking[i];
                    if (state.playersData[player.name]) state.playersData[player.name].score = player.pts;
                }
            }
            for (var nick in state.playersData) {
                if (!state.playersData[nick].answered) state.playersData[nick].correct = false;
            }
            debounceUpdate(updatePlayersPanel);

            var cq = state.currentQuestion;

            if (cq && cq.question_type === 'numeric_approximation') {
                var revealCorrectAnswer = (cq.correct_answer !== undefined && cq.correct_answer !== null)
                    ? cq.correct_answer : (data.correctAnswer !== undefined && data.correctAnswer !== null ? data.correctAnswer : '?');
                var revealMaxPoints = (cq.max_points !== undefined && cq.max_points !== null)
                    ? cq.max_points : (data.maxPoints !== undefined && data.maxPoints !== null ? data.maxPoints : 0);
                var toleranceLabel = formatToleranceLabel(revealCorrectAnswer, cq, data);

                var numHTML = '<div style="background:rgba(34,197,94,0.15);padding:30px 20px;border-radius:15px;margin:20px 0;border:3px solid #22c55e">';
                numHTML += '<div style="text-align:center"><div style="font-size:16px;color:rgba(255,255,255,0.7);margin-bottom:15px">✅ RESPUESTA CORRECTA</div>';
                numHTML += '<div style="font-size:56px;font-weight:bold;color:#22c55e;margin:15px 0">' + revealCorrectAnswer + '</div>';
                if (data.stats) {
                    numHTML += '<div style="font-size:14px;color:rgba(255,255,255,0.6);margin-top:15px">Rango de tolerancia: ' + toleranceLabel + '</div>';
                    numHTML += '<div style="font-size:14px;color:rgba(255,255,255,0.6);margin-top:6px">Puntos máximos: ' + revealMaxPoints + '</div>';
                }
                if (data.ranking && data.ranking.length > 0) {
                    numHTML += '<div style="margin-top:25px;border-top:2px solid rgba(34,197,94,0.3);padding-top:20px">';
                    numHTML += '<div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:10px">📊 RESPUESTAS REGISTRADAS</div>';
                    for (var i = 0; i < Math.min(5, data.ranking.length); i++) {
                        var p = data.ranking[i];
                        var pts = p.pts || 0;
                        numHTML += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(34,197,94,0.2)">';
                        numHTML += '<span style="font-size:14px">' + (i + 1) + '. ' + p.name + '</span><span style="font-size:14px;font-weight:bold;color:#' + (pts > 0 ? '22c55e' : 'ef4444') + '">' + pts + ' pts</span></div>';
                    }
                    numHTML += '</div>';
                }
                numHTML += '</div></div>';
                var mainC = getEl('main-container');
                if (mainC) {
                    var ansSec = mainC.querySelector('#numeric-placeholder');
                    if (ansSec) ansSec.outerHTML = numHTML;
                    else { var tb = getEl('btn-next'); if (tb) tb.insertAdjacentHTML('beforebegin', _tHtml(numHTML)); }
                }

            } else if (cq && cq.question_type === 'word_scramble') {
                var revealWord = (data.correctWord || (cq && cq.correct_word) || '').toUpperCase();
                var mainC2 = getEl('main-container');
                if (mainC2) {
                    var wsP = mainC2.querySelector('#word-scramble-placeholder') || mainC2.querySelector('#ws-tv-boxes');
                    var wsHTML = '<div style="background:rgba(245,158,11,0.15);padding:30px 20px;border-radius:15px;margin:20px 0;border:3px solid #f59e0b;text-align:center">';
                    wsHTML += '<div style="font-size:16px;color:rgba(255,255,255,0.7);margin-bottom:15px">✅ RESPUESTA CORRECTA</div>';
                    wsHTML += '<div style="font-size:52px;font-weight:bold;color:#fbbf24;letter-spacing:0.2em;margin:15px 0">' + revealWord + '</div>';
                    if (data.ranking && data.ranking.length > 0) {
                        wsHTML += '<div style="margin-top:20px;border-top:2px solid rgba(245,158,11,0.3);padding-top:15px">';
                        for (var j = 0; j < Math.min(5, data.ranking.length); j++) {
                            var p2 = data.ranking[j];
                            var pts2 = p2.pts || 0;
                            wsHTML += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(245,158,11,0.2)">';
                            wsHTML += '<span>' + (j + 1) + '. ' + p2.name + '</span><span style="font-weight:bold;color:#' + (pts2 > 0 ? 'fbbf24' : 'ef4444') + '">' + pts2 + ' pts</span></div>';
                        }
                        wsHTML += '</div>';
                    }
                    wsHTML += '</div>';
                    if (wsP) wsP.outerHTML = wsHTML;
                    else { var tb2 = getEl('btn-next'); if (tb2) tb2.insertAdjacentHTML('beforebegin', _tHtml(wsHTML)); }
                }
            } else {
                var optCount = document.querySelectorAll('#options-grid > div').length;
                for (var k = 0; k < optCount; k++) {
                    var tarjeta = getEl('opt-' + k);
                    if (!tarjeta) continue;
                    var votos = (data.stats && data.stats[k]) ? data.stats[k] : 0;
                    var vDiv = document.createElement('div');
                    vDiv.className = 'option-votes';
                    if (data.percentages) {
                        vDiv.textContent = _t('📊 ' + (data.percentages[k] ? data.percentages[k].percentage : 0) + '%');
                    } else {
                        vDiv.textContent = _t('👤👤 ' + votos);
                        if (data.correctIndices && Array.isArray(data.correctIndices)) {
                            if (data.correctIndices.indexOf(k) !== -1) {
                                tarjeta.className += ' option-correct';
                                var cDiv = document.createElement('div');
                                cDiv.className = 'option-check'; cDiv.textContent = _t('✓');
                                tarjeta.appendChild(cDiv);
                            } else tarjeta.className += ' option-incorrect';
                        } else if (data.correctIndex !== undefined) {
                            if (k === data.correctIndex) {
                                tarjeta.className += ' option-correct';
                                var cDiv2 = document.createElement('div');
                                cDiv2.className = 'option-check'; cDiv2.textContent = _t('✓');
                                tarjeta.appendChild(cDiv2);
                            } else tarjeta.className += ' option-incorrect';
                        }
                    }
                    tarjeta.appendChild(vDiv);
                }
                var afterHTML = '';
                if (data.justification && data.justification.trim()) {
                    afterHTML += '<div class="justification"><div class="justification-title">💡 ¿Por qué es correcta?</div><div class="justification-text">' + data.justification + '</div></div>';
                }
                if (data.ranking && data.ranking.length > 0 && !data.percentages && !data.isSurvey) {
                    var rankHTML = '<div class="ranking-box"><div class="ranking-title">🏆 TOP 5</div>';
                    for (var r = 0; r < Math.min(5, data.ranking.length); r++) {
                        var rp = data.ranking[r];
                        rankHTML += '<div class="ranking-item ' + (r === 0 ? 'ranking-item-first' : '') + '"><table><tr><td><strong>' + (r + 1) + '. ' + rp.name + '</strong></td><td>' + rp.pts + '</td></tr></table></div>';
                    }
                    rankHTML += '</div>';
                    afterHTML += rankHTML;
                }
                var optGrid = getEl('options-grid');
                if (optGrid) optGrid.insertAdjacentHTML('afterend', _tHtml(afterHTML));
            }

            var nextBtn = getEl('btn-next');
            if (nextBtn) nextBtn.classList.remove('hidden');
        });
    }

    return {
        initAnswersSocket: initAnswersSocket
    };
})();
