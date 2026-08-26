import { getTabUnirseHTML } from './tab-unirse.js?v=20260826110354';
import { getTabResponderHTML } from './tab-responder.js?v=20260826110354';
import { getTabPuntuacionHTML } from './tab-puntuacion.js?v=20260826110354';
import { getTabTrivialHTML } from './tab-trivial.js?v=20260826110354';

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
    const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
    const panel = document.getElementById('manual-content-container');

    function activate(btn, options) {
        const focusBtn = options && options.focus;
        tabBtns.forEach(b => {
            const isActive = b === btn;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-selected', String(isActive));
            b.tabIndex = isActive ? 0 : -1;
        });
        if (panel) panel.setAttribute('aria-labelledby', btn.id);
        _activeTarget = btn.getAttribute('data-target');
        renderContent(_activeTarget);
        if (focusBtn) btn.focus();
    }

    tabBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => activate(btn));

        btn.addEventListener('keydown', (event) => {
            let targetIndex = null;
            if (event.key === 'ArrowRight') targetIndex = (index + 1) % tabBtns.length;
            else if (event.key === 'ArrowLeft') targetIndex = (index - 1 + tabBtns.length) % tabBtns.length;
            else if (event.key === 'Home') targetIndex = 0;
            else if (event.key === 'End') targetIndex = tabBtns.length - 1;
            if (targetIndex === null) return;
            event.preventDefault();
            activate(tabBtns[targetIndex], { focus: true });
        });
    });

    const initialBtn = document.querySelector('.tab-btn.active') || tabBtns[0];
    if (initialBtn) activate(initialBtn);
}

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
});

window.addEventListener('xiro:language-changed', () => {
    renderContent(_activeTarget);
});
