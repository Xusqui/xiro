/* eslint-disable no-var -- ES5 a propósito: tv.html debe funcionar en WebOS 3.5 */
/*
 * Botón «Anterior» de la TV (juegos personalizados). Cuelga de body, no de
 * main-container, así que sobrevive a que cada diapositiva repinte la escena.
 * El servidor dice cuándo se puede retroceder (canGoBack en 'new-question' y
 * 'reveal-answer'); la acción data-tv-action="previous-slide" la atiende tv-actions.js.
 */
window.TVApp = window.TVApp || {};
window.TVApp.SlideNav = (function () {
    'use strict';

    var PREV_ID = 'btn-prev';

    function syncPrevButton(canGoBack) {
        var existing = document.getElementById(PREV_ID);
        if (!canGoBack) {
            if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
            return;
        }
        if (existing) return;

        var btn = document.createElement('button');
        btn.id = PREV_ID;
        btn.setAttribute('data-tv-action', 'previous-slide');
        btn.className = 'btn btn-secondary btn-prev';
        btn.appendChild(document.createTextNode('◀ Anterior'));
        document.body.appendChild(btn);
    }

    // Actividad revisada: solo lectura, sin el panel para asignar puntos
    function lockActivityPoints() {
        var panels = document.getElementsByClassName('manual-points');
        while (panels.length > 0) panels[0].parentNode.removeChild(panels[0]);
    }

    return {
        syncPrevButton: syncPrevButton,
        lockActivityPoints: lockActivityPoints
    };
})();
