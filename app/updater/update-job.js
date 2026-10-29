/** @fileoverview Una actualización de Xiro!: copia de la base de datos, descarga de las imágenes nuevas,
 *  recreación de backend y backup, comprobación de que arranca la versión pedida y vuelta atrás si no. */
'use strict';
const { runDocker } = require('./docker');
const { composeArgs } = require('./deployment');
const { isValidVersion, sameVersion } = require('./version');

const SERVICES = ['backend', 'backup'];
const MAX_LOG_LINES = 100;

/** Trabajo de actualización de Xiro! */
class UpdateJob {
    /** @param {Object} options - Opciones del trabajo */
    constructor(options) {
        this.deployment = options.deployment;
        this.run = options.run || runDocker;
        this.fetchImpl = options.fetchImpl || globalThis.fetch;
        this.backendUrl = options.backendUrl || process.env.BACKEND_URL || 'http://backend:3000';
        this.sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
        this.now = options.now || (() => Date.now());
        this.verifyTimeoutMs = options.verifyTimeoutMs || 180000;
        this.pollMs = options.pollMs || 5000;
        this.status = {
            state: 'idle',
            step: null,
            targetVersion: null,
            startedAt: null,
            finishedAt: null,
            error: null,
            log: []
        };
    }

    /** Devuelve la fecha y hora actual en formato ISO */
    iso() {
        return new Date(this.now()).toISOString();
    }

    /** Genera los argumentos para docker-compose */
    compose(extra) {
        return composeArgs(this.deployment, extra);
    }

    /** Añade una entrada al registro */
    log(text) {
        if (!text) return;
        const lines = String(text).split('\n');
        for (const line of lines) {
            if (line.trim()) {
                const entry = '[' + this.iso() + '] ' + line;
                console.log(entry);
                this.status.log.push(entry);
                if (this.status.log.length > MAX_LOG_LINES) {
                    this.status.log.shift();
                }
            }
        }
    }

    /** Devuelve el estado actual del trabajo */
    getStatus() {
        return { ...this.status, log: this.status.log.slice() };
    }

    /** Inicia una actualización a la versión especificada */
    start(targetVersion) {
        if (!isValidVersion(targetVersion)) {
            throw new Error('Versión no válida: ' + targetVersion);
        }
        if (this.status.state === 'running') return false;

        this.status = {
            state: 'running',
            step: null,
            targetVersion,
            startedAt: this.iso(),
            finishedAt: null,
            error: null,
            log: []
        };

        this.execute().catch(err => this.finish('failed', err.message));

        return true;
    }

    /** Finaliza el trabajo de actualización */
    finish(state, error) {
        this.status.state = state;
        this.status.error = error;
        this.status.finishedAt = this.iso();
        this.log('Estado final: ' + state + (error ? ' - Error: ' + error : ''));
    }

    /** Inicia un nuevo paso en el trabajo */
    beginStep(name) {
        this.status.step = name;
        this.log('Paso ' + name);
    }

    /** Ejecuta el proceso de actualización completo */
    async execute() {
        const snapshots = [];
        try {
            this.beginStep('backup');
            const backup = await this.run(
                this.compose(['exec', '-T', 'backup', 'sh', '/scripts/docker-backup-run.sh']),
                { timeoutMs: 600000 }
            );
            this.log(backup.stdout);
            this.beginStep('snapshot');
            snapshots.push(...(await this.takeSnapshots()));
        } catch (err) {
            this.finish('failed', 'No se pudo preparar la actualización: ' + err.message);
            return;
        }
        try {
            this.beginStep('pull');
            await this.run(this.compose(['pull', ...SERVICES]), { timeoutMs: 900000 });
        } catch (err) {
            await this.restoreTags(snapshots).catch(() => {});
            this.finish('failed', 'No se pudieron descargar las imágenes: ' + err.message);
            return;
        }
        try {
            this.beginStep('recreate');
            await this.run(this.compose(['up', '-d', '--no-deps', ...SERVICES]), { timeoutMs: 600000 });
            this.beginStep('verify');
            await this.waitForBackend(this.status.targetVersion);
        } catch (err) {
            await this.rollback(snapshots, err);
            return;
        }
        this.log('Actualizado a la versión ' + this.status.targetVersion);
        this.finish('done', null);
    }

    /** Toma instantáneas de las imágenes actuales */
    async takeSnapshots() {
        const snapshots = [];
        for (const service of SERVICES) {
            const psResult = await this.run(this.compose(['ps', '-q', service]));
            const id = psResult.stdout.trim();
            if (!id) continue;
            const inspectResult = await this.run(['inspect', '--format', '{{.Image}} {{.Config.Image}}', id]);
            const out = inspectResult.stdout.trim();
            const [imageId, ref] = out.split(' ', 2);
            if (imageId) snapshots.push({ service, imageId, ref });
        }
        return snapshots;
    }

    /** Restaura las etiquetas de imagen desde las instantáneas */
    async restoreTags(snapshots) {
        for (const s of snapshots) {
            await this.run(['tag', s.imageId, s.ref]);
        }
    }

    /** Revierte la actualización usando las instantáneas */
    async rollback(snapshots, cause) {
        this.beginStep('rollback');
        this.log('Causa del fallo: ' + cause.message);
        try {
            await this.restoreTags(snapshots);
            await this.run(this.compose(['up', '-d', '--no-deps', '--pull', 'never', ...SERVICES]), {
                timeoutMs: 600000
            });
            this.finish('rolled_back', cause.message);
        } catch (err) {
            this.finish('failed', cause.message + ' / vuelta atrás: ' + err.message);
        }
    }

    /** Espera a que el backend esté listo para la versión especificada */
    async waitForBackend(version) {
        const deadline = this.now() + this.verifyTimeoutMs;
        while (this.now() < deadline) {
            if (await this.backendReady(version)) return;
            await this.sleep(this.pollMs);
        }
        throw new Error(
            'El backend no ha arrancado con la versión ' +
                version +
                ' en ' +
                Math.round(this.verifyTimeoutMs / 1000) +
                ' s'
        );
    }

    /** Verifica si el backend está listo para la versión especificada */
    async backendReady(version) {
        try {
            const v = await this.fetchImpl(this.backendUrl + '/api/version', { signal: AbortSignal.timeout(5000) });
            if (!v.ok) return false;
            const body = await v.json();
            if (!sameVersion(body.version, version)) return false;
            const r = await this.fetchImpl(this.backendUrl + '/ready', { signal: AbortSignal.timeout(5000) });
            return r.status === 200;
        } catch {
            return false;
        }
    }
}

/** Crea el trabajo de actualización; devuelve solo la interfaz pública. */
function createJob(options) {
    const job = new UpdateJob(options);
    return { getStatus: () => job.getStatus(), start: version => job.start(version) };
}

module.exports = { createJob, UpdateJob };
