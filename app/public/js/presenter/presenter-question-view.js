/**
 * @fileoverview HTML de una pregunta en la pantalla del presentador, por secciones.
 * Lo usa renderPregunta (presenter-game-ui.js).
 */

import { renderWordScramblePresenter } from './presenter-wordscramble-layout.js?v=20260922172926';
import { renderMatchingPresenter } from './presenter-matching-layout.js?v=20260922172926';
import { nextButtonLabel } from './presenter-reveal.js?v=20260922172926';
import { escapeHtml, sanitizeResourceUrl } from '../core/sanitize.js?v=20260922172926';

const OPTION_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-plum-500', 'bg-pink-500'];

/** Qué muestra la pregunta según su tipo y su contenido multimedia. */
export function describeQuestion(q) {
    const tipoContenido = q.tipo_contenido || 'texto';
    const urlRecurso = q.url_recurso || null;
    const tieneImagen = Boolean(tipoContenido === 'imagen' && urlRecurso);
    const esNumerica = q.question_type === 'numeric_approximation';
    const esWordScramble = q.question_type === 'word_scramble';
    // Con imagen principal, matching sigue la regla general: opciones en los móviles
    const esMatching = q.question_type === 'matching' && !tieneImagen;
    return {
        urlRecurso,
        questionImageUrl: q.question_image_url || null,
        tieneImagen,
        tieneAudio: Boolean(tipoContenido === 'audio' && urlRecurso),
        tieneImagenEnunciado: Boolean(!tieneImagen && q.question_image_url),
        esNumerica,
        esWordScramble,
        esMultipleChoice: q.question_type === 'multiple_choice',
        esMatching,
        mostrarOpciones: !tieneImagen && !esNumerica && !esWordScramble && !esMatching
    };
}

function headerHtml(q, totalPlayers) {
    return `
            <div class="grid items-center mb-6" style="grid-template-columns: 1fr auto 1fr;">
                <div class="flex items-center gap-3 justify-self-start">
                    <img src="/images/minilogo.svg" class="w-16">
                </div>
                <div class="flex items-center gap-3 justify-self-center">
                    <div id="timer" data-presenter-action="toggle-timer" class="w-16 h-16 rounded-full border-4 border-red-800 flex items-center justify-center text-3xl font-black italic cursor-pointer hover:scale-110 transition-all duration-200" title="Clic para pausar/reanudar">${Number(q.time_limit) || 20}</div>
                    <button id="btn-reveal-answer" data-presenter-action="reveal-answer" class="bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/35 rounded-2xl px-5 py-3 font-black text-white uppercase tracking-wide transition shadow-xl">
                        ${_t('presenter.game.reveal_answer', null, 'Revelar respuesta')}
                    </button>
                </div>
                <div class="text-2xl font-black italic text-red-800 justify-self-end" style="margin-right: 7rem;">${_t('presenter.game.answers_label', null, 'RESPUESTAS:')} <span id="ans-count">0</span> / <span id="ans-total">${totalPlayers}</span></div>
            </div>`;
}

function multipleChoiceBadgeHtml() {
    return `
                <div class="flex justify-center mb-4">
                    <div class="bg-plum-600 text-white px-6 py-2 rounded-full font-bold text-lg uppercase tracking-wide shadow-lg border-2 border-white/30">
                        ${_t('presenter.game.multiple_choice_label', null, '✓ Selección Múltiple')}
                    </div>
                </div>`;
}

/** Imagen principal o reproductor de audio de la pregunta. */
function mediaHtml(view) {
    if (view.tieneImagen && !view.esWordScramble) {
        return `
                <div class="stage-question-media flex-1 flex items-center justify-center mb-6 px-6">
                    <img src="${sanitizeResourceUrl(view.urlRecurso)}" alt="Pregunta" class="stage-question-image max-w-full max-h-full object-contain rounded-3xl shadow-2xl">
                </div>`;
    }
    if (!view.tieneAudio) return '';
    return `
                <div class="flex justify-center mb-6">
                    <div class="bg-plum-600/20 backdrop-blur-lg rounded-3xl p-8 border-2 border-red-800 shadow-2xl">
                        <div class="flex items-center gap-4 mb-4">
                            <i class="fas fa-volume-up text-6xl text-plum-400"></i>
                            <div class="text-white">
                                <p class="text-2xl font-black italic">${_t('presenter.game.audio_playing', null, 'AUDIO EN REPRODUCCIÓN')}</p>
                                <p class="text-sm text-plum-300">${_t('presenter.game.listen_carefully', null, 'Escucha atentamente')}</p>
                            </div>
                        </div>
                        <audio id="question-audio" autoplay controls class="w-full">
                            <source src="${sanitizeResourceUrl(view.urlRecurso)}" type="audio/mpeg">
                            ${_t('presenter.game.no_audio_support', null, 'Tu navegador no soporta audio.')}
                        </audio>
                    </div>
                </div>`;
}

