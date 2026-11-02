import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['node_modules', 'dist', 'coverage', 'test-results'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react/jsx-uses-vars': 'error',          // components used only in JSX are not "unused"
      'react-hooks/rules-of-hooks': 'error',   // hooks must be called the right way
      'react-hooks/exhaustive-deps': 'warn',   // missing useEffect dependencies
      'no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
      eqeqeq: 'error',                         // always use === instead of ==
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
  {
    // test files
    files: ['src/__tests__/**', 'src/setupTests.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // config files run in Node
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
