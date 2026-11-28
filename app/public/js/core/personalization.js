// Insignia de personalización de interfaz (branding de evento, ej. logo de un
// patrocinador). Se inyecta como nodo fijo en document.body. Muchas pantallas
// (jugador, remoto del presentador) hacen document.body.innerHTML = ... en cada
// transición, lo que borra cualquier nodo añadido a mano; un MutationObserver
// reinyecta la insignia cada vez que desaparece, sin tocar cada punto de render.
// Ver también /js/core/site-badge.js (mismo patrón, esquina superior izquierda).
(function () {
    'use strict';

    const HOST_ID = 'xiro-personalization-badge';
    let filename = null;

    // Posición por página: el jugador la lleva en el móvil (arriba centrado, lejos
    // del área de respuesta), presentador/TV la llevan abajo a la derecha (la
    // esquina superior derecha la ocupa la barra de jugadores conectados / el PIN),
    // y el resto (menú, standalone) usa la esquina superior derecha por defecto.
    // En el jugador iba arriba al centro con 60 px de alto y tapaba el enunciado:
    // ahora va pequeña en la esquina de la barra del nombre. En presentador/TV se
    // queda por debajo de los controles (z-index bajo) para no tapar «Siguiente».
    function _resolvePosition() {
        const path = location.pathname;
        if (/\/(jugador|juego-concluido)\.html$/.test(path)) {
            const maxHeight = _fluid('8vmin', 'clamp(24px, 8vmin, 48px)');
            return { top: '4px', right: '8px', maxHeight: maxHeight, zIndex: '40' };
        }
        if (/\/(presentador|tv|juego-finalizado-presentador)\.html$/.test(path)) {
            return { bottom: '10px', right: '10px', zIndex: '40' };
        }
        return { top: '10px', right: '10px' };
    }

    // Tamaño relativo al viewport para que el logo escale con la resolución
    // (antes eran píxeles fijos: diminuto en pantallas grandes). El navegador
    // que no entienda clamp() (webOS 3.5 en tv.html) se queda con el valor en
    // unidades vmin/vw, que sí soporta; por eso se devuelven los dos valores.
    function _fluid(plain, clamped) {
        return { plain: plain, clamped: clamped };
    }

    function _applySize(style, prop, size) {
        style[prop] = size.plain;
        style[prop] = size.clamped;
    }

    function buildHost() {
        const host = document.createElement('div');
        host.id = HOST_ID;
        host.style.position = 'fixed';
        _applySize(host.style, 'maxWidth', _fluid('16vmin', 'clamp(80px, 16vmin, 480px)'));
        host.style.zIndex = '2147483000';
        host.style.pointerEvents = 'none';

        const pos = _resolvePosition();
        const heightSize = pos.maxHeight || _fluid('7vmin', 'clamp(32px, 7vmin, 200px)');
        Object.keys(pos).forEach(function (prop) {
            if (prop !== 'maxHeight') host.style[prop] = pos[prop];
        });
        _applySize(host.style, 'maxHeight', heightSize);

        const img = document.createElement('img');
        img.src = '/images/personalizations/' + encodeURIComponent(filename);
        img.alt = 'Logo';
        img.style.maxWidth = '100%';
        _applySize(img.style, 'maxHeight', heightSize);
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.display = 'block';
        // Halo de neón blanco: drop-shadow sigue la silueta del logo (no el
        // recuadro), así que funciona bien con PNG/SVG con fondo transparente.
        img.style.filter =
            'drop-shadow(0 0 4px #fff) drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(255,255,255,0.6))';
        img.onerror = function () {
            host.remove();
        };

        host.appendChild(img);
        return host;
    }

    function ensureBadge() {
        if (!filename || document.getElementById(HOST_ID)) return;
        document.body.appendChild(buildHost());
    }

    function start() {
        fetch('/api/ui-settings')
            .then(function (res) {
                return res.json();
            })
            .then(function (s) {
                if (s.personalizationEnabled !== true || !s.personalizationImage) return;
                filename = s.personalizationImage;
                ensureBadge();
                new MutationObserver(ensureBadge).observe(document.body, { childList: true });
            })
            .catch(function () {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
