/**
 * @fileoverview Vista Generador IA – Paso 3 (espera mientras la IA genera el banco)
 * Una tarjeta de pregunta se escribe sola y se archiva en el mazo, en bucle; debajo,
 * frases sobre lo que hace la IA, el tiempo transcurrido y los tipos pedidos.
 * El servidor no informa del progreso, así que no se muestra ningún porcentaje.
 * Depende de: ai-generator.js (aiGenMode, QUESTION_TYPE_LABELS, aiTypeLabel). Estilos: css/admin-ai-wait.css
 */

const AI_WAIT_HINT_MS = 7000;
const AI_WAIT_PATIENCE_MS = 75000;
const AI_WAIT_HINTS = [
    ['admin.ai.wait.hint_write', 'Redactando los enunciados'],
    ['admin.ai.wait.hint_options', 'Inventando opciones incorrectas que parezcan creíbles'],
    ['admin.ai.wait.hint_check', 'Revisando que cada pregunta cumpla su formato']
];

let _aiWaitTimer = null;

function _aiWaitFirstHint() {
    return aiGenMode === 'prompt'
        ? _t('admin.ai.wait.hint_read_topic', null, 'Pensando en el tema y en lo que merece una pregunta')
        : _t('admin.ai.wait.hint_read_doc', null, 'Leyendo el documento y buscando los datos clave');
}

function _aiWaitClock(ms) {
    const s = Math.floor(ms / 1000);
    const pad = n => String(n).padStart(2, '0');
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

function _aiWaitTypes(counts) {
    return QUESTION_TYPE_LABELS.filter(t => counts && counts[t.type] > 0)
        .map(
            t => `<li class="aiw-type"><i class="fas ${t.icon} text-${t.color}-600" aria-hidden="true"></i>
                <span>${escapeHtml(aiTypeLabel(t))}</span><span class="aiw-type__n">${counts[t.type]}</span></li>`
        )
        .join('');
}

const AI_WAIT_CARD = `
    <div class="aiw-stage" aria-hidden="true">
        <img src="/images/chamaleon/inteligencia-artificial.svg" alt="" class="aiw-mascot">
        <div class="aiw-deck">
            <div class="aiw-card aiw-card--back2"></div>
            <div class="aiw-card aiw-card--back1"></div>
            <div class="aiw-card aiw-card--live">
                <span class="aiw-line aiw-line--1"></span>
                <span class="aiw-line aiw-line--2"></span>
                <span class="aiw-opt aiw-opt--1"></span>
                <span class="aiw-opt aiw-opt--2"></span>
                <span class="aiw-opt aiw-opt--3"><i class="fas fa-check"></i></span>
                <span class="aiw-opt aiw-opt--4"></span>
            </div>
        </div>
    </div>`;

function _renderAIStep3Loading(total, counts) {
    const title =
        total === 1
            ? _t('admin.ai.wait.title_one', null, 'Generando 1 pregunta con IA')
            : _t('admin.ai.wait.title_other', { count: total }, 'Generando {count} preguntas con IA');
    const editor = document.getElementById('editorArea');
    editor.innerHTML = `
    <section class="aiw" aria-busy="true" aria-labelledby="aiw-title">
        ${AI_WAIT_CARD}
        <h2 id="aiw-title" class="aiw-title" role="status">${escapeHtml(title)}</h2>
        <p id="aiw-hint" class="aiw-hint">${escapeHtml(_aiWaitFirstHint())}</p>
        <div class="aiw-track" aria-hidden="true"><span></span></div>
        <p class="aiw-elapsed">${escapeHtml(_t('admin.ai.wait.elapsed', null, 'Tiempo transcurrido'))}
            <span id="aiw-clock" class="aiw-clock">0:00</span></p>
        <ul class="aiw-types" aria-label="${escapeHtml(_t('admin.ai.wait.types', null, 'Tipos pedidos'))}">${_aiWaitTypes(counts)}</ul>
        <p id="aiw-patience" class="aiw-patience" role="status" hidden></p>
    </section>`;
    _aiWaitStart(editor.querySelector('.aiw'));
}

/** Reloj, frases y aviso de paciencia; se para solo cuando la vista sale del DOM. */
function _aiWaitStart(root) {
    clearInterval(_aiWaitTimer);
    const started = Date.now();
    const hints = [_aiWaitFirstHint()].concat(AI_WAIT_HINTS.map(([key, fallback]) => _t(key, null, fallback)));
    let hintIndex = 0;
    let lastHintAt = started;
    _aiWaitTimer = setInterval(() => {
        if (!root.isConnected) {
            clearInterval(_aiWaitTimer);
            _aiWaitTimer = null;
            return;
        }
        const now = Date.now();
        root.querySelector('#aiw-clock').textContent = _aiWaitClock(now - started);
        if (now - lastHintAt >= AI_WAIT_HINT_MS) {
            lastHintAt = now;
            hintIndex = (hintIndex + 1) % hints.length;
            _aiWaitSwapHint(root.querySelector('#aiw-hint'), hints[hintIndex]);
        }
        const patience = root.querySelector('#aiw-patience');
        if (patience.hidden && now - started >= AI_WAIT_PATIENCE_MS) {
            patience.textContent = _t(
                'admin.ai.wait.patience',
                null,
                'Sigue trabajando. Con documentos largos o muchas preguntas puede tardar varios minutos; no cierres esta pestaña.'
            );
            patience.hidden = false;
        }
    }, 1000);
}

function _aiWaitSwapHint(el, text) {
    el.classList.add('is-leaving');
    setTimeout(() => {
        el.textContent = text;
        el.classList.remove('is-leaving');
    }, 220);
}
