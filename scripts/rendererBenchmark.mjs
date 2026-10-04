import { measureRenderer } from './measureRenderer.mjs';
export { measureRenderer } from './measureRenderer.mjs';

// Software-rendered diagnostics against a running production server.
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('rendererBenchmark.mjs')) {
  const flags = process.argv.slice(2);
  const unsupported = flags.filter(flag => flag !== '--headed' && flag !== '--software' && !flag.startsWith('--url='));
  if (unsupported.length) throw new Error(`Unsupported benchmark options: ${unsupported.join(', ')}. This CLI uses software rendering only.`);
  const { chromium } = await import('@playwright/test');
  const url = flags.find(flag => flag.startsWith('--url='))?.slice(6) ?? 'http://127.0.0.1:8080';
  const browser = await chromium.launch({ headless: !flags.includes('--headed'),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', error => console.error(error.message));
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    await page.goto(url);
    await page.waitForFunction(() => document.getElementById('canvas-container')?.dataset.rendererState);
    const state = await page.locator('#canvas-container').getAttribute('data-renderer-state');
    if (state !== 'ready') throw new Error(`Renderer unavailable: ${state}`);
    console.log(JSON.stringify({ splash: await page.evaluate(measureRenderer) }, null, 2));
    await page.locator('#btn-solo').click(); await page.locator('#phase-label').filter({ hasText: 'SHAPING' }).waitFor();
    console.log(JSON.stringify({ arena: await page.evaluate(measureRenderer) }, null, 2));
  } finally { await browser.close(); }
}
