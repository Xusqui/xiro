window.TVApp = window.TVApp || {};
window.TVApp.TrvHighlights = (function () {
    'use strict';

    function showTrivialWinnerOverlay(ranking) {
        var existing = document.getElementById('trivial-winner-overlay');
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

        var overlay = document.createElement('div');
        overlay.id = 'trivial-winner-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.92);animation:fadeIn 0.5s ease;';

        var cardStyle = 'background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border:2px solid rgba(251,191,36,0.5);border-radius:24px;padding:64px 72px;max-width:560px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.7),0 0 60px rgba(251,191,36,0.15);display:flex;flex-direction:column;align-items:center;';
        var titleStyle = 'color:#fbbf24;font-size:48px;font-weight:900;letter-spacing:-0.5px;text-shadow:0 0 40px rgba(251,191,36,0.6);line-height:1.2;text-transform:uppercase;margin-top:28px;';
        var btnStyle = 'background:linear-gradient(135deg,#d97706,#fbbf24);color:#0f172a;border:none;border-radius:14px;padding:16px 48px;font-size:20px;font-weight:900;cursor:pointer;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(217,119,6,0.5);text-transform:uppercase;margin-top:20px;';

        window._tempRanking = ranking;
        overlay.innerHTML = _tHtml('<div style="' + cardStyle + '">' +
            '<div style="font-size:100px;line-height:1">\uD83C\uDFC6</div>' +
            '<div style="' + titleStyle + '">\u00A1TENEMOS GANADOR!</div>' +
            '<button class="btn-next" data-tv-action="render-podio" style="' + btnStyle + '">' + _t('presenter.game.view_ranking', null, 'Ver Ránking') + '</button>' +
            '</div>');

        document.body.appendChild(overlay);
    }

    function isWinnerOverlayActive() {
        return !!document.getElementById('trivial-winner-overlay');
    }

    function removeWinnerOverlay() {
        var el = document.getElementById('trivial-winner-overlay');
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    return {
        updateBoardHighlights: TrivialShared.updateBoardHighlights,
        showTurnOrderOverlay: TrivialShared.showTurnOrderOverlay,
        showTrivialWinnerOverlay: showTrivialWinnerOverlay,
        isWinnerOverlayActive: isWinnerOverlayActive,
        removeWinnerOverlay: removeWinnerOverlay
    };
})();
