import { expect, test } from '@playwright/test';

test('production hardware acceptance page captures the actual game, classifies software, exports JSON and cleans up', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/benchmark.html'); await expect(page.locator('#run')).toBeEnabled();
  await page.locator('#device').fill('CI SwiftShader diagnostic'); await page.locator('#hardware').selectOption('dedicated');
  await page.locator('#run').click(); await expect(page.locator('#controls')).toBeHidden();
  await expect(page.locator('#results')).toBeVisible({ timeout: 60000 });
  const report = JSON.parse(await page.locator('#report').inputValue()) as { hardwareClass: string; targetFps: number; stages: Record<string, { software: boolean; frames: number; crt: string; reducedMotion: string; title: string; fps: number }> };
  expect(report.hardwareClass).toBe('dedicated'); expect(report.targetFps).toBe(60); expect(Object.keys(report.stages)).toEqual(['splash', 'arena', 'clash']);
  for (const stage of Object.values(report.stages)) { expect(stage.software).toBe(true); expect(stage.fps).toBeGreaterThan(0); expect(stage.crt).toBe('true'); expect(stage.reducedMotion).toBe('false'); }
  expect(report.stages.splash.frames).toBe(180); expect(report.stages.arena.frames).toBe(180); expect(report.stages.clash.frames).toBe(90);
  expect(report.stages.splash.title).toBe('true'); expect(report.stages.arena.title).toBe('false');
  await expect(page.locator('#status')).toContainText('physical GPU acceptance is still open'); await expect(page.locator('#run')).toBeEnabled();
  const download = page.waitForEvent('download'); await page.locator('#download').click(); expect((await download).suggestedFilename()).toBe('cyberante-hardware-benchmark.json');
  const game = page.frameLocator('#game'); await expect(game.locator('#tutorial-overlay')).toHaveAttribute('data-complete', 'true');
  await page.screenshot({ path: '/tmp/cyberante-spec10b-benchmark.png' }); expect(errors).toEqual([]);
});

test('benchmark aborts and restores controls when its tab is hidden', async ({ page, context }) => {
  await page.goto('/benchmark.html'); await expect(page.locator('#run')).toBeEnabled(); await page.locator('#device').fill('CI visibility interruption'); await page.locator('#run').click();
  const foreground = await context.newPage(); await foreground.goto('about:blank'); await foreground.bringToFront();
  // Headless visibility is explicit so this check is independent of window-manager policy.
  await page.frameLocator('#game').locator('body').evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#controls')).toBeVisible(); await expect(page.locator('#status')).toContainText('tab hidden'); await expect(page.locator('#run')).toBeEnabled(); await foreground.close();
});
