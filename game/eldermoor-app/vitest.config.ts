import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      // Three.js is a types+runtime dependency of the render layer, not game
      // logic. Counting it would make the number meaningless.
      exclude: ['**/*.test.ts', '**/node_modules/**', 'dist/**', 'coverage/**'],
      thresholds: {
        // Phase 0 baseline, measured 2026-10-01 with `npm run test:coverage`:
        // lines 6.22% (568/9129), statements 6.22% (568/9129),
        // functions 43.10% (50/116), branches 62.14% (87/140).
        // Branch % is inflated: v8 reports a single synthetic branch on many
        // untested files. Line coverage of logic modules is the number to raise.
        // Thresholds stay at 0 until Phase 2 locks a logic-coverage floor.
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
