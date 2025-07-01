import js from '@eslint/js';
import tsEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  // Apply to TypeScript and JavaScript files
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Cloudflare Workers globals
        KVNamespace: 'readonly',
        CryptoKeyPair: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        crypto: 'readonly',
        // Web API globals
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        // Environment globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsEslint,
    },
    rules: {
      // ESLint recommended rules
      ...js.configs.recommended.rules,

      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',

      // General rules
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      '.wrangler/',
      '**/*.test.ts',
      '**/*.spec.ts',
      'scripts/',
    ],
  },

  // Prettier config to disable conflicting rules
  prettier,
];
