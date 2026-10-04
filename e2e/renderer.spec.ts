import { expect, test, type Page } from '@playwright/test';

type Probe = { gl: WebGLRenderingContext | WebGL2RenderingContext | null; shaders: string[];
  buffers: number; textures: number; lostExtension: WEBGL_lose_context | null };
type ProbedWindow = Window & { renderProbe: Probe };
async function observe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe: Probe = { gl: null, shaders: [], buffers: 0, textures: 0, lostExtension: null };
    (window as unknown as ProbedWindow).renderProbe = probe;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(contextId: string, options?: object) {
      const ctx = getContext.call(this, contextId, options);
      if ((contextId === 'webgl' || contextId === 'webgl2') && ctx && !probe.gl) {
        const gl = ctx as WebGLRenderingContext;
        probe.gl = gl;
        const shaderSource = gl.shaderSource.bind(gl); gl.shaderSource = (shader, source) => { probe.shaders.push(source); shaderSource(shader, source); };
        const createBuffer = gl.createBuffer.bind(gl); gl.createBuffer = () => { probe.buffers++; return createBuffer(); };
        const createTexture = gl.createTexture.bind(gl); gl.createTexture = () => { probe.textures++; return createTexture(); };
      }
      return ctx;
    } as HTMLCanvasElement['getContext'];
  });
}
async function pixels(page: Page): Promise<number[]> {
  return page.evaluate(() => new Promise<number[]>(resolve => requestAnimationFrame(() => {
    const gl = (window as unknown as ProbedWindow).renderProbe.gl!;
    const data = new Uint8Array(24 * 24 * 4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth * 0.24), Math.floor(gl.drawingBufferHeight * 0.6), 24, 24, gl.RGBA, gl.UNSIGNED_BYTE, data);
    resolve(Array.from(data));
  })));
}

test('psychedelic splash compiles native shaders, animates, resizes and honors independent accessibility settings', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await observe(page); await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('/');
  await expect(page.locator('#canvas-container')).toHaveAttribute('data-renderer-state', 'ready');
  await expect(page.locator('canvas')).toHaveAttribute('data-title', 'true');
  await expect(page.getByRole('heading', { name: 'CYBERANTE', exact: true })).toBeVisible();
  await page.waitForFunction(() => (window as unknown as ProbedWindow).renderProbe.shaders.some(source => source.includes('mandala')));
  const first = await pixels(page);
  expect(first.some((value, i) => i % 4 !== 3 && value > 30)).toBe(true);
  await page.screenshot({ path: '/tmp/cyberante-spec07-splash-desktop.png' });
  await page.waitForTimeout(300); expect(await pixels(page)).not.toEqual(first);
  await page.locator('#btn-menu-motion').click();
  await expect(page.locator('canvas')).toHaveAttribute('data-reduced-motion', 'true');
  const frozen = await pixels(page); await page.waitForTimeout(150); expect(await pixels(page)).toEqual(frozen);
  await page.locator('#btn-menu-crt').click();
  await expect(page.locator('canvas')).toHaveAttribute('data-crt', 'false');
  await expect(page.locator('canvas')).toHaveAttribute('data-reduced-motion', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBe(390);
  expect(await page.locator('#main-menu-overlay').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/cyberante-spec07-splash-mobile.png', fullPage: true });
  await page.locator('#btn-solo').click(); await expect(page.locator('canvas')).toHaveAttribute('data-title', 'false');
  await expect(page.locator('#btn-toggle-motion')).toHaveText('MOTION: REDUCED');
  await expect(page.locator('#btn-toggle-crt')).toHaveText('CRT: OFF');
  await page.locator('#btn-toggle-motion').click(); await expect(page.locator('canvas')).toHaveAttribute('data-reduced-motion', 'false');
  await page.locator('#btn-exit').click(); await expect(page.locator('#btn-menu-motion')).toHaveText('MOTION: FULL');
  expect(errors).toEqual([]);
});

test('native GPU loss/restoration recovers the compositor and reuses buffers through repeated matches', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await observe(page); await page.goto('/');
  await page.locator('#btn-menu-motion').click();
  await page.locator('#btn-solo').click(); await expect(page.locator('#phase-label')).toHaveText('SHAPING');
  await page.locator('.nudge-up-btn').first().click(); await page.locator('.burn-btn').first().click();
  await page.locator('#game-board-overlay').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: '/tmp/cyberante-spec07-arena.png' });
  await page.locator('#btn-exit').click();
  const allocated = await page.evaluate(() => {
    const probe = (window as unknown as ProbedWindow).renderProbe; return { buffers: probe.buffers, textures: probe.textures };
  });
  for (let i = 0; i < 3; i++) {
    await page.locator('#btn-solo').click(); await expect(page.locator('#phase-label')).toHaveText('SHAPING');
    await page.locator('.nudge-up-btn').first().click(); await page.locator('#btn-exit').click();
  }
  expect(await page.evaluate(() => {
    const probe = (window as unknown as ProbedWindow).renderProbe; return { buffers: probe.buffers, textures: probe.textures };
  })).toEqual(allocated);
  await page.evaluate(() => {
    const probe = (window as unknown as ProbedWindow).renderProbe;
    probe.lostExtension = probe.gl!.getExtension('WEBGL_lose_context');
    if (!probe.lostExtension) throw new Error('Context-loss extension unavailable');
    probe.lostExtension.loseContext();
  });
  await expect(page.locator('#canvas-container')).toHaveAttribute('data-renderer-state', 'lost');
  await page.evaluate(() => (window as unknown as ProbedWindow).renderProbe.lostExtension!.restoreContext());
  await expect(page.locator('#canvas-container')).toHaveAttribute('data-renderer-state', 'ready');
  await expect.poll(async () => (await pixels(page)).some((v, i) => i % 4 !== 3 && v > 30)).toBe(true);
  expect(await page.locator('canvas').count()).toBe(1); expect(errors).toEqual([]);
});

test('renderer frame timing reports actual GPU completion without per-frame buffer growth', async ({ page }) => {
  const { measureRenderer } = await import('../scripts/rendererBenchmark.mjs');
  await observe(page); await page.setViewportSize({ width: 960, height: 600 }); await page.goto('/');
  await expect(page.locator('#canvas-container')).toHaveAttribute('data-renderer-state', 'ready');
  await page.waitForFunction(() => (window as unknown as ProbedWindow).renderProbe.shaders.some(source => source.includes('mandala')));
  const before = await page.evaluate(() => (window as unknown as ProbedWindow).renderProbe.buffers);
  const result = await page.evaluate(measureRenderer, { sampleFrames: 120, warmupFrames: 45 });
  expect(await page.evaluate(() => (window as unknown as ProbedWindow).renderProbe.buffers)).toBe(before);
  console.log('Spec-07 renderer benchmark:', JSON.stringify(result));
  expect(result.frames).toBe(120); expect(result.meanMs).toBeGreaterThan(0);
  expect(result.gpu).toBeTruthy();
});
