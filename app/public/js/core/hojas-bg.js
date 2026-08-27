// Inyecta el SVG de hojas como nodo DOM real (no background-image) para que
// la animación CSS de sus grupos no se congele al navegar entre páginas en Safari.
(function () {
    function inject() {
        var layer = document.createElement('div');
        layer.className = 'hojas-bg-layer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);

        fetch('/images/hojas3.svg?v=99')
            .then(function (res) { return res.text(); })
            .then(function (svgText) {
                layer.innerHTML = svgText;
                // Doble rAF: si la animación se activa en el mismo tick del innerHTML,
                // Safari no la arranca y Chrome la arranca antes de asentar el layout.
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        layer.classList.add('is-animated');
                    });
                });
            })
            .catch(function () { layer.remove(); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
})();
