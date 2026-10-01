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
        // Baseline is intentionally low; raise per phase (see docs/ARCHITECTURE.md).
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
