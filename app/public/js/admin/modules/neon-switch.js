/**
 * Toggle switch neon reutilizable. Ver app/public/css/neon-switch.css.
 * Origen del diseño: app/public/button.html
 */

function renderNeonSwitch({ key, checked, label, action = 'toggle-ui-setting-neon', idSuffix, id, attrs } = {}) {
    const suffix = idSuffix || id || String(key).replace(/[^a-zA-Z0-9-]/g, '');
    const glowId = `neon-switch-glow-${suffix}`;
    const grad1Id = `neon-switch-gradient1-${suffix}`;
    const grad2Id = `neon-switch-gradient2-${suffix}`;
    const actionAttrs = action ? `data-config-action="${action}" data-key="${key}"` : '';

    return `<label class="neon-switch">
        <input class="neon-switch__input" type="checkbox" role="switch"
               ${id ? `id="${id}"` : ''} ${actionAttrs} ${attrs || ''} ${checked ? 'checked' : ''}>
        <span class="neon-switch__base-outer"></span>
        <span class="neon-switch__base-inner"></span>
        <svg class="neon-switch__base-neon" viewBox="0 0 40 24" width="40px" height="24px">
            <defs>
                <filter id="${glowId}">
                    <feGaussianBlur result="coloredBlur" stdDeviation="1"></feGaussianBlur>
                    <feMerge>
                        <feMergeNode in="coloredBlur"></feMergeNode>
                        <feMergeNode in="SourceGraphic"></feMergeNode>
                    </feMerge>
                </filter>
                <linearGradient id="${grad1Id}" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="hsl(123,90%,70%)" />
                    <stop offset="100%" stop-color="hsl(168,90%,70%)" />
                </linearGradient>
                <linearGradient id="${grad2Id}" x1="0.7" y1="0" x2="0.3" y2="1">
                    <stop offset="25%" stop-color="hsla(123,90%,70%,0)" />
                    <stop offset="50%" stop-color="hsla(123,90%,70%,0.3)" />
                    <stop offset="100%" stop-color="hsla(168,90%,70%,0.3)" />
                </linearGradient>
            </defs>
            <path fill="none" filter="url(#${glowId})" stroke="url(#${grad1Id})" stroke-width="1"
                stroke-dasharray="0 104.26 0" stroke-dashoffset="0.01" stroke-linecap="round"
                d="m.5,12C.5,5.649,5.649.5,12,.5h16c6.351,0,11.5,5.149,11.5,11.5s-5.149,11.5-11.5,11.5H12C5.649,23.5.5,18.351.5,12Z" />
        </svg>
        <span class="neon-switch__knob-shadow"></span>
        <span class="neon-switch__knob-container">
            <span class="neon-switch__knob">
                <svg class="neon-switch__knob-neon" viewBox="0 0 48 48" width="48px" height="48px">
                    <circle fill="none" stroke="url(#${grad2Id})" stroke-dasharray="0 90.32 0 54.19"
                        stroke-linecap="round" stroke-width="1" r="23" cx="24" cy="24"
                        transform="rotate(-112.5,24,24)" />
                </svg>
            </span>
        </span>
        <span class="neon-switch__text">${label || ''}</span>
    </label>`;
}
