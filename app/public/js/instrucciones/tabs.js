/**
 * tabs.js
 * Script para gestionar la navegación por pestañas en la página de instrucciones.
 * Mantiene la modularidad y sencillez.
 */

document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    if (!tabBtns.length || !tabContents.length) return;

    function selectTab(btn) {
        // Eliminar clase active de todos los botones y contenidos
        tabBtns.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
            b.setAttribute('tabindex', '-1');
        });
        tabContents.forEach(c => {
            c.classList.remove('active');
            c.setAttribute('aria-hidden', 'true');
        });

        // Añadir clase active al botón clickeado
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        btn.setAttribute('tabindex', '0');

        // Mostrar el contenido objetivo
        const targetId = btn.getAttribute('data-target');
        if (targetId) {
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.setAttribute('aria-hidden', 'false');
            }
        }
    }

    tabBtns.forEach((btn, i) => {
        btn.addEventListener('click', () => selectTab(btn));
        btn.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const next = tabBtns[(i + (e.key === 'ArrowRight' ? 1 : tabBtns.length - 1)) % tabBtns.length];
            next.focus();
            selectTab(next);
        });
    });

    // Sub-tabs navigation
    const subTabBtns = document.querySelectorAll('.sub-tab-btn');
    if (subTabBtns.length > 0) {
        const subTabContents = document.querySelectorAll('.sub-tab-content');

        const selectSubTab = (btn) => {
            subTabBtns.forEach(b => {
                b.classList.remove('active', 'font-bold');
                b.style.backgroundColor = '';
                b.setAttribute('aria-selected', 'false');
                b.setAttribute('tabindex', '-1');
            });
            subTabContents.forEach(c => {
                c.classList.remove('block');
                c.classList.add('hidden');
                c.setAttribute('aria-hidden', 'true');
            });
            btn.classList.add('active', 'font-bold');
            btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            btn.setAttribute('aria-selected', 'true');
            btn.setAttribute('tabindex', '0');
            const target = document.getElementById(btn.getAttribute('data-target'));
            if (target) {
                target.classList.remove('hidden');
                target.classList.add('block');
                target.setAttribute('aria-hidden', 'false');
            }
        };

        subTabBtns.forEach((btn, i) => {
            btn.addEventListener('click', () => selectSubTab(btn));
            btn.addEventListener('keydown', (e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault();
                const next = subTabBtns[(i + (e.key === 'ArrowRight' ? 1 : subTabBtns.length - 1)) % subTabBtns.length];
                next.focus();
                selectSubTab(next);
            });
        });
    }
});
