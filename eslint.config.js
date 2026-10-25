import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'Design/',
      'Resources/',
      'dist/',
      'dist-e2e/',
      'review/',
      'test-results/',
      'playwright-report/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['e2e/**/*.ts', 'scripts/**/*.mjs', '*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['public/sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  // CLAUDE.md rule 1: src/sim/ is pure and deterministic.
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'zustand'],
          patterns: ['**/ui/**', '**/state/**', '**/testing/**', 'react-dom/*'],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Take time as a parameter.' },
        { object: 'Math', property: 'random', message: 'Take a seeded RNG as a parameter.' },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'performance',
        'requestAnimationFrame',
        'localStorage',
      ],
    },
  },
  prettier,
);
