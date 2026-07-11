import js from '@eslint/js';
export default [
  {
    ignores: ['dist/**', '.astro/**', 'generated/**', '**/*.ts', '**/*.astro'],
  },
  js.configs.recommended,
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        FormData: 'readonly',
        getComputedStyle: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
];
