#!/usr/bin/env node
'use strict';

// Añade a CHANGELOG.md la entrada de una versión con lo que describen los
// commits hechos desde el último commit «Versión X». Uso:
//   node scripts/update-changelog.js 3.11.1

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md');
const VERSION_FORMAT = /^\d+\.\d+\.\d+[0-9A-Za-z.-]*$/;
const TRAILER = /^[A-Za-z-]+-by:\s/i;
const BULLET = /^\s*(?:[-*•]|\d+[.)]-?)\s+(.*)$/;
const LABELLED_SUBJECT = /^([^:]{1,30}):\s+(.+)$/;

/**
 * Ejecuta git en la raíz del repositorio.
 * @param {string[]} args Argumentos de git.
 * @returns {string} Salida estándar.
 * @throws {Error} Si git termina con error.
 */
function runGit(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

/**
 * Lee los mensajes de los commits posteriores al último commit de versión.
 * Ignora los que solo tocan CHANGELOG.md: no son novedades del producto.
 * @returns {string[]} Mensajes completos, del más antiguo al más reciente.
 * @throws {Error} Si la historia no tiene ningún commit de versión.
 */
function readPendingCommitMessages() {
  const lastVersionCommit = runGit(['log', '-1', '--format=%H', '--grep=^Versión [0-9]']).trim();
  if (!lastVersionCommit) throw new Error('no hay ningún commit «Versión X» en la historia');
  const log = runGit([
    'log', '--reverse', '--no-merges', '--format=%B%x00',
    `${lastVersionCommit}..HEAD`, '--', '.', ':!CHANGELOG.md',
  ]);
  return log.split('\0').map((message) => message.trim()).filter(Boolean);
}

/**
 * Extrae los puntos del cuerpo de un commit, uniendo las líneas partidas.
 * @param {string[]} bodyLines Líneas del cuerpo, sin el asunto.
 * @returns {string[]} Un texto por cada punto.
 */
function parseBodyItems(bodyLines) {
  const items = [];
  let canContinue = false;
  for (const line of bodyLines) {
    if (!line.trim()) { canContinue = false; continue; }
    if (TRAILER.test(line.trim())) continue;
    const bullet = line.match(BULLET);
    if (bullet) {
      items.push(bullet[1].trim());
      canContinue = true;
    } else if (canContinue && /^\s/.test(line)) {
      items[items.length - 1] += ` ${line.trim()}`;
    } else {
      items.push(line.trim());
      canContinue = false;
    }
  }
  return items;
}

/**
 * Convierte un mensaje de commit en viñetas de Markdown.
 * @param {string} message Mensaje completo del commit.
 * @returns {string} Asunto como viñeta y cuerpo como subviñetas.
 */
function formatCommit(message) {
  const [subject, ...bodyLines] = message.split('\n');
  const labelled = subject.match(LABELLED_SUBJECT);
  const title = labelled ? `**${labelled[1]}:** ${labelled[2]}` : subject;
  const details = parseBodyItems(bodyLines).map((item) => `  - ${item}`);
  return [`- ${title}`, ...details].join('\n');
}

/**
 * Compone la entrada de una versión con el formato del historial.
 * @param {string} version Versión tal como se etiqueta (ej. 3.9.1a).
 * @param {string[]} messages Mensajes de commit.
 * @param {string} date Fecha AAAA-MM-DD.
 * @returns {string} Bloque Markdown de la entrada.
 */
function buildEntry(version, messages, date) {
  const displayVersion = version.replace(/^(\d+\.\d+\.\d+)([a-z]+)$/i, '$1-$2');
  const header = `### ${displayVersion} — ${date} · \`v${version}\``;
  return [header, ...messages.map(formatCommit)].join('\n');
}

/**
 * Inserta la entrada al principio de su rama, creando la rama si es nueva.
 * @param {string} changelog Contenido actual.
 * @param {string} version Versión de la entrada.
 * @param {string} entry Bloque Markdown de la entrada.
 * @returns {string} Contenido nuevo.
 * @throws {Error} Si el historial no tiene ninguna sección «## ».
 */
function insertEntry(changelog, version, entry) {
  const series = version.match(/^\d+\.\d+/)[0];
  const heading = `## ${series}.x`;
  const existing = changelog.match(new RegExp(`^${heading.replace(/\./g, '\\.')}\\s*\\n`, 'm'));
  if (existing) {
    const restStart = existing.index + existing[0].length;
    return `${changelog.slice(0, existing.index)}${heading}\n\n${entry}\n\n${changelog.slice(restStart)}`;
  }
  const firstSection = changelog.search(/^## /m);
  if (firstSection === -1) throw new Error('CHANGELOG.md no tiene ninguna sección «## »');
  return `${changelog.slice(0, firstSection)}${heading}\n\n${entry}\n\n---\n\n${changelog.slice(firstSection)}`;
}

/**
 * Actualiza CHANGELOG.md para una versión; no hace nada si ya está registrada
 * o si no hay commits nuevos.
 * @param {string} version Versión nueva.
 * @returns {void}
 * @throws {Error} Si la versión no es válida o falla git o el fichero.
 */
function updateChangelog(version) {
  if (!VERSION_FORMAT.test(version || '')) throw new Error(`versión no válida: «${version}»`);
  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  if (changelog.includes(`· \`v${version}\``)) {
    console.log(`ℹ️  CHANGELOG.md ya tiene la versión ${version}: no se modifica.`);
    return;
  }
  const messages = readPendingCommitMessages();
  if (messages.length === 0) {
    console.log('⚠️  No hay commits nuevos desde la última versión: CHANGELOG.md no se modifica.');
    return;
  }
  // sv-SE da AAAA-MM-DD en hora local; toISOString() cambiaría de día de madrugada.
  const entry = buildEntry(version, messages, new Date().toLocaleDateString('sv-SE'));
  fs.writeFileSync(CHANGELOG_PATH, insertEntry(changelog, version, entry));
  console.log(entry);
}

try {
  updateChangelog(process.argv[2]);
} catch (error) {
  console.error(`❌ No se pudo actualizar CHANGELOG.md: ${error.message}`);
  process.exit(1);
}
