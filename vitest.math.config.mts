import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { alias: { '@cyberante/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)) } },
  test: {
    include: ['packages/server/src/__tests__/evaluator.test.ts', 'packages/server/src/__tests__/combat.test.ts'],
    maxWorkers: 1,
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['packages/shared/src/pokerEvaluator.ts', 'packages/shared/src/combatCalculator.ts'],
      reporter: ['text', 'json-summary', 'json'],
      reportsDirectory: 'coverage/math',
      thresholds: { perFile: true, statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
