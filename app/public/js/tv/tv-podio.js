window.TVApp = window.TVApp || {};
window.TVApp.Podio = (function () {
    'use strict';

    var getEl = window.TVApp.Utils.getEl;
    var clearCache = window.TVApp.Utils.clearCache;
    var escapeHtml = window.TVApp.Utils.escapeHtml;
    var languageRefreshBound = false;

    function tr(text) {
        if (typeof window.__ === 'function') return window.__(text);
        return String(text || '');
    }

    function buildFlickerWordHtml(word) {
        var chars = String(word || '').split('');
        if (chars.length === 0) return '';
        if (chars.length === 1) return '<span style="opacity:0.8">' + escapeHtml(chars[0]) + '</span>';
        if (chars.length === 2) {
            return '<span style="opacity:0.8">' + escapeHtml(chars[0]) + '</span>' + escapeHtml(chars[1]);
        }
        return '<span style="opacity:0.8">' + escapeHtml(chars[0]) + '</span>' + escapeHtml(chars[1]) + '<span style="opacity:0.6">' + escapeHtml(chars[2]) + '</span>' + escapeHtml(chars.slice(3).join(''));
    }

    function buildPodiumTitleHtml(title) {
        var clean = String(title || '').trim();
        if (!clean) return '';

        var words = clean.split(/\s+/);
        if (words.length === 1) return buildFlickerWordHtml(words[0]);

        var lastWord = words.pop();
        return escapeHtml(words.join(' ')) + ' ' + buildFlickerWordHtml(lastWord);
    }

    function refreshActivePodiumTitle() {
        var titleEl = document.querySelector('#main-container [data-xiro-tv-podium-title="1"]');
        if (!titleEl) return;

        var isTeamMode = titleEl.getAttribute('data-podium-team-mode') === 'true';
        var titleKey = isTeamMode ? 'Podio Equipos' : 'Podio Final';
        titleEl.innerHTML = _tHtml(buildPodiumTitleHtml(tr(titleKey)));
    }

    function bindLanguageRefresh() {
        if (languageRefreshBound) return;
        languageRefreshBound = true;
        window.addEventListener('xiro:language-changed', refreshActivePodiumTitle);
    }

    function renderPodio(ranking) {
        console.log('🎯 Renderizando podio en TV. Ranking:', ranking);
        if (!ranking || !ranking.length) return;

        bindLanguageRefresh();

        var isTeamMode = ranking[0].isTeam || ranking[0].teamName;

        var titleHtml = isTeamMode
            ? buildPodiumTitleHtml(tr('Podio Equipos'))
            : buildPodiumTitleHtml(tr('Podio Final'));

        var teamColors = {
            red: '#dc2626', blue: '#2563eb', green: '#16a34a',
            yellow: '#eab308', purple: '#9333ea', pink: '#db2777',
            orange: '#ea580c', cyan: '#0891b2', lime: '#84cc16'
        };

        var rowsHtml = '';
        var maxRows = Math.min(10, ranking.length);

        for (var i = 0; i < maxRows; i++) {
            var p = ranking[i];
            var isFirst = (i === 0 && !isTeamMode);

            var bg = 'rgba(255,255,255,0.1)';
            var color = '#fff';
            var transform = '';

            if (isTeamMode) {
                var cKey = p.color || 'blue';
                bg = teamColors[cKey] || 'rgba(255,255,255,0.1)';
            } else if (isFirst) {
                bg = '#fbbf24';
                color = '#0f172a';
                transform = 'scale(1.05)';
            }

            var scoreText = p.scoreLabel || (p.pts + ' PTS');
            var nameText = p.name || p.nickname || 'Jugador';

            rowsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-radius:24px;background:' + bg + ';color:' + color + ';margin-bottom:12px;transform:' + transform + ';box-shadow:0 4px 12px rgba(0,0,0,0.3);border-bottom:4px solid rgba(0,0,0,0.2)">';
            rowsHtml += '<span style="font-size:24px;font-weight:900;text-transform:uppercase;font-style:italic">' + (i + 1) + 'º ' + escapeHtml(nameText) + '</span>';
            rowsHtml += '<span style="font-size:28px;font-weight:900">' + escapeHtml(scoreText) + '</span>';
            rowsHtml += '</div>';
        }

        var mainHtml = '<div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;items-center;justify-content:start;text-align:center;padding:40px 80px;background:#0f172a;overflow-y:auto;z-index:10000">';
        mainHtml += '<h1 data-xiro-tv-podium-title="1" data-podium-team-mode="' + (isTeamMode ? 'true' : 'false') + '" style="font-size:64px;font-weight:900;color:#fff;margin-bottom:30px;text-transform:uppercase;letter-spacing:2px;text-shadow:0 0 20px rgba(255,255,255,0.3)">' + titleHtml + '</h1>';
        mainHtml += '<div style="width:100%;max-width:800px;margin:0 auto">' + rowsHtml + '</div>';
        mainHtml += '<button class="btn-next" data-tv-action="go-tv-home" style="margin-top:40px;padding:16px 40px;background:#7c3aed;color:#fff;border:none;border-radius:999px;font-size:20px;font-weight:bold;text-transform:uppercase;cursor:pointer;box-shadow:0 8px 20px rgba(124,58,237,0.4)">Volver a Selección</button>';
        mainHtml += '</div>';

        var container = getEl('main-container');
        if (container) {
            container.innerHTML = _tHtml(mainHtml);
            clearCache();
        }
    }

    return {
        renderPodio: renderPodio
    };
})();
