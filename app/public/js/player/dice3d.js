/**
 * @fileoverview Dado 3D - CSS 3D puro (sin dependencias externas)
 *
 * API:
 *   initDice(wrapper)      -> inyecta la estructura HTML del dado en el contenedor
 *   startRoll(onComplete)  -> sortea valor 1-6, anima CSS transition 1.2 s,
 *                             llama onComplete(value) al terminar
 *   destroy()              -> limpia referencias internas
 */

// Rotaciones (grados) del elemento .dice que colocan cada cara mirando al espectador.
// Cara CSS:  front=1  bottom=2  left=3  right=4  top=5  back=6
const FACE_TARGETS = {
    1: { x: 0, y: 0 },
    2: { x: 90, y: 0 },
    3: { x: 0, y: 90 },
    4: { x: 0, y: -90 },
    5: { x: -90, y: 0 },
    6: { x: 180, y: 0 },
};

function _buildHTML() {
    return `<div class="dice-scene">
  <div class="dice">
    <div class="dice__face front"><div class="dot"></div></div>
    <div class="dice__face back">
      <div class="dot"></div><div class="dot"></div>
      <div class="dot"></div><div class="dot"></div>
      <div class="dot"></div><div class="dot"></div>
    </div>
    <div class="dice__face left">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>
    <div class="dice__face right">
      <div class="dot"></div><div class="dot"></div>
      <div class="dot"></div><div class="dot"></div>
    </div>
    <div class="dice__face top">
      <div class="dot"></div><div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div><div class="dot"></div>
    </div>
    <div class="dice__face bottom">
      <div class="dot"></div><div class="dot"></div>
    </div>
  </div>
</div>`;
}

let _diceEl = null;

export function initDice(wrapper) {
    destroy();
    wrapper.innerHTML = _tHtml(_buildHTML());
    _diceEl = wrapper.querySelector('.dice');
    _diceEl.style.transition = 'none';
    _diceEl.style.transform = 'rotateX(0deg) rotateY(0deg)';
}

export function startRoll(onComplete) {
    if (!_diceEl) return;

    const value = Math.floor(Math.random() * 6) + 1;
    const spins = Math.floor(Math.random() * 3) + 3;   // 3-5 vueltas completas
    const { x, y } = FACE_TARGETS[value];
    const finalX = spins * 360 + x;
    const finalY = spins * 360 + y;
    const dice = _diceEl;                              // captura local (guard vs. destroy)

    // 1. Resetear sin transición al origen
    dice.style.transition = 'none';
    dice.style.transform = 'rotateX(0deg) rotateY(0deg)';

    // 2. Doble rAF asegura que el browser flushea el reset antes de animar
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (_diceEl !== dice) return;                // descartado entre frames
            dice.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            dice.style.transform = `rotateX(${finalX}deg) rotateY(${finalY}deg)`;

            const onEnd = (e) => {
                if (e.propertyName !== 'transform') return;
                dice.removeEventListener('transitionend', onEnd);
                if (typeof onComplete === 'function') onComplete(value);
            };
            dice.addEventListener('transitionend', onEnd);
        });
    });
}

export function destroy() {
    if (_diceEl) _diceEl.style.transition = 'none';
    _diceEl = null;
}
