import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const entry = fileURLToPath(new URL('../../../../scripts/rendererBenchmark.mjs', import.meta.url));

describe('Spec-10B benchmark CLI restrictions', () => {
  it.each(['--wsl-gpu=Intel', '--use-angle=gl-egl', '--native'])('rejects %s before browser launch', async flag => {
    await expect(execute(process.execPath, [entry, flag], { timeout: 2000 })).rejects.toMatchObject({
      code: 1,
      stdout: '',
      stderr: expect.stringContaining('This CLI uses software rendering only.'),
    });
  });
});
