/**
 * @module notes-writer
 * @description Gestiona la metadata XIRO en tags de diapositiva y el marcador visual.
 *   - Tags (PowerPointApi 1.3+): almacenan {role,...} bajo 'XIRO_META'
 *   - Marcador (PowerPointApi 1.4+): text box en esquina superior derecha
 * @depends [shared/logger]
 */

const XiroNotesWriter = (() => {

    const TAG_KEY = 'XIRO_META';
    const MARKER_NAME = 'XIRO_ROLE_MARKER';
    const ROLE_LABELS = { lobby: 'XIRO: Lobby', question: 'XIRO: Pregunta', podium: 'XIRO: Podio' };
    const ROLE_COLORS = { lobby: '#7c3aed', question: '#1d4ed8', podium: '#d97706' };

    // ─── Indice de diapositiva seleccionada ─────────────────────────────── //

    function _getSelectedIndex() {
        return new Promise((resolve) => {
            try {
                Office.context.document.getSelectedDataAsync( // eslint-disable-line no-undef
                    Office.CoercionType.SlideRange,           // eslint-disable-line no-undef
                    (result) => {
                        if (result.status === Office.AsyncResultStatus.Succeeded // eslint-disable-line no-undef
                            && result.value && result.value.slides
                            && result.value.slides.length > 0) {
                            const idx = (result.value.slides[0].index || 1) - 1;
                            XiroLog.debug('notes-writer', '_getSelectedIndex OK', { idx }); // eslint-disable-line no-undef
                            resolve(idx);
                        } else {
                            XiroLog.warn('notes-writer', '_getSelectedIndex fallback', { // eslint-disable-line no-undef
                                status: result.status,
                                error: result.error && result.error.message
                            });
                            resolve(0);
                        }
                    }
                );
            } catch (err) {
                XiroLog.error('notes-writer', '_getSelectedIndex exception', err); // eslint-disable-line no-undef
                resolve(0);
            }
        });
    }

    // ─── API pública ─────────────────────────────────────────────────────── //

    async function readMeta() {
        const idx = await _getSelectedIndex();
        return PowerPoint.run(async (ctx) => { // eslint-disable-line no-undef
            const tag = ctx.presentation.slides
                .getItemAt(idx).tags.getItemOrNullObject(TAG_KEY);
            tag.load(['isNullObject', 'value']);
            await ctx.sync();
            XiroLog.debug('notes-writer', // eslint-disable-line no-undef
                'readMeta idx=' + idx + ' isNull=' + tag.isNullObject);
            if (tag.isNullObject) return null;
            try { return JSON.parse(tag.value); }
            catch (err) { XiroLog.warn('notes-writer', 'parse tag failed', err); return null; } // eslint-disable-line no-undef
        });
    }

    async function writeXiroMeta(meta) {
        const idx = await _getSelectedIndex();
        XiroLog.debug('notes-writer', 'writeXiroMeta idx=' + idx, meta); // eslint-disable-line no-undef
        await PowerPoint.run(async (ctx) => { // eslint-disable-line no-undef
            const slide = ctx.presentation.slides.getItemAt(idx);
            slide.tags.add(TAG_KEY, JSON.stringify(meta));
            await ctx.sync();
            await _syncMarker(ctx, slide, meta.role, meta);
            XiroLog.debug('notes-writer', 'writeXiroMeta OK'); // eslint-disable-line no-undef
        });
        _testInsertImage(meta.role);
    }

    async function _testInsertImage(role) {
        const paths = { lobby: '/images/xiro-lobby.png', question: '/images/xiro-pregunta.png', podium: '/images/xiro-podium.png' };
        const imgPath = paths[role];
        if (!imgPath) return;
        try {
            const r = await fetch(window.location.origin + imgPath + '?v=' + Date.now());
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const buf = await r.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = '';
            for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
            const base64 = btoa(bin);
            XiroLog.debug('notes-writer', '_testInsertImage base64 len=' + base64.length); // eslint-disable-line no-undef
            Office.context.document.setSelectedDataAsync(base64, { // eslint-disable-line no-undef
                coercionType: Office.CoercionType.Image, imageLeft: 36, imageTop: 118, imageWidth: 900 // eslint-disable-line no-undef
            }, (result) => {
                if (result.status === Office.AsyncResultStatus.Failed) { // eslint-disable-line no-undef
                    XiroLog.warn('notes-writer', '_testInsertImage FAILED: ' + result.error.message); // eslint-disable-line no-undef
                } else {
                    XiroLog.debug('notes-writer', '_testInsertImage OK'); // eslint-disable-line no-undef
                }
            });
        } catch (err) {
            XiroLog.warn('notes-writer', '_testInsertImage error: ' + err.message); // eslint-disable-line no-undef
        }
    }

    async function clearXiroMeta() {
        const idx = await _getSelectedIndex();
        XiroLog.debug('notes-writer', 'clearXiroMeta idx=' + idx); // eslint-disable-line no-undef
        await PowerPoint.run(async (ctx) => { // eslint-disable-line no-undef
            const slide = ctx.presentation.slides.getItemAt(idx);
            const tag = slide.tags.getItemOrNullObject(TAG_KEY);
            tag.load('isNullObject');
            await ctx.sync();
            if (!tag.isNullObject) { tag.delete(); await ctx.sync(); }
            await _syncMarker(ctx, slide, null, null);
            XiroLog.debug('notes-writer', 'clearXiroMeta OK'); // eslint-disable-line no-undef
        });
    }

    // ─── Marcador visual ─────────────────────────────────────────────────── //

    /**
     * Elimina el marcador anterior y crea uno nuevo si `role` no es null.
     * Se ejecuta dentro de un PowerPoint.run() existente (ctx compartido).
     * @private
     */
    async function _syncMarker(ctx, slide, role, meta) {
        // Cargar shapes para identificar y borrar marcador previo
        slide.shapes.load('items');
        await ctx.sync();
        slide.shapes.items.forEach(s => s.load('name'));
        await ctx.sync();
        slide.shapes.items
            .filter(s => s.name === MARKER_NAME)
            .forEach(s => s.delete());

        if (!role) { await ctx.sync(); return; }

        // Etiqueta con número de pregunta si aplica
        const extra = (role === 'question' && meta && meta.index != null)
            ? ' #' + (meta.index + 1) : '';
        const label = (ROLE_LABELS[role] || role.toUpperCase()) + extra;

        // Añadir text box — esquina superior derecha (slide 720 pt ancho)
        const shape = slide.shapes.addTextBox(label, {
            left: 530, top: 8, width: 183, height: 28,
        });
        shape.name = MARKER_NAME;

        // Estilo: fondo de color + texto blanco en negrita (1.4+, ignorar si falla)
        try {
            shape.fill.setSolidColor(ROLE_COLORS[role] || '#374151');
            const range = shape.textFrame.textRange;
            range.font.color = '#ffffff';
            range.font.size = 11;
            range.font.bold = true;
            shape.textFrame.topMargin = 4;
            shape.textFrame.leftMargin = 6;
            shape.textFrame.rightMargin = 6;
            shape.textFrame.bottomMargin = 4;
        } catch (_) { /* estilo es decorativo */ }

        await ctx.sync();
        XiroLog.debug('notes-writer', '_syncMarker done role=' + role); // eslint-disable-line no-undef
    }

    return { readMeta, writeXiroMeta, clearXiroMeta };
})();
