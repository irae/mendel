const js = require('@eslint/js');
const react = require('eslint-plugin-react');
const implicitDependencies = require('eslint-plugin-implicit-dependencies');
const globals = require('globals');

module.exports = [
    {
        ignores: [
            '**/node_modules/**',
            '**/coverage/**',
            '**/build/**',
            '**/.nyc_output/**',
            '**/mendel-build/**',
            '**/build-requirify/**',
            '**/fixtures/**',
            '**/.mendel-runs/**',
            '**/.tap.coverage.map.js',
            'legacy-packages/**',
        ],
    },
    js.configs.recommended,
    {
        files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
        ...react.configs.flat.recommended,
        languageOptions: {
            ...react.configs.flat.recommended.languageOptions,
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
            },
        },
        plugins: {
            ...react.configs.flat.recommended.plugins,
            'implicit-dependencies': implicitDependencies,
        },
        settings: {
            react: {
                version: '18.0.0',
            },
        },
        rules: {
            ...react.configs.flat.recommended.rules,
            // Legacy examples and packages predate these react rules.
            'react/display-name': 'off',
            'react/prop-types': 'off',
            'react/no-find-dom-node': 'off',
            // catch (e) {} is common when only the throw path matters
            'no-unused-vars': [
                'error',
                {
                    caughtErrors: 'none',
                },
            ],
            'no-constant-binary-expression': 'off',
            'no-prototype-builtins': 'off',
            'implicit-dependencies/no-implicit': [
                'error',
                {
                    dev: true,
                    peer: true,
                    optional: false,
                },
            ],
        },
    },
    {
        files: [
            '**/test/**/*.{js,jsx}',
            '**/_test_/**/*.{js,jsx}',
            '**/*_test.js',
            '**/*_test.jsx',
        ],
        languageOptions: {
            globals: {
                ...globals.mocha,
                ...globals.jasmine,
            },
        },
    },
    // browser/main package.json stubs (not real packages) confuse the plugin
    {
        files: [
            'examples/full-example/src/isomorphic/base/components/about/**/*.{js,jsx}',
        ],
        rules: {
            'implicit-dependencies/no-implicit': 'off',
        },
    },
];
