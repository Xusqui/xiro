const publicLint = require('./eslint-public-globals.json');

module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true,
    },
    extends: [
        'eslint:recommended',
    ],
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
    },
    plugins: ['node', 'jest'],
    rules: {
        // Errores críticos
        'no-undef': 'error',
        'no-unused-vars': ['warn', {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_'
        }],
        'no-console': 'off', // Permitido en Node.js

        // Complejidad y mantenibilidad
        'complexity': ['warn', 15], // Detectar funciones complejas
        'max-lines-per-function': ['warn', {
            max: 100,
            skipBlankLines: true,
            skipComments: true
        }],
        'max-depth': ['warn', 4],
        'max-nested-callbacks': ['warn', 3],
        'max-params': ['warn', 5],

        // Mejores prácticas
        'eqeqeq': ['error', 'always'], // Usar === en vez de ==
        'no-var': 'warn', // Preferir let/const
        'prefer-const': 'warn',
        'no-throw-literal': 'error',
        'require-await': 'warn',

        // Estilo (warnings, no errores)
        'semi': ['warn', 'always'],
        'quotes': ['warn', 'single', { allowTemplateLiterals: true }],
        'indent': ['warn', 4, { SwitchCase: 1 }],

        // Node.js específico
        'node/no-unsupported-features/es-syntax': 'off',
        'node/no-missing-require': 'error',
        'node/no-unpublished-require': 'off',

        // Jest
        'jest/no-disabled-tests': 'warn',
        'jest/no-focused-tests': 'error',
        'jest/valid-expect': 'error',
    },
    overrides: [
        {
            files: ['**/*.test.js', '**/__tests__/**/*.js'],
            rules: {
                // Jest usa describe/it anidados por diseño y funciones largas para
                // escenarios de integración; estas reglas aportan más ruido que señal en tests.
                'max-nested-callbacks': 'off',
                'max-lines-per-function': 'off',
                // Los mocks (fetch, json…) deben devolver promesas aunque no usen await.
                'require-await': 'off'
            }
        },
        {
            // Frontend: navegador, mezcla de módulos ES y <script> clásicos que
            // comparten globales (listas generadas con `npm run lint:globals`).
            // Los scripts clásicos se analizan como 'script': así sus declaraciones
            // de nivel superior son globales y ni no-unused-vars ni prefer-const
            // las tocan (se usan/reasignan desde otros ficheros).
            files: ['public/**/*.js'],
            env: { browser: true, node: false, jest: false },
            parserOptions: { ecmaVersion: 'latest', sourceType: 'script' },
            globals: {
                ...publicLint.globals,
                // Librerías cargadas por <script> (CDN / servidor Socket.IO)
                io: 'readonly', QRCode: 'readonly', QRCodeStyling: 'readonly', Office: 'readonly',
                // Solo se usan tras `typeof X !== 'undefined'` (exportar a Jest / detectar Node)
                module: 'readonly', process: 'readonly'
            },
            rules: {
                // Las funciones de nivel superior se usan desde otros scripts o desde el HTML.
                'no-unused-vars': ['warn', { vars: 'local', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
                'no-redeclare': ['error', { builtinGlobals: false }],
                'no-empty': ['error', { allowEmptyCatch: true }],
                'eqeqeq': ['error', 'always', { null: 'ignore' }],
                // El frontend genera HTML con plantillas largas pero lineales; con los
                // límites del backend (15 / 100) los avisos no distinguían eso de la
                // lógica realmente enrevesada.
                'complexity': ['warn', 20],
                'max-lines-per-function': ['warn', { max: 150, skipBlankLines: true, skipComments: true }],
                // prefer-const no ve las reasignaciones desde otros scripts: su autofix
                // convertía globales compartidas en const y rompía el panel en ejecución.
                'prefer-const': 'off',
                'node/no-missing-require': 'off'
            }
        },
        {
            // Adaptaciones de código de terceros (fuegos artificiales, fondo animado)
            // y ejemplos que no carga ninguna página: no se refactorizan.
            files: ['public/js/fireworks/**/*.js', 'public/js/animation.js', 'public/js/core/EXAMPLES.js'],
            rules: {
                'complexity': 'off',
                'max-lines-per-function': 'off',
                'max-params': 'off',
                'max-depth': 'off',
                'max-nested-callbacks': 'off'
            }
        },
        {
            files: publicLint.modules,
            parserOptions: { sourceType: 'module' },
            rules: { 'prefer-const': 'warn' }
        },
        {
            files: ['public/**/__tests__/**/*.js'],
            env: { browser: true, node: true, jest: true }
        }
    ],
    ignorePatterns: [
        'node_modules/',
        'coverage/',
        '*.min.js',
        '**/._*',
    ],
};
