import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import parser from '@typescript-eslint/parser';
import tsplugin from '@typescript-eslint/eslint-plugin';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  { 
    files: ['**/*.{ts,tsx}'],
    ...tsplugin.configs.recommended,
    rules: { ...tsplugin.configs.recommended.rules }
  },
  {
    files: ['**/*.{js,ts,tsx}'],
    ...prettierPlugin.configs.recommended,
    rules: { ...prettierPlugin.configs.recommended.rules }
  },
  {
    files: ['**/*.{js,ts,tsx}'],
    ...reactHooks.configs.recommended,
    rules: { ...reactHooks.configs.recommended.rules }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      prettier: prettierPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'prettier/prettier': 'error',
    },
  },
];
