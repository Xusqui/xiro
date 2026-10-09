/**
 * Checkbox animado reutilizable del panel admin. Ver app/public/css/checkbox.css.
 * Origen del diseño: https://uiverse.io/andrew-manzyk/ancient-turtle-91
 */

function renderCheckbox({ key, checked, label, action = 'toggle-ui-setting-neon', id, attrs } = {}) {
    const actionAttrs = action ? `data-config-action="${action}" data-key="${key}"` : '';

    return `<label class="xiro-checkbox">
        <input type="checkbox" ${id ? `id="${id}"` : ''} ${actionAttrs} ${attrs || ''} ${checked ? 'checked' : ''}>
        <div class="checkmark">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1.5" y="1.5" width="21" height="21" rx="5" ry="5" stroke-width="2"></rect>
                    <polyline points="7 10 12 16 22 2" stroke-width="3"></polyline>
                </g>
            </svg>
            ${label ? `<span class="checkmark__text">${label}</span>` : ''}
        </div>
    </label>`;
}
