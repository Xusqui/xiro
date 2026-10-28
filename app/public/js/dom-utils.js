/**
 * @fileoverview Utilidades para optimizar renderizado en el DOM
 * Reduce reflows y mejora performance en NAS con CPU limitada
 */

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

        const item = createElement(
            'div',
            {
                className: `ranking-item ${position <= 3 ? 'top-3' : ''}`
            },
            [
                createElement('span', { className: 'ranking-position' }, medal),
                createElement('span', { className: 'ranking-nickname' }, player.nickname || player.name),
                showPoints
                    ? createElement(
                        'span',
                        { className: 'ranking-points' },
                        `${player.score || player.points || 0} pts`
                    )
                    : null
            ].filter(Boolean)
        );

        fragment.appendChild(item);
    });

    return fragment;
}

// Exportar funciones (compatible con módulos y scripts globales)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderList,
        createElement,
        renderRanking,
    };
}
