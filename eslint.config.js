import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const browserGlobals = {
  AbortController: 'readonly',
  Blob: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  document: 'readonly',
  File: 'readonly',
  FormData: 'readonly',
  Headers: 'readonly',
  Image: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  window: 'readonly',
};

const nodeGlobals = {
  Buffer: 'readonly',
  console: 'readonly',
  globalThis: 'readonly',
  process: 'readonly',
};

const testGlobals = {
  afterEach: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  test: 'readonly',
  vi: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      '.codex/**',
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'encore/.encore/**',
      'encore/encore.gen/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['api/**/*.js', 'lib/**/*.js', 'server.ts'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
        crypto: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-debugger': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: browserGlobals,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'preserve-caught-error': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.{ts,tsx}', 'encore/**/*.ts', 'lib/server/**/*.js'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
        crypto: 'readonly',
        fetch: 'readonly',
        ...testGlobals,
      },
    },
    rules: {
      'no-console': 'off',
      'no-debugger': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/components/GoogleCoordinatePicker.tsx', 'src/components/PropertyMap.tsx', 'src/lib/google-maps.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
