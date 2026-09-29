/**
 * @fileoverview Utilidades para optimizar renderizado en el DOM
 * Reduce reflows y mejora performance en NAS con CPU limitada
 */

/**
 * Renderiza HTML usando DocumentFragment para minimizar reflows
 * @param {HTMLElement} container - Elemento contenedor
 * @param {string} htmlString - HTML a renderizar
 */
function renderWithFragment(container, htmlString) {
    // Crear un template temporal
    const template = document.createElement('template');
    template.innerHTML = htmlString.trim();

    // Limpiar el contenedor de una vez
    container.textContent = '';

    // Usar DocumentFragment (ya está en template.content)
    container.appendChild(template.content);
}

/**
 * Renderiza una lista de elementos usando DocumentFragment
 * Ideal para rankings, listas de jugadores, opciones de respuesta
 * @param {HTMLElement} container - Elemento contenedor
 * @param {Array} items - Array de objetos/strings a renderizar
 * @param {Function} itemRenderer - Función que retorna HTML para cada item
 */
function renderList(container, items, itemRenderer) {
    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
        const template = document.createElement('template');
        template.innerHTML = itemRenderer(item, index).trim();
        fragment.appendChild(template.content);
    });

    // Un solo reflow
    container.textContent = '';
    container.appendChild(fragment);
}

/**
 * Actualiza múltiples elementos del DOM en batch
 * @param {Array<{element: HTMLElement, property: string, value: any}>} updates
 */
function batchUpdate(updates) {
    // Usar requestAnimationFrame para hacer todos los cambios juntos
    requestAnimationFrame(() => {
        updates.forEach(({ element, property, value }) => {
            if (property === 'text') {
                element.textContent = value;
            } else if (property === 'html') {
                element.innerHTML = value;
            } else if (property === 'class') {
                element.className = value;
            } else {
                element[property] = value;
            }
        });
    });
}

/**
 * Crea elementos del DOM de forma eficiente
 * @param {string} tag - Tag del elemento (div, span, button, etc)
 * @param {Object} attrs - Atributos y propiedades
 * @param {string|Array<HTMLElement>} children - Contenido o hijos
 * @returns {HTMLElement}
 */
function createElement(tag, attrs = {}, children = null) {
    const element = document.createElement(tag);

    // Aplicar atributos
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset') {
            Object.assign(element.dataset, value);
        } else if (key.startsWith('on')) {
            // Event listener
            const eventName = key.substring(2).toLowerCase();
            element.addEventListener(eventName, value);
        } else {
            element.setAttribute(key, value);
        }
    });

    // Agregar children
    if (children) {
        if (typeof children === 'string') {
            element.textContent = children;
        } else if (Array.isArray(children)) {
            const fragment = document.createDocumentFragment();
            children.forEach(child => {
                if (child) fragment.appendChild(child);
            });
            element.appendChild(fragment);
        } else if (children instanceof HTMLElement) {
            element.appendChild(children);
        }
    }

    return element;
}

/**
 * Renderiza opciones de respuesta optimizado (usado en jugador.js)
 * @param {Array} options - Array de opciones {text, correct, etc}
 * @param {Function} onClickHandler - Handler para el click
 * @returns {DocumentFragment}
 */
function renderAnswerOptions(options, onClickHandler) {
    const fragment = document.createDocumentFragment();
    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];

    options.forEach((option, index) => {
        const button = createElement('button', {
            className: 'answer-option',
            'data-index': index,
            onclick: () => onClickHandler(index)
        }, [
            createElement('span', { className: 'answer-label' }, labels[index]),
            createElement('span', { className: 'answer-text' }, option.text || option)
        ]);

        fragment.appendChild(button);
    });

    return fragment;
}

/**
 * Renderiza ranking con DocumentFragment (usado en tv.js y jugador.js)
 * @param {Array} players - Array de jugadores ordenados
 * @param {boolean} showPoints - Mostrar puntos
 * @returns {DocumentFragment}
 */
function renderRanking(players, showPoints = true) {
    const fragment = document.createDocumentFragment();
    const medals = ['🥇', '🥈', '🥉'];

    players.forEach((player, index) => {
        const position = index + 1;
        const medal = position <= 3 ? medals[index] : position + '.';

        const item = createElement('div', {
            className: `ranking-item ${position <= 3 ? 'top-3' : ''}`
        }, [
            createElement('span', { className: 'ranking-position' }, medal),
            createElement('span', { className: 'ranking-nickname' }, player.nickname || player.name),
            showPoints ? createElement('span', { className: 'ranking-points' }, `${player.score || player.points || 0} pts`) : null
        ].filter(Boolean));

        fragment.appendChild(item);
    });

    return fragment;
}

/**
 * Limpia y renderiza con protección contra XSS
 * @param {HTMLElement} container
 * @param {string} htmlString
 */
function safeRender(container, htmlString) {
    // Sanitización básica
    const sanitized = htmlString
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '');

    renderWithFragment(container, sanitized);
}

// Exportar funciones (compatible con módulos y scripts globales)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderWithFragment,
        renderList,
        batchUpdate,
        createElement,
        renderAnswerOptions,
        renderRanking,
        safeRender
    };
}
