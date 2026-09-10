import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptRules from 'eslint-config-next/typescript';

/**
 * eslint-config-next 16 exports flat config directly, so no eslintrc compatibility
 * shim is needed here.
 */
const config = [
  ...coreWebVitals,
  ...typescriptRules,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // The seed and the image generator are scripts; printing progress is the point.
    files: ['prisma/**/*.ts', 'scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
];

export default config;
