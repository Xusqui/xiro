const fs = require('fs');
const crypto = require('crypto');

const files = [
    'public/presentador.html',
    'public/index.html',
    'public/tv.html',
    'public/contact.html',
    'public/juego-concluido.html',
    'public/juego-finalizado-presentador.html',
    'public/ppt-redirect.html',
    'public/health.html',
    'public/fireworks-preview.html',
    'public/xiro-results-viewer.html',
    'public/about.html'
];

const regex = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;

function hash(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('base64');
}

for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const blocks = [...html.matchAll(regex)];
    if (!blocks.length) {
        continue;
    }

    console.log('\n# ' + file);
    blocks.forEach((block, idx) => {
        const scriptContent = block[1];
        const sha = hash(scriptContent);
        const preview = scriptContent.trim().slice(0, 90).replace(/\s+/g, ' ');
        console.log(String(idx + 1) + '. sha256-' + sha + ' :: ' + preview);
    });
}
