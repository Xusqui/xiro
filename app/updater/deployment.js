/** @fileoverview Descubre el proyecto Compose del host (etiquetas del propio contenedor) y prepara las rutas para poder ejecutar docker compose desde el actualizador */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { dockerApiGet } = require('./docker');

const DEPLOY_MOUNT = process.env.DEPLOY_MOUNT || '/deploy';

/**
 * Descubre cómo se desplegó el proyecto
 * @param {Object} options - Opciones
 * @param {Function} options.apiGet - Función para hacer peticiones a la API de Docker
 * @param {string} options.hostname - Nombre del host
 * @returns {Promise<{ project: string, workingDir: string, configFiles: string[] }>} Información del despliegue
 */
function discoverDeployment(options = {}) {
    const apiGet = options.apiGet || dockerApiGet;
    const hostname = options.hostname || os.hostname();

    return apiGet('/containers/' + encodeURIComponent(hostname) + '/json').then(info => {
        const labels = (info && info.Config && info.Config.Labels) || {};
        const project = labels['com.docker.compose.project'];
        const workingDir = labels['com.docker.compose.project.working_dir'];
        const configFiles = labels['com.docker.compose.project.config_files'];

        if (!project || !workingDir || !configFiles) {
            throw new Error('El actualizador no se ha arrancado con Docker Compose (faltan etiquetas)');
        }

        if (!path.isAbsolute(workingDir)) {
            throw new Error('La carpeta del despliegue no es una ruta absoluta: ' + workingDir);
        }

        const files = configFiles
            .split(',')
            .map(f => f.trim())
            .filter(f => f);
        for (const file of files) {
            if (!file.startsWith(workingDir + '/')) {
                throw new Error(`El archivo de configuración ${file} no está dentro del directorio de trabajo`);
            }
        }

        return { project, workingDir, configFiles: files };
    });
}

/**
 * Crea un enlace simbólico para que el directorio de trabajo esté disponible en el contenedor
 * @param {string} workingDir - Directorio de trabajo
 * @param {Object} options - Opciones
 * @param {Object} options.fsImpl - Implementación de fs a usar
 * @param {string} options.mount - Punto de montaje
 * @description Hace que la ruta del host exista dentro del contenedor como enlace al montaje /deploy, para que docker compose resuelva las rutas relativas (./public, .env, env_file) igual que en el host y envíe al daemon las rutas absolutas correctas.
 */
function linkWorkingDir(workingDir, options = {}) {
    const fsImpl = options.fsImpl || fs;
    const mount = options.mount || DEPLOY_MOUNT;

    if (workingDir === mount) return;

    if (fsImpl.existsSync(workingDir)) {
        if (fsImpl.lstatSync(workingDir).isSymbolicLink() && fsImpl.readlinkSync(workingDir) === mount) {
            return;
        }
        throw new Error('La ruta ' + workingDir + ' ya existe dentro del actualizador');
    }

    fsImpl.mkdirSync(path.dirname(workingDir), { recursive: true });
    fsImpl.symlinkSync(mount, workingDir);
}

/**
 * Genera los argumentos para docker compose
 * @param {Object} deployment - Información del despliegue
 * @param {string[]} extra - Argumentos adicionales
 * @returns {string[]} Argumentos para docker compose
 */
function composeArgs(deployment, extra) {
    const args = ['compose', '-p', deployment.project, '--project-directory', deployment.workingDir];
    for (const file of deployment.configFiles) {
        args.push('-f', file);
    }
    return args.concat(extra || []);
}

module.exports = { discoverDeployment, linkWorkingDir, composeArgs };
