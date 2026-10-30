export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/android/**',
      '**/.idea/**',
      '**/scratch/**',
      'packages/mobile/android/**',
      'packages/mobile/dist/**',
    ],
  },
  {
    files: ['packages/**/*.js', 'packages/**/*.mjs'],
    rules: {
      'no-undef': 'off', // Node/ESM globals handled by runtime
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-constant-condition': 'warn',
    },
  },
];
