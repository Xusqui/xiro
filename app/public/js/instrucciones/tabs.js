/**
 * tabs.js
 * Script para gestionar la navegación por pestañas en la página de instrucciones.
 * Mantiene la modularidad y sencillez.
 */

document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    if (!tabBtns.length || !tabContents.length) return;

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Eliminar clase active de todos los botones y contenidos
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Añadir clase active al botón clickeado
            btn.classList.add('active');
            
            // Mostrar el contenido objetivo
            const targetId = btn.getAttribute('data-target');
            if (targetId) {
                const targetContent = document.getElementById(targetId);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            }
        });
    });

    // Sub-tabs navigation
    const subTabBtns = document.querySelectorAll('.sub-tab-btn');
    if (subTabBtns.length > 0) {
        subTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sub-tab-btn').forEach(b => {
                    b.classList.remove('active', 'font-bold');
                    b.style.backgroundColor = '';
                });
                document.querySelectorAll('.sub-tab-content').forEach(c => {
                    c.classList.remove('block');
                    c.classList.add('hidden');
                });
                btn.classList.add('active', 'font-bold');
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                const target = document.getElementById(btn.getAttribute('data-target'));
                if (target) {
                    target.classList.remove('hidden');
                    target.classList.add('block');
                }
            });
        });
    }
});
