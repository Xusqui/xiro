/**
 * Copia el texto del paquete al portapapeles del sistema (lo que lee el botón «Pegar» de XiRo).
 * macOS: pbcopy (con locale UTF-8 para no estropear tildes); Linux: wl-copy, xclip o xsel.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const UTF8_ENV = { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' };
const sha = t => crypto.createHash('sha256').update(t).digest('hex');

const TOOLS =
    process.platform === 'darwin'
        ? [{ copy: ['pbcopy', []], paste: ['pbpaste', []] }]
        : [
              { copy: ['wl-copy', []], paste: ['wl-paste', ['--no-newline']] },
              { copy: ['xclip', ['-selection', 'clipboard']], paste: ['xclip', ['-selection', 'clipboard', '-o']] },
              { copy: ['xsel', ['--clipboard', '--input']], paste: ['xsel', ['--clipboard', '--output']] }
          ];

/** { tool, verified } si se pudo copiar, o null si no hay portapapeles (servidor, sandbox...). */
export function copyToClipboard(text) {
    for (const { copy, paste } of TOOLS) {
        const r = spawnSync(copy[0], copy[1], { input: text, env: UTF8_ENV, maxBuffer: 64 * 1024 * 1024 });
        if (r.error || r.status !== 0) continue;
        const back = spawnSync(paste[0], paste[1], { env: UTF8_ENV, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        const verified = !back.error && back.status === 0 && sha(back.stdout) === sha(text);
        return { tool: copy[0], verified };
    }
    return null;
}