function statementImageHtml(view) {
    if (!view.tieneImagenEnunciado) return '';
    return `
                <div class="flex justify-center mb-4">
                    <img src="${sanitizeResourceUrl(view.questionImageUrl)}" alt="Imagen enunciado" class="max-h-52 object-contain rounded-2xl shadow-xl border-2 border-white/20">
                </div>`;
}

function optionsGridHtml(q, view) {
    const options = q.options.map((opt, i) => `
                    <div id="opt-${i}" class="${OPTION_COLORS[i]} relative rounded-[30px] p-6 flex items-center shadow-2xl border-b-8 border-black/20 h-full transition-all duration-500">
                        <span class="bg-black/20 w-16 h-16 rounded-xl flex items-center justify-center text-4xl font-black mr-6 border-2 border-white/20 italic text-white">${i + 1}</span>
                        ${opt.option_image_url ? `<img src="${sanitizeResourceUrl(opt.option_image_url)}" alt="" class="max-h-[120px] max-w-[120px] object-contain rounded-xl mr-3 shrink-0">` : ''}
                        <span class="option-text font-black uppercase text-white break-words" style="flex: 1; overflow-wrap: break-word; hyphens: auto; line-height: 1.1;">${escapeHtml(opt.optionText)}</span>
                    </div>`).join('');
    return `
            <div id="options-grid" class="grid grid-cols-2 gap-4 flex-1 pb-14 ${!view.mostrarOpciones ? 'hidden' : ''}" style="grid-auto-rows: minmax(0, 1fr); min-height: 0;">
                ${options}
            </div>`;
}

function numericAreaHtml() {
    return `
                <div class="flex-1 pb-6 flex items-center justify-center">
                    <div class="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-lg rounded-3xl p-12 border-2 border-green-500 shadow-2xl text-center">
                        <div class="text-6xl mb-4">🔢</div>
                        <p class="text-2xl font-black italic text-green-400 mb-2">${_t('presenter.game.numeric_question', null, 'PREGUNTA NUMÉRICA')}</p>
                        <p class="text-xl text-white/80 mb-4">${_t('presenter.game.players_write_number', null, 'Los jugadores escriben un número entero')}</p>
                        <div class="mt-6 pt-6 border-t border-green-500/30">
                            <p id="numeric-answer-note" class="text-sm text-white/70 mb-2">${_t('presenter.game.answer_on_reveal', null, 'La respuesta correcta se mostrará al revelar')}</p>
                            <p class="text-xs text-white/50 mt-2">${_t('presenter.game.points_by_proximity', null, 'Los puntos se calculan según proximidad')}</p>
                        </div>
                    </div>
                </div>`;
}

/** Zona bajo la rejilla: numérica, anagrama, tablero de matching o aviso de que las opciones están en los móviles. */
function answerAreaHtml(q, view) {
    if (view.esNumerica && !view.tieneImagen) return numericAreaHtml();
    if (view.esWordScramble) return renderWordScramblePresenter(q);
    if (view.esMatching) return renderMatchingPresenter(q);
    if (view.mostrarOpciones) return '';
    return `
                <div class="stage-devices-note pb-14 text-center">
                    <p class="text-white/60 text-2xl italic">
                        <i class="fas fa-mobile-alt mr-2"></i>
                        ${_t('presenter.game.players_see_devices', null, 'Los jugadores ven las opciones en sus dispositivos')}
                    </p>
                </div>`;
}

function nextButtonHtml() {
    const [label, icon] = nextButtonLabel();
    return `
            <button id="btn-next" data-presenter-action="next-question" class="hidden fixed bottom-10 right-10 bg-white text-slate-900 px-10 py-5 rounded-3xl font-black text-2xl shadow-2xl hover:bg-plum-600 hover:text-white transition italic uppercase" style="z-index: 10000;">
                ${label}
                <i class="fas ${icon} ml-2"></i>
            </button>`;
}

/** HTML completo de la pregunta para #lobby-main. */
export function questionHtml(q, view, totalPlayers) {
    const titleMargin = view.tieneImagen && !view.esWordScramble ? '4' : '8';
    return `
        <div class="h-full w-full flex flex-col">
            ${headerHtml(q, totalPlayers)}
            <h1 id="question-title" class="font-black text-center uppercase italic mb-${titleMargin} drop-shadow-lg" style="line-height: 1.2;">${escapeHtml(q.question_text)}</h1>
            ${view.esMultipleChoice ? multipleChoiceBadgeHtml() : ''}
            ${mediaHtml(view)}
            ${statementImageHtml(view)}
            ${optionsGridHtml(q, view)}
            ${answerAreaHtml(q, view)}
            ${nextButtonHtml()}
        </div>`;
}
