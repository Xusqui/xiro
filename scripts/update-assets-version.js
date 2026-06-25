const fs = require('fs');
const path = require('path');

// Directorio donde están los archivos HTML públicos
const PUBLIC_DIR = path.join(__dirname, '..', 'app', 'public');

// Regex para encontrar src="...js" o href="...css" y capturar la ruta base.
// Ignora las rutas que empiezan con http:// o https://
const JS_REGEX = /src="(?!https?:\/\/)([^"]+\.js)(?:\?v=[a-zA-Z0-9_-]+)?"/g;
const CSS_REGEX = /href="(?!https?:\/\/)([^"]+\.css)(?:\?v=[a-zA-Z0-9_-]+)?"/g;

// Regex para encontrar imports ES6 en archivos .js: import/export ... from '...js' o import('...js')
const JS_IMPORT_REGEX = /(from\s+|import\s+|import\s*\(\s*)(['"])(?!https?:\/\/)([^'"]+\.js)(?:\?v=[a-zA-Z0-9_-]+)?\2/g;

function getTimestamp() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function processDirectory(directory, timestamp) {
    const files = fs.readdirSync(directory);

    let updatedFilesCount = 0;

    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            updatedFilesCount += processDirectory(fullPath, timestamp);
        } else if (stat.isFile() && (fullPath.endsWith('.html') || fullPath.endsWith('.js')) && !file.startsWith('._')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            let newContent = content;

            if (fullPath.endsWith('.html')) {
                newContent = content
                    .replace(JS_REGEX, (match, p1) => {
                        modified = true;
                        return `src="${p1}?v=${timestamp}"`;
                    })
                    .replace(CSS_REGEX, (match, p1) => {
                        modified = true;
                        return `href="${p1}?v=${timestamp}"`;
                    });
            } else if (fullPath.endsWith('.js')) {
                newContent = content
                    .replace(JS_IMPORT_REGEX, (match, prefix, quote, fileUrl) => {
                        modified = true;
                        return `${prefix}${quote}${fileUrl}?v=${timestamp}${quote}`;
                    });
                    
                if (file === 'i18n-core.js') {
                    const VERSION_REGEX = /version:\s*(['"])([^'"]+)\1/;
                    if (VERSION_REGEX.test(newContent)) {
                        newContent = newContent.replace(VERSION_REGEX, `version: $1${timestamp}$1`);
                        modified = true;
                        console.log(`✅ Actualizada variable interna de caché (CONFIG.version) en i18n-core.js`);
                    }
                }
            }

            if (modified) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log(`✅ Actualizado: ${fullPath.replace(PUBLIC_DIR, '')}`);
                updatedFilesCount++;
            }
        }
    }

    return updatedFilesCount;
}

function main() {
    console.log('Iniciando actualización de versiones de assets (.js, .css)...');
    const timestamp = getTimestamp();
    console.log(`Nueva versión generada: v=${timestamp}\n`);

    const updated = processDirectory(PUBLIC_DIR, timestamp);

    console.log(`\n🎉 Proceso completado. Se han actualizado los assets en ${updated} archivos (HTML y JS).`);
}

main();
