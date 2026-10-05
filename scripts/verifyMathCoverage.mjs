import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const summary = JSON.parse(await readFile(new URL('../coverage/math/coverage-summary.json', import.meta.url), 'utf8'));
const expected = ['pokerEvaluator.ts', 'combatCalculator.ts'].map(file => fileURLToPath(new URL(`../packages/shared/src/${file}`, import.meta.url)));
assert.deepEqual(Object.keys(summary).filter(key => key !== 'total').sort(), [...expected].sort(), 'Coverage must include both required source files');
for (const file of expected) for (const metric of ['statements', 'branches', 'functions', 'lines']) {
  const result = summary[file]?.[metric];
  assert(result && Number.isInteger(result.total) && result.total > 0, `${file}: empty ${metric} coverage`);
  assert.equal(result.covered, result.total, `${file}: incomplete ${metric} coverage`);
  assert.equal(result.skipped, 0, `${file}: skipped ${metric} coverage`);
}
console.log('Math coverage verified: both source files, all four metrics 100%, no empty or skipped coverage.');
