(function () {
    'use strict';

    // Espacio de nombres compartido por los módulos del editor (scripts clásicos del admin)
    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = root.XiroCanvasEditor = root.XiroCanvasEditor || {};

    /**
     * Convierte coordenadas del cliente a coordenadas lógicas
     * @param {number} clientX - Coordenada X en píxeles del cliente
     * @param {number} clientY - Coordenada Y en píxeles del cliente
     * @param {Object} rect - Rectángulo del contenedor (left, top)
     * @param {number} scale - Escala actual
     * @returns {Object} Coordenadas lógicas {x, y}
     */
    XiroCanvasEditor.geometry = XiroCanvasEditor.geometry || {};

    /**
     * Convierte coordenadas del cliente a coordenadas lógicas
     * @param {number} clientX - Coordenada X en píxeles del cliente
     * @param {number} clientY - Coordenada Y en píxeles del cliente
     * @param {Object} rect - Rectángulo del contenedor (left, top)
     * @param {number} scale - Escala actual
     * @returns {Object} Coordenadas lógicas {x, y}
     */
    XiroCanvasEditor.geometry.toLogical = function(clientX, clientY, rect, scale) {
        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale
        };
    };

    /**
     * Mueve un cuadro en el canvas
     * @param {Object} start - Posición inicial {x,y,w,h}
     * @param {number} dx - Desplazamiento X lógico
     * @param {number} dy - Desplazamiento Y lógico
     * @param {Object} opts - Opciones
     * @param {boolean} opts.snap - Si debe ajustarse a líneas guía (por defecto true)
     * @param {number} opts.threshold - Umbral para el ajuste (por defecto 12)
     * @returns {Object} Nueva posición {x, y, guides}
     */
    XiroCanvasEditor.geometry.moveBox = function(start, dx, dy, opts) {
        // Valores por defecto
        let options = opts || {};
        let snap = options.snap !== undefined ? options.snap : true;
        let threshold = options.threshold !== undefined ? options.threshold : 12;

        // Calcular nueva posición
        let newX = start.x + dx;
        let newY = start.y + dy;

        // Crear guías vacías
        let guides = { v: [], h: [] };

        if (snap) {
            // Ajuste a los bordes verticales
            if (Math.abs(newX - 0) < threshold) {
                newX = 0;
                guides.v.push(0);
            } else if (Math.abs(newX + start.w - 1920) < threshold) {
                newX = 1920 - start.w;
                guides.v.push(1920);
            } else if (Math.abs(newX + start.w/2 - 960) < threshold) {
                newX = 960 - start.w/2;
                guides.v.push(960);
            }

            // Ajuste a los bordes horizontales
            if (Math.abs(newY - 0) < threshold) {
                newY = 0;
                guides.h.push(0);
            } else if (Math.abs(newY + start.h - 1080) < threshold) {
                newY = 1080 - start.h;
                guides.h.push(1080);
            } else if (Math.abs(newY + start.h/2 - 540) < threshold) {
                newY = 540 - start.h/2;
                guides.h.push(540);
            }
        }

        // Redondear posiciones
        newX = Math.round(newX);
        newY = Math.round(newY);

        return {
            x: newX,
            y: newY,
            guides: guides
        };
    };

    /**
     * Cambia el tamaño de un cuadro en el canvas
     * @param {Object} start - Posición inicial {x,y,w,h,rotation}
     * @param {string} handle - Punto de manipulación ('nw','n','ne','e','se','s','sw','w')
     * @param {number} dx - Desplazamiento X lógico
     * @param {number} dy - Desplazamiento Y lógico
     * @param {Object} opts - Opciones
     * @param {boolean} opts.keepRatio - Si debe mantenerse la proporción (por defecto false)
     * @param {number} opts.minSize - Tamaño mínimo (por defecto 20)
     * @returns {Object} Nueva posición y tamaño {x, y, w, h}
     */
    XiroCanvasEditor.geometry.resizeBox = function(start, handle, dx, dy, opts) {
        // Valores por defecto
        let options = opts || {};
        let keepRatio = options.keepRatio !== undefined ? options.keepRatio : false;
        let minSize = options.minSize !== undefined ? options.minSize : 20;

        // Convertir rotación a radianes
        let theta = start.rotation * Math.PI / 180;

        // Calcular desplazamiento local (rotado inversamente)
        let lx = dx * Math.cos(-theta) - dy * Math.sin(-theta);
        let ly = dx * Math.sin(-theta) + dy * Math.cos(-theta);

        // Determinar factores de escala por dirección
        let sx = 0, sy = 0;
        if (handle.includes('e')) sx = 1;
        else if (handle.includes('w')) sx = -1;
        if (handle.includes('s')) sy = 1;
        else if (handle.includes('n')) sy = -1;

        // Calcular nuevos tamaños
        let nw = start.w;
        let nh = start.h;

        if (sx !== 0) {
            nw = start.w + sx * lx;
        }

        if (sy !== 0) {
            nh = start.h + sy * ly;
        }

        // Aplicar tamaño mínimo
        nw = Math.max(minSize, nw);
        nh = Math.max(minSize, nh);

        // Mantener proporción si es necesario
        if (keepRatio && start.w !== 0 && start.h !== 0) {
            let ratio = start.w / start.h;

            if (sx !== 0 && sy !== 0) { // Esquina
                let k = Math.max(nw / start.w, nh / start.h);
                nw = start.w * k;
                nh = start.h * k;
            } else if (sx !== 0) { // Borde horizontal
                nh = nw / ratio;
            } else if (sy !== 0) { // Borde vertical
                nw = nh * ratio;
            }

            // Asegurarse de que no se exceda el tamaño mínimo
            nw = Math.max(minSize, nw);
            nh = Math.max(minSize, nh);
        }

        // Calcular desplazamiento del centro en el espacio local
        let cx = sx * (nw - start.w) / 2;
        let cy = sy * (nh - start.h) / 2;

        // Rotar el desplazamiento de nuevo
        let cxGlobal = cx * Math.cos(theta) - cy * Math.sin(theta);
        let cyGlobal = cx * Math.sin(theta) + cy * Math.cos(theta);

        // Calcular nueva posición del centro
        let centerX = start.x + start.w / 2;
        let centerY = start.y + start.h / 2;
        let newCenterX = centerX + cxGlobal;
        let newCenterY = centerY + cyGlobal;

        // Calcular nueva posición
        let newX = newCenterX - nw / 2;
        let newY = newCenterY - nh / 2;

        // Redondear resultados
        return {
            x: Math.round(newX),
            y: Math.round(newY),
            w: Math.round(nw),
            h: Math.round(nh)
        };
    };

    /**
     * Calcula los extremos de una línea
     * @param {Object} el - Elemento con x, y, w, h, rotation
     * @returns {Object} Coordenadas de los extremos {x1, y1, x2, y2}
     */
    XiroCanvasEditor.geometry.lineEndpoints = function(el) {
        let centerX = el.x + el.w / 2;
        let centerY = el.y + el.h / 2;

        // Convertir rotación a radianes
        let theta = el.rotation * Math.PI / 180;

        // Calcular extremos de la línea (horizontal en el centro)
        let halfWidth = el.w / 2;
        let x1 = centerX - halfWidth * Math.cos(theta);
        let y1 = centerY - halfWidth * Math.sin(theta);
        let x2 = centerX + halfWidth * Math.cos(theta);
        let y2 = centerY + halfWidth * Math.sin(theta);

        return {
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2
        };
    };

    /**
     * Calcula las coordenadas de un elemento a partir de dos extremos de línea
     * @param {Object} p1 - Primer punto {x, y}
     * @param {Object} p2 - Segundo punto {x, y}
     * @param {number} h - Altura del elemento (por defecto 40)
     * @returns {Object} Coordenadas del elemento {x, y, w, h, rotation}
     */
    XiroCanvasEditor.geometry.lineFromEndpoints = function(p1, p2, h) {
        // Calcular centro
        let cx = (p1.x + p2.x) / 2;
        let cy = (p1.y + p2.y) / 2;

        // Calcular ancho (distancia entre puntos)
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let w = Math.max(20, Math.round(Math.sqrt(dx * dx + dy * dy)));

        // Calcular rotación
        let rotation = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);

        // Normalizar rotación al rango [-180, 180]
        if (rotation > 180) rotation -= 360;
        if (rotation < -180) rotation += 360;

        // Calcular posición
        let x = Math.round(cx - w / 2);
        let y = Math.round(cy - h / 2);

        return {
            x: x,
            y: y,
            w: w,
            h: h || 40,
            rotation: rotation
        };
    };

    /**
     * Mantiene un cuadro visible en el canvas
     * @param {Object} box - Posición del cuadro {x, y, w, h}
     * @returns {Object} Nueva posición {x, y}
     */
    XiroCanvasEditor.geometry.keepVisible = function(box) {
        let newX = Math.max(20 - box.w, Math.min(1900, box.x));
        let newY = Math.max(20 - box.h, Math.min(1060, box.y));

        return {
            x: newX,
            y: newY
        };
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.geometry;
})();
