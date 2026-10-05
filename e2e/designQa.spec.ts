import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('solo opponent signals shaping and lock-in without exposing private cards, and resets on exit', async ({ page }) => {
  await page.addInitScript(() => {
    const random = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = function<T extends ArrayBufferView | null>(array: T): T {
      if (array instanceof Uint32Array && array.length === 1) { array[0] = 2; return array; }
      return random(array);
    };
  });
  await page.clock.install(); await page.goto('/'); await page.locator('#btn-solo').click();
  await page.clock.fastForward(2000); await expect(page.locator('#phase-label')).toHaveText('SHAPING');
  await expect(page.locator('#opponent-activity')).toHaveText('FLUX 3/3');
  await page.clock.fastForward(999); await expect(page.locator('#opponent-activity')).toHaveText('FLUX 3/3');
  await page.clock.fastForward(501); await expect(page.locator('#opponent-activity')).toHaveText('FLUX 2/3');
  await expect(page.locator('#clash-reveal')).toBeEmpty();
  await page.locator('#btn-ready').click(); await page.clock.fastForward(1500);
  await expect(page.locator('#phase-label')).toHaveText('COMMITMENT');
  await expect(page.locator('#opponent-activity')).toHaveText('FLUX 2/3 • LOCKED IN');
  await expect(page.locator('#clash-reveal')).toBeEmpty();
  await page.locator('#btn-exit').click(); await expect(page.locator('#opponent-activity')).toBeHidden();
  await page.locator('#btn-solo').click(); await expect(page.locator('#opponent-activity')).toHaveText('FLUX 3/3');
});

test('captures the submission cover from the real procedural clash canvas using software rendering', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/');
  await page.locator('#btn-tutorial').click(); await page.locator('#btn-auto-split').click();
  await page.locator('[data-card-id="flux-4"] .nudge-down-btn').click(); await page.locator('#tut-next-btn').click();
  await page.locator('[data-card-id="burn-k"] .burn-btn').click(); await page.locator('#tut-next-btn').click();
  await page.locator('#stance-overcharge').click();
  // Cover-only framing: enlarge the scene's layout area while preserving the actual game geometry and effects.
  await page.addStyleTag({ content: '#ui-overlay { visibility: hidden; } #arena-preview { position: fixed; inset: 24px; min-height: 0; height: auto; width: auto; }' });
  await page.evaluate(() => {
    window.dispatchEvent(new Event('resize'));
    document.querySelector<HTMLButtonElement>('#btn-lock-in')!.click();
  });
  const image = await page.locator('#canvas-container canvas').evaluate(canvas => new Promise<string>(resolve => {
    requestAnimationFrame(() => resolve((canvas as HTMLCanvasElement).toDataURL('image/png')));
  }));
  const bytes = Buffer.from(image.split(',')[1], 'base64');
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); expect(bytes.length).toBeGreaterThan(10000);
  await mkdir(testInfo.outputDir, { recursive: true });
  const coverPath = testInfo.outputPath('cover.png'); await writeFile(coverPath, bytes);
  await testInfo.attach('procedural clash cover', { path: coverPath, contentType: 'image/png' });
  await expect(page.locator('#tutorial-overlay')).toHaveAttribute('data-complete', 'true');
});
