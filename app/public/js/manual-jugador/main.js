import { getTabUnirseHTML } from './tab-unirse.js?v=20260823152650';
import { getTabResponderHTML } from './tab-responder.js?v=20260823152650';
import { getTabPuntuacionHTML } from './tab-puntuacion.js?v=20260823152650';
import { getTabTrivialHTML } from './tab-trivial.js?v=20260823152650';

let _activeTarget = 'tab-unirse';

function renderContent(targetId) {
    const contentContainer = document.getElementById('manual-content-container');
    if (!contentContainer) return;

    contentContainer.innerHTML = '';
    let htmlContent = '';

    switch (targetId) {
        case 'tab-unirse':      htmlContent = getTabUnirseHTML(); break;
        case 'tab-responder':   htmlContent = getTabResponderHTML(); break;
        case 'tab-puntuacion':  htmlContent = getTabPuntuacionHTML(); break;
        case 'tab-trivial':     htmlContent = getTabTrivialHTML(); break;
        default:                htmlContent = getTabUnirseHTML();
    }

    contentContainer.innerHTML = htmlContent;
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _activeTarget = btn.getAttribute('data-target');
            renderContent(_activeTarget);
        });
    });

    const initialBtn = document.querySelector('.tab-btn.active');
    if (initialBtn) {
        _activeTarget = initialBtn.getAttribute('data-target');
        renderContent(_activeTarget);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
});

window.addEventListener('xiro:language-changed', () => {
    renderContent(_activeTarget);
});
