/**
 * @fileoverview Configuración de interfaz de usuario (visibilidad de elementos del menú, etc.)
 * Persiste en ui-overrides.json dentro del volumen de la app.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'ui-overrides.json');

const TEAM_NAME_PATTERN = /^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑçÇàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛäëïöüÄËÏÖÜœŒæÆ\s._-]+$/;
const TEAM_NAME_MIN = 2;
const TEAM_NAME_MAX = 30;

// Nombres de equipo por defecto (se usarán si el admin no personaliza)
const DEFAULT_TEAM_NAMES = [
    'Relámpagos', 'Campeones', 'Halcones', 'Titanes',
    'Invencibles', 'Guerreros', 'Fénix', 'Dragones', 'Leones'
];

const DEFAULTS = {
    showTvCard: true,           // Muestra la tarjeta "Versión TV" en el menú principal
    showStandaloneCard: true,   // Muestra la tarjeta "Modo Standalone" en el menú principal
    teamNames: [...DEFAULT_TEAM_NAMES], // Nombres personalizados de equipos (1-9)

    // Configuración de fuegos artificiales del podio
    fireworksShellSize: 2,              // Tamaño de fuegos: 0 (pequeño) - 16 (enorme)
    fireworksFinaleMode: true,          // Modo finale (muchos fuegos simultáneos)
    fireworksSimSpeed: 1,               // Velocidad de simulación (0.1 - 3)
    fireworksLaunchIntervalMin: 900,    // Intervalo mínimo entre lanzamientos (ms)
    fireworksLaunchIntervalMax: 1500,   // Intervalo máximo entre lanzamientos (ms)
    fireworksMaxFinaleCount: 32,        // Máximo de fuegos en modo finale (8 - 64)
    fireworksTrailIntensity: 0.175,     // Intensidad del rastro de partículas (0.05 - 0.3)
    fireworksStarWidth: 3,              // Grosor de las estrellas (1 - 6)
    fireworksSparkWidth: 1,             // Grosor de las chispas (0.5 - 4)
    fireworksSound: false,              // Sonido de fuegos artificiales
};

let _store = { ...DEFAULTS };

const BOOLEAN_SETTINGS = new Set([
    'showTvCard',
    'fireworksFinaleMode',
    'fireworksSound'
]);

const STRING_ARRAY_SETTINGS = new Set(['teamNames']);

const RANGE_SETTINGS = {
    fireworksShellSize: {
        min: 0,
        max: 16,
        message: 'fireworksShellSize debe estar entre 0 y 16'
    },
    fireworksSimSpeed: {
        min: 0.1,
        max: 3,
        message: 'fireworksSimSpeed debe estar entre 0.1 y 3'
    },
    fireworksLaunchIntervalMin: {
        min: 100,
        max: 3000,
        message: 'fireworksLaunchIntervalMin debe estar entre 100 y 3000 ms'
    },
    fireworksLaunchIntervalMax: {
        min: 100,
        max: 3000,
        message: 'fireworksLaunchIntervalMax debe estar entre 100 y 3000 ms'
    },
    fireworksMaxFinaleCount: {
        min: 8,
        max: 64,
        message: 'fireworksMaxFinaleCount debe estar entre 8 y 64'
    },
    fireworksTrailIntensity: {
        min: 0.05,
        max: 0.3,
        message: 'fireworksTrailIntensity debe estar entre 0.05 y 0.3'
    },
    fireworksStarWidth: {
        min: 1,
        max: 6,
        message: 'fireworksStarWidth debe estar entre 1 y 6'
    },
    fireworksSparkWidth: {
        min: 0.5,
        max: 4,
        message: 'fireworksSparkWidth debe estar entre 0.5 y 4'
    }
};

function parseRangedNumber(key, value) {
    const rules = RANGE_SETTINGS[key];
    if (!rules) {
        return value;
    }

    const numericValue = Number(value);
    if (Number.isNaN(numericValue) || numericValue < rules.min || numericValue > rules.max) {
        throw new Error(rules.message);
    }
    return numericValue;
}

function _load() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            _store = { ...DEFAULTS, ...raw };
        }
    } catch {
        _store = { ...DEFAULTS };
    }
}

function get(key) {
    _load();
    return _store[key];
}

function getAll() {
    _load();
    return { ..._store };
}

function _validateTeamNames(names) {
    if (!Array.isArray(names) || names.length < 1 || names.length > 9) {
        throw new Error('teamNames debe ser un array de 1 a 9 nombres');
    }
    const validated = [];
    for (let i = 0; i < names.length; i++) {
        const name = String(names[i] || '').trim();
        if (name.length < TEAM_NAME_MIN || name.length > TEAM_NAME_MAX) {
            throw new Error(`Nombre #${i + 1} debe tener entre ${TEAM_NAME_MIN} y ${TEAM_NAME_MAX} caracteres`);
        }
        if (!TEAM_NAME_PATTERN.test(name)) {
            throw new Error(`Nombre #${i + 1} contiene caracteres no permitidos`);
        }
        validated.push(name);
    }
    return validated;
}

function set(key, value) {
    if (!(key in DEFAULTS)) throw new Error(`Ajuste de UI desconocido: ${key}`);

    if (BOOLEAN_SETTINGS.has(key)) {
        _store[key] = Boolean(value);
        return;
    }

    if (STRING_ARRAY_SETTINGS.has(key)) {
        _store[key] = _validateTeamNames(value);
        return;
    }

    _store[key] = parseRangedNumber(key, value);
}

function persistAll() {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(_store, null, 2), 'utf8');
}

_load();

module.exports = { get, set, getAll, persistAll };
