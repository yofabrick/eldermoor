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
        // Phase 0 unit baseline was lines 6.22% (568/9129). The small unit
        // files were removed in favour of browser end-to-end (`npm test`).
        // This v8 number is no longer the gate. Thresholds stay at 0.
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
