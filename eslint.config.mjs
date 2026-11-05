import tseslint from 'typescript-eslint';

// All game source, including the composition entry, follows the same lint rules.
export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'test-results/**', 'playwright-report/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', '*.config.ts'],
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  // Temporary exact-size ceilings for legacy files inflated by the initial Prettier pass.
  // Every other TypeScript file stays at 500 effective lines, and these files cannot grow.
  // Remove entries as the owning modules are split into focused, typed modules.
  ...Object.entries({
    'src/game/bootstrap.ts': 1489,
    'src/game/entities/mob-simulation.ts': 513,
    'src/game/interactions/block-interactions.ts': 578,
    'src/game/rendering/chunk-mesher.ts': 510,
    'src/game/rendering/texture-atlas.ts': 527,
    'src/game/ui/inventory-ui.ts': 731,
    'src/game/world/block-catalog.ts': 503,
  }).map(([file, max]) => ({
    files: [file],
    rules: {
      'max-lines': ['error', { max, skipBlankLines: true, skipComments: true }],
    },
  })),
);
