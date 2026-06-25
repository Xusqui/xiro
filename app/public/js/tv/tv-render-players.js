window.TVApp = window.TVApp || {};
window.TVApp.RenderPlayers = (function () {
    'use strict';

    var getEl = window.TVApp.Utils.getEl;
    var escapeHtml = window.TVApp.Utils.escapeHtml;

    function tText(value) {
        if (typeof window._t === 'function') {
            return window._t(value);
        }

        if (window.XiroI18n && typeof window.XiroI18n.tSmart === 'function') {
            var raw = value == null ? '' : String(value);
            return window.XiroI18n.tSmart(raw, null, raw);
        }

        return value == null ? '' : String(value);
    }

    function tHtml(value) {
        if (typeof window._tHtml === 'function') {
            return window._tHtml(value);
        }

        if (window.XiroI18n && typeof window.XiroI18n.tHtml === 'function') {
            return window.XiroI18n.tHtml(value);
        }

        return value == null ? '' : String(value);
    }

    function updatePlayersPanel() {
        var state = window.TVApp.State;
        var panel = getEl('sidebar-list');
        if (!panel) return;
        var count = getEl('sidebar-count');
        if (count) count.textContent = tText(state.connectedPlayers.length);

        if (state.connectedPlayers.length === 0) {
            panel.innerHTML = tHtml('<div style="color:#999;font-style:italic;text-align:center;padding:20px 10px;font-size:11px">Esperando jugadores...</div>');
        } else {
            var sorted = state.connectedPlayers.slice().sort(function (a, b) {
                var scoreA = state.playersData[a] ? state.playersData[a].score : 0;
                var scoreB = state.playersData[b] ? state.playersData[b].score : 0;
                return scoreB - scoreA;
            });
            var html = '';
            for (var i = 0; i < sorted.length; i++) {
                var nick = sorted[i];
                var data = state.playersData[nick] || { score: 0, answered: false, correct: null };
                var statusIcon = '⏱';
                var statusClass = '';
                if (data.correct === true) {
                    statusIcon = '✅';
                    statusClass = ' style="background-color:rgba(22,163,74,0.3)"';
                } else if (data.correct === false) {
                    statusIcon = '❌';
                    statusClass = ' style="background-color:rgba(220,38,38,0.3)"';
                }
                var medal = '';
                if (i === 0 && data.score > 0) medal = '👑 ';
                else if (i === 1 && data.score > 0) medal = '🥈 ';
                else if (i === 2 && data.score > 0) medal = '🥉 ';
                html += '<div class="sidebar-player"' + statusClass + '><div class="sidebar-player-name">' + statusIcon + ' ' + medal + escapeHtml(nick) + '</div><div class="sidebar-player-score">Puntos: ' + data.score.toFixed(1) + '</div></div>';
            }
            panel.innerHTML = tHtml(html);
        }
    }

    function updateAnswerCounter() {
        var state = window.TVApp.State;
        var ansCountEl = getEl('ans-count');
        if (!ansCountEl) return;

        var answeredCount = 0;
        for (var nick in state.playersData) {
            if (state.playersData[nick].answered === true) {
                answeredCount++;
            }
        }

        ansCountEl.textContent = tText(answeredCount);

        var ansTotalEl = getEl('ans-total');
        if (ansTotalEl) ansTotalEl.textContent = tText(Object.keys(state.playersData).length);
    }

    return {
        updatePlayersPanel: updatePlayersPanel,
        updateAnswerCounter: updateAnswerCounter
    };
})();
