const js = require('@eslint/js');
const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
    js.configs.recommended,
    react.configs.flat.recommended,
    {
        files: ['frontend/**/*.{js,jsx,ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {ecmaFeatures: {jsx: true}},
            globals: globals.browser,
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react-hooks': reactHooks,
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'error',
            'react/prop-types': 'off',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
        settings: {react: {version: 'detect'}},
    },
    {
        files: ['frontend/**/*.test.ts'],
        languageOptions: {globals: {...globals.browser, ...globals.jest}},
    },
];
