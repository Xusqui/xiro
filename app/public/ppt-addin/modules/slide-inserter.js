/**
 * @module slide-inserter
 * @description Inserta una diapositiva de podio al final de la presentación
 *   activa usando la API PowerPoint.js (PowerPointApi 1.4+).
 *   También puede insertar las diapositivas de lobby/pregunta con marcadores.
 *
 *   Compatibilidad:
 *     PowerPoint Desktop Win/Mac (Microsoft 365 / 2019+): completo
 *     PowerPoint Online: completo
 *     Requiere PowerPointApi 1.4 (declarado en manifest.xml)
 *
 * @depends [state]
 * @server-events []
 * @server-endpoints []
 */

// Dimensiones estándar diapositiva (10" × 7.5" @ 72pt/in)
const SLIDE = { W: 720, H: 540 };
const BG = '1e1e3f';
const WHITE = 'FFFFFF';
const GOLD = 'F4C20D';
const GREY = '94A3B8';
const PURPLE = 'A78BFA';

const XiroSlideInserter = {

    // ── Diapositiva de podio ──────────────────────────────────

    /**
     * Genera una diapositiva de resultados al final de la presentación.
     * @param {{ ranking: Array, sessionId: string, gameName: string }} opts
     * @returns {Promise<void>}
     */
    async insertPodiumSlide({ ranking, sessionId, gameName }) {
        if (!this._isAvailable()) {
            console.warn('[SlideInserter] PowerPoint.run no disponible en esta plataforma.');
            return;
        }
        await PowerPoint.run(async (ctx) => {    // eslint-disable-line no-undef
            // Cargar count ANTES de añadir para saber el índice exacto de la nueva diapositiva.
            const slides = ctx.presentation.slides;
            slides.load('count');
            await ctx.sync();

            const insertIdx = slides.count; // índice 0-based de la nueva diapositiva
            slides.add();
            await ctx.sync();

            const newSlide = ctx.presentation.slides.getItemAt(insertIdx);
            this._buildPodiumSlide(newSlide, ranking || [], gameName || '', sessionId || '');
            await ctx.sync();
        });
    },

    // ── Diapositivas de lobby y preguntas (prep automática) ───

    /**
     * Genera las diapositivas de setup y preguntas en la presentación activa.
     * Establece marcadores XIRO en las notas del orador.
     * @param {{ pin, sessionId, gameName, questionCount, baseUrl }} opts
     * @returns {Promise<{ slideMap: Map, startIdx: number }>}
     */
    async insertGameSlides({ sessionId, gameName, questionCount, baseUrl }) {
        if (!this._isAvailable()) throw new Error('PowerPoint.run no disponible.');

        let startIdx;
        const slideMap = new Map();

        await PowerPoint.run(async (ctx) => {    // eslint-disable-line no-undef
            ctx.presentation.slides.load('count');
            await ctx.sync();
            startIdx = ctx.presentation.slides.count;

            const total = Math.max(1, questionCount) + 1; // +1 lobby
            for (let i = 0; i < total; i++) ctx.presentation.slides.add();
            await ctx.sync();

            // Cargar IDs de todos los nuevos slides
            const newSlides = [];
            for (let i = 0; i < total; i++) {
                const s = ctx.presentation.slides.getItemAt(startIdx + i);
                s.load('id');
                newSlides.push(s);
            }

            const joinUrl = `${baseUrl}/jugador.html?session=${encodeURIComponent(sessionId)}`;
            this._buildLobbySlide(newSlides[0], sessionId, gameName, joinUrl);
            for (let i = 0; i < questionCount; i++) {
                this._buildQuestionPlaceholder(newSlides[i + 1], i + 1, questionCount);
            }

            await ctx.sync();

            // Guardar marcadores en notas del orador
            await this._setNotes(newSlides[0], 'XIRO:{"role":"lobby"}');
            for (let i = 0; i < questionCount; i++) {
                await this._setNotes(newSlides[i + 1], `XIRO:{"role":"question","index":${i}}`);
            }
            await ctx.sync();

            slideMap.set(newSlides[0].id, { role: 'lobby' });
            newSlides.slice(1).forEach((s, i) => slideMap.set(s.id, { role: 'question', index: i }));
        });

        return { slideMap, startIdx };
    },

    // ── Builders de diapositivas ──────────────────────────────

    _buildLobbySlide(slide, sessionId, gameName, joinUrl) {
        this._addBg(slide);
        this._addText(slide, '⚡ Únete a la partida', { l: 40, t: 60, w: 640, h: 60 },
            { size: 32, color: WHITE, bold: true, alignH: 'center' });
        this._addText(slide, gameName || '', { l: 40, t: 120, w: 640, h: 36 },
            { size: 18, color: PURPLE, alignH: 'center' });
        this._addText(slide, 'Sesión:', { l: 40, t: 175, w: 640, h: 26 },
            { size: 13, color: GREY, alignH: 'center' });
        this._addText(slide, sessionId, { l: 40, t: 200, w: 640, h: 66 },
            { size: 38, color: WHITE, bold: true, alignH: 'center' });
        this._addText(slide, joinUrl, { l: 40, t: 480, w: 640, h: 30 },
            { size: 11, color: GREY, alignH: 'center' });
    },

    _buildQuestionPlaceholder(slide, num, total) {
        this._addBg(slide);
        this._addText(slide, `Pregunta ${num} / ${total}`, { l: 30, t: 30, w: 660, h: 40 },
            { size: 16, color: GREY, alignH: 'right' });
        this._addText(slide, '¿ … ?', { l: 60, t: 130, w: 600, h: 200 },
            { size: 40, color: WHITE, bold: true, alignH: 'center' });
    },

    _buildPodiumSlide(slide, ranking, gameName, sessionId) {
        this._addBg(slide);
        this._addText(slide, '¡Resultados!', { l: 40, t: 30, w: 640, h: 56 },
            { size: 34, color: GOLD, bold: true, alignH: 'center' });
        this._addText(slide, gameName, { l: 40, t: 84, w: 640, h: 30 },
            { size: 15, color: PURPLE, alignH: 'center' });

        const medals = ['🥇', '🥈', '🥉'];
        const top = ranking.slice(0, 3);
        top.forEach((p, i) => {
            const y = 140 + i * 76;
            this._addText(slide, `${medals[i] || (i + 1) + '.'} ${p.nickname || p.name || '—'}`,
                { l: 60, t: y, w: 440, h: 60 }, { size: 20, color: WHITE, bold: i === 0 });
            const pts = typeof p.score === 'number' ? p.score.toLocaleString() : '—';
            this._addText(slide, pts + ' pts',
                { l: 510, t: y, w: 160, h: 60 }, { size: 18, color: GOLD, alignH: 'right' });
        });

        if (sessionId) {
            this._addText(slide, `Sesión: ${sessionId}`,
                { l: 40, t: 500, w: 640, h: 26 }, { size: 11, color: GREY, alignH: 'center' });
        }
    },

    // ── Helpers ───────────────────────────────────────────────

    _addBg(slide) {
        const bg = slide.shapes.addGeometricShape(
            PowerPoint.GeometricShapeType.rectangle,     // eslint-disable-line no-undef
            { left: 0, top: 0, width: SLIDE.W, height: SLIDE.H }
        );
        bg.fill.setSolidColor(BG);
        bg.lineFormat.visible = false;
    },

    _addText(slide, text, pos, style) {
        const tb = slide.shapes.addTextBox(text, { left: pos.l, top: pos.t, width: pos.w, height: pos.h });
        tb.textFrame.textRange.font.size = style.size || 14;
        tb.textFrame.textRange.font.color = style.color || WHITE;
        tb.textFrame.textRange.font.bold = !!style.bold;
        tb.fill.setSolidColor(BG);
        if (style.alignH) {
            const align = { center: 'center', right: 'right', left: 'left' };
            tb.textFrame.textRange.paragraphFormat.horizontalAlignment =
                PowerPoint.ParagraphHorizontalAlignment[align[style.alignH] || 'left'];  // eslint-disable-line no-undef
        }
    },

    _setNotes(slide, notesText) {
        // Notes API requiere PowerPointApi 1.5; si no disponible, ignora silenciosamente
        try {
            if (slide.notes !== undefined) slide.notes = notesText;
        } catch {
            // plataforma sin soporte de notas — marcadores no disponibles
        }
    },

    _isAvailable() {
        return typeof PowerPoint !== 'undefined' && typeof PowerPoint.run === 'function';  // eslint-disable-line no-undef
    },
};
