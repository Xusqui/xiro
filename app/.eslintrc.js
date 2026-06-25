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
                'max-lines-per-function': 'off'
            }
        }
    ],
    ignorePatterns: [
        'node_modules/',
        'coverage/',
        'public/',
        '*.min.js',
    ],
};
