/** Serializable browser function; also usable in a browser's developer console. */
export async function measureRenderer({ sampleFrames = 180, warmupFrames = 45 } = {}) {
  const canvas = document.querySelector('#canvas-container canvas');
  if (!canvas || document.hidden) throw new Error('Open the game in a visible tab before benchmarking');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!gl || gl.isContextLost()) throw new Error('An active WebGL context is required');
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER);
  const samples = [];
  let frame = 0;
  let previous = 0;
  await new Promise((resolve, reject) => {
    const tick = () => {
      if (document.hidden || gl.isContextLost()) { reject(new Error('Benchmark interrupted')); return; }
      // Includes completion of the actual renderer work, rather than just CPU submission.
      gl.finish();
      const now = performance.now();
      if (frame > warmupFrames) samples.push(now - previous);
      previous = now;
      if (++frame <= warmupFrames + sampleFrames) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  const sorted = samples.toSorted((a, b) => a - b);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return { gpu, viewport: `${innerWidth}×${innerHeight}`, pixels: `${canvas.width}×${canvas.height}`,
    frames: samples.length, fps: Number((1000 / mean).toFixed(2)), meanMs: Number(mean.toFixed(2)),
    p95Ms: Number(sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(2)),
    crt: canvas.dataset.crt, reducedMotion: canvas.dataset.reducedMotion, title: canvas.dataset.title };
}

// A local CLI for repeatable hardware measurements against a running production server.
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('rendererBenchmark.mjs')) {
  const { chromium } = await import('@playwright/test');
  const flags = process.argv.slice(2);
  const url = flags.find(flag => flag.startsWith('--url='))?.slice(6) ?? 'http://127.0.0.1:8080';
  const browser = await chromium.launch({ headless: !flags.includes('--headed'),
    args: flags.includes('--software') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url);
    await page.waitForSelector('#canvas-container[data-renderer-state="ready"]');
    console.log(JSON.stringify({ splash: await page.evaluate(measureRenderer) }, null, 2));
    await page.locator('#btn-solo').click(); await page.locator('#phase-label').filter({ hasText: 'SHAPING' }).waitFor();
    console.log(JSON.stringify({ arena: await page.evaluate(measureRenderer) }, null, 2));
  } finally { await browser.close(); }
}
