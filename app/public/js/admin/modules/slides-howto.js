/**
 * @fileoverview Diapositiva de instrucciones («howto») de los juegos personalizados. El contenido
 * (animación y locución) está fijo en el código del presentador y la TV: aquí solo se elige un tema
 * de una lista cerrada (HOWTO_TOPICS) y, opcionalmente, un pie de texto. Los jugadores ven un aviso
 * para que miren la pantalla. Reutiliza helpers globales: dibujarPreguntasPersonalizadas(),
 * slideFooterFieldHtml(), readSlideFooterField() y currentCustomGameQuestions.
 */

let _slideHowToDelegationReady = false;

// Una instrucción por tipo de pregunta (claves = question_type). `ready`: ya tiene animación y voz
// (las listas de HOWTO_TOPICS en application/validators/HowToSlideValidator.js deben coincidir).
const _HOWTO_TOPICS = [
    { key: 'quiz', icon: 'fa-list-ul', label: 'Quiz (una respuesta)', ready: true },
    { key: 'multiple_choice', icon: 'fa-check-double', label: 'Respuesta múltiple', ready: false },
    { key: 'survey', icon: 'fa-chart-bar', label: 'Encuesta', ready: false },
    { key: 'survey_multiple', icon: 'fa-poll', label: 'Encuesta múltiple', ready: false },
    { key: 'order', icon: 'fa-sort-numeric-down', label: 'Ordenar', ready: false },
    { key: 'matching', icon: 'fa-link', label: 'Emparejar', ready: false },
    { key: 'numeric_approximation', icon: 'fa-calculator', label: 'Aproximación numérica', ready: false },
    { key: 'word_scramble', icon: 'fa-random', label: 'Adivinar palabra', ready: false },
    { key: 'word_search', icon: 'fa-search', label: 'Sopa de letras', ready: true },
    { key: 'fill_blanks', icon: 'fa-pen', label: 'Completa la frase', ready: false }
];

function _howToTopic(key) {
    return _HOWTO_TOPICS.find(topic => topic.key === key) || null;
}

function _howToTopicLabel(key) {
    const topic = _howToTopic(key);
    return topic ? _t('admin.custom.howto_topic_' + key, null, topic.label) : key;
}

