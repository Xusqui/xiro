/**
 * @module notes-parser
 * @description Parsea la línea XIRO: en las notas del orador de una diapositiva.
 *   Formato: XIRO:{"role":"lobby","gameId":14,"mode":"individual"}
 *   Las notas pueden contener texto adicional — solo se procesa la línea XIRO.
 * @depends []
 *
 * Roles válidos: 'lobby' | 'question' | 'podium'
 * Esquema por rol:
 *   lobby:    { role:'lobby',    gameId:number, mode:'individual'|'teams', teams?:string[] }
 *   question: { role:'question', index:number }
 *   podium:   { role:'podium' }
 */

const XiroNotesParser = (() => {

    const XIRO_RE = /^XIRO:(\{.+\})$/m;

    /**
     * Extrae y parsea la línea XIRO de un texto de notas.
     * @param {string|null|undefined} notes
     * @returns {{ role: string, [key: string]: any }|null}
     */
    function parse(notes) {
        if (!notes || typeof notes !== 'string') return null;
        const m = notes.match(XIRO_RE);
        if (!m) return null;
        try {
            const meta = JSON.parse(m[1]);
            if (!meta || typeof meta.role !== 'string') return null;
            return meta;
        } catch (_) {
            return null;
        }
    }

    /**
     * Serializa un objeto meta a la línea XIRO para escribir en notas.
     * @param {{ role: string, [key: string]: any }} meta
     * @returns {string}  ej: 'XIRO:{"role":"lobby","gameId":14,"mode":"individual"}'
     */
    function serialize(meta) {
        return 'XIRO:' + JSON.stringify(meta);
    }

    /**
     * Reemplaza (o inserta) la línea XIRO en un texto de notas existente.
     * Conserva el resto del texto.
     * @param {string} notes  — texto actual de las notas
     * @param {{ role: string, [key: string]: any }} meta
     * @returns {string}      — notas actualizadas
     */
    function upsert(notes, meta) {
        const line = serialize(meta);
        const existing = (notes || '').replace(XIRO_RE, '');
        const clean = existing.replace(/^\n+|\n+$/g, '');
        return clean ? clean + '\n' + line : line;
    }

    /**
     * Elimina la línea XIRO del texto de notas.
     * @param {string} notes
     * @returns {string}
     */
    function remove(notes) {
        return (notes || '').replace(XIRO_RE, '').replace(/^\n+|\n+$/g, '');
    }

    return { parse, serialize, upsert, remove };
})();
