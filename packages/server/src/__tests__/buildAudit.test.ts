import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { auditProductionBuild } from '../../../../scripts/verifyBuild.mjs';
let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'cyberante-build-audit-')); await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'index.html'), '<script type="module" src="/assets/app.js"></script>');
  await writeFile(path.join(root, 'assets/app.js'), 'console.log("CYBERANTE")');
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
describe('Spec-10B production artifact gates', () => {
  it('counts gzip bytes across every chunk, including diagnostic entries', async () => {
    await writeFile(path.join(root, 'assets/benchmark.js'), 'console.log("benchmark")');
    const result = await auditProductionBuild(root); expect(result.chunks).toHaveLength(2);
    expect(result.gzipBytes).toBe(result.chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0)); expect(result.limitBytes).toBe(250000);
  });
  it.each(['.png', '.svg', '.gltf', '.glb', '.mp3', '.wav', '.ogg', '.ts', '.map'])('rejects forbidden emitted files: %s', async extension => {
    await writeFile(path.join(root, `asset${extension}`), 'forbidden'); await expect(auditProductionBuild(root)).rejects.toThrow('media, raw TypeScript or source maps');
  });
  it('rejects an oversized bundle even when the entry chunk is small', async () => {
    await writeFile(path.join(root, 'assets/large.js'), randomBytes(260000)); await expect(auditProductionBuild(root)).rejects.toThrow('exceeds');
  });
  it('rejects raw or external HTML script entry points', async () => {
    for (const entry of ['/src/main.ts', 'https://example.invalid/app.js']) { await writeFile(path.join(root, 'index.html'), `<script src="${entry}"></script>`); await expect(auditProductionBuild(root)).rejects.toThrow('bundled JavaScript'); }
  });
  it('audits the diagnostic HTML entry as well as the game', async () => {
    await writeFile(path.join(root, 'benchmark.html'), '<script src="/src/benchmark.ts"></script>');
    await expect(auditProductionBuild(root)).rejects.toThrow('bundled JavaScript');
  });
  it('rejects missing chunks and asset paths that escape the build', async () => {
    await writeFile(path.join(root, 'index.html'), '<script src="/assets/missing.js"></script>');
    await expect(auditProductionBuild(root)).rejects.toThrow('Missing production entry');
    await writeFile(path.join(root, 'index.html'), '<script src="/assets/../../outside.js"></script>');
    await expect(auditProductionBuild(root)).rejects.toThrow('bundled JavaScript');
  });
});
