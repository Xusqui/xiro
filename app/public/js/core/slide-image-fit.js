/**
 * @fileoverview Imagen de diapositiva ajustada al espacio disponible.
 *
 * max-width/max-height solo reducen: una imagen más pequeña que la pantalla se
 * quedaba a su tamaño original. Con object-fit la caja ocupa todo el hueco y el
 * borde redondeado y la sombra quedan fuera de la imagen visible. Aquí la
 * proporción real (naturalWidth / naturalHeight) se guarda en --slide-img-ar y
 * css/slide-image-fit.css calcula el ancho mayor que cabe en la caja
 * (.slide-img-box, container-type: size), ampliando o reduciendo.
 *
 * Lo usan el presentador y standalone. Expone window.XiroSlideImageFit y
 * module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    const RATIO_VAR = '--slide-img-ar';

    /** Copia la proporción de la imagen en --slide-img-ar (si ya tiene tamaño). */
    function applyRatio(img) {
        if (!img || !img.naturalWidth || !img.naturalHeight) return false;
        img.style.setProperty(RATIO_VAR, String(img.naturalWidth / img.naturalHeight));
        return true;
    }

    /** Ajusta las img.slide-img-fit del contenedor, ya cargadas o al cargar. */
    function fitImages(container) {
        if (!container || typeof container.querySelectorAll !== 'function') return;
        const images = container.querySelectorAll('img.slide-img-fit');
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            if (!(img.complete && applyRatio(img))) {
                img.addEventListener('load', function () { applyRatio(img); }, { once: true });
            }
        }
    }

    const api = { applyRatio: applyRatio, fitImages: fitImages, RATIO_VAR: RATIO_VAR };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.XiroSlideImageFit = api;
})(typeof window !== 'undefined' ? window : null);