/** Botón «Instrucciones»: pregunta de qué tipo de pregunta se quieren las instrucciones. */
function anadirSlideHowTo() {
    const buttons = _HOWTO_TOPICS.map(topic => {
        const state = topic.ready
            ? ''
            : `<span class="ml-auto text-[10px] font-bold uppercase text-slate-400">${_t('admin.custom.howto_soon', null, 'Próximamente')}</span>`;
        return `<button type="button" data-slide-howto-action="pick" data-topic="${escapeHtml(topic.key)}" ${topic.ready ? '' : 'disabled'}
            class="w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left font-bold transition ${topic.ready ? 'border-plum-300 bg-plum-50 hover:bg-plum-100 text-plum-900' : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'}">
            <i class="fas ${topic.icon} w-5 text-center" aria-hidden="true"></i><span>${escapeHtml(_howToTopicLabel(topic.key))}</span>${state}
        </button>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'modalPickHowTo';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full max-h-full overflow-y-auto">
            <h3 class="text-2xl font-black text-plum-600 mb-2 flex items-center gap-2"><i class="fas fa-circle-question"></i> ${_t('admin.custom.howto_pick_title', null, '¿Qué instrucciones quieres mostrar?')}</h3>
            <p class="text-sm text-slate-600 mb-4">${_t('admin.custom.howto_pick_help', null, 'Animación con voz, en el idioma del presentador, que explica cómo se responde cada tipo de pregunta.')}</p>
            <div class="flex flex-col gap-2">${buttons}</div>
            <button type="button" data-slide-howto-action="close-pick-modal" class="mt-4 w-full bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">${_t('admin.common.cancel', null, 'Cancelar')}</button>
        </div>
    `);
    document.body.appendChild(modal);
}

function cerrarModalPickHowTo() {
    const modal = document.getElementById('modalPickHowTo');
    if (modal) modal.remove();
}

/** Añade al juego una diapositiva de instrucciones del tema elegido. */
function elegirSlideHowTo(key) {
    const topic = _howToTopic(key);
    if (!topic || !topic.ready) return;
    currentCustomGameQuestions.push({ slide_type: 'howto', slide_howto: key, slide_footer: null });
    cerrarModalPickHowTo();
    dibujarPreguntasPersonalizadas();
}

function editarSlideHowTo(index) {
    const slide = currentCustomGameQuestions[index];
    if (!slide || slide.slide_type !== 'howto') return;

    const options = _HOWTO_TOPICS.filter(topic => topic.ready || topic.key === slide.slide_howto)
        .map(
            topic =>
                `<option value="${escapeHtml(topic.key)}"${topic.key === slide.slide_howto ? ' selected' : ''}>${escapeHtml(_howToTopicLabel(topic.key))}</option>`
        )
        .join('');

    const modal = document.createElement('div');
    modal.id = 'modalEditHowTo';
    modal.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
    modal.innerHTML = _tHtml(`
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
            <h3 class="text-2xl font-black text-plum-600 mb-4 flex items-center gap-2"><i class="fas fa-circle-question"></i> ${_t('admin.custom.slide_howto_edit', null, 'Editar Instrucciones')}</h3>
            <p class="text-sm text-slate-600 mb-4">${_t('admin.custom.slide_howto_help', null, 'Animación con voz que se ve solo en la pantalla del presentador y la TV. Los jugadores verán un aviso para que miren la pantalla.')}</p>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest" for="howToTopic">${_t('admin.custom.slide_howto_topic', null, 'Tema')}</label>
            <select id="howToTopic" class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-plum-500 outline-none mb-2">${options}</select>
            ${slideFooterFieldHtml(slide.slide_footer || '')}
            <div class="flex gap-3 mt-6">
                <button data-slide-howto-action="close-edit-modal" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition">Cancelar</button>
                <button data-slide-howto-action="save-slide" data-index="${index}" class="flex-1 bg-plum-600 hover:bg-plum-700 text-white px-6 py-3 rounded-xl font-bold transition"><i class="fas fa-save mr-2"></i>Guardar</button>
            </div>
        </div>
    `);
    document.body.appendChild(modal);
}

function cerrarModalEditHowTo() {
    const modal = document.getElementById('modalEditHowTo');
    if (modal) modal.remove();
}

function guardarEditHowTo(index) {
    const topic = document.getElementById('howToTopic')?.value;
    const chosen = _howToTopic(topic);
    if (!chosen || !chosen.ready) return;

    currentCustomGameQuestions[index].slide_howto = topic;
    currentCustomGameQuestions[index].slide_footer = readSlideFooterField();
    dibujarPreguntasPersonalizadas();
    cerrarModalEditHowTo();
}

function customHowToCardBody(q) {
    return `
        <div class="flex-1 flex gap-4">
            <div class="w-32 h-24 bg-slate-900 rounded flex-shrink-0 flex items-center justify-center"><i class="fas fa-circle-question text-plum-300 text-3xl"></i></div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                    <span class="bg-plum-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fas fa-circle-question mr-1"></i>${_t('admin.custom.slide_howto_badge', null, 'INSTRUCCIONES')}</span>
                </div>
                <p class="text-sm font-bold text-plum-900">${escapeHtml(_howToTopicLabel(q.slide_howto))}</p>
                <p class="text-xs text-plum-700 mt-2 italic"><i class="fas fa-volume-high mr-1"></i>${_t('admin.custom.slide_howto_screen', null, 'Animación con voz en el presentador y la TV')}</p>
            </div>
        </div>
    `;
}

function initSlideHowToDelegation() {
    if (_slideHowToDelegationReady) return;
    _slideHowToDelegationReady = true;

    document.addEventListener('click', event => {
        const actionElement = event.target.closest('[data-slide-howto-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.slideHowtoAction;
        if (action === 'close-edit-modal') {
            cerrarModalEditHowTo();
        } else if (action === 'close-pick-modal') {
            cerrarModalPickHowTo();
        } else if (action === 'pick') {
            elegirSlideHowTo(actionElement.dataset.topic);
        } else if (action === 'save-slide') {
            const index = Number(actionElement.dataset.index);
            if (Number.isInteger(index)) guardarEditHowTo(index);
        }
    });
}

initSlideHowToDelegation();
