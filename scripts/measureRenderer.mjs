/** Runs in the game window; records completion of actual GPU work. */
export async function measureRenderer({ sampleFrames = 180, warmupFrames = 45, gameWindow = window } = {}) {
  if (!Number.isInteger(sampleFrames) || sampleFrames < 2 || sampleFrames > 3600 || !Number.isInteger(warmupFrames) || warmupFrames < 0 || warmupFrames > 600) throw new Error('Invalid frame counts');
  const document = gameWindow.document;
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
    let watchdog;
    let active = true;
    let frameId = 0;
    const stop = error => { if (!active) return; active = false; gameWindow.cancelAnimationFrame(frameId); gameWindow.clearTimeout(watchdog); document.removeEventListener('visibilitychange', visibility); error ? reject(error) : resolve(); };
    const visibility = () => { if (document.hidden) stop(new Error('Benchmark interrupted: tab hidden')); };
    document.addEventListener('visibilitychange', visibility);
    watchdog = gameWindow.setTimeout(() => stop(new Error('Benchmark did not finish within 120 seconds')), 120000);
    const tick = () => {
      if (!active) return;
      if (document.hidden || gl.isContextLost()) { stop(new Error('Benchmark interrupted')); return; }
      try { gl.finish(); } catch (error) { stop(error); return; }
      const now = gameWindow.performance.now();
      if (frame > warmupFrames) samples.push(now - previous);
      previous = now;
      if (++frame <= warmupFrames + sampleFrames) frameId = gameWindow.requestAnimationFrame(tick);
      else stop();
    };
    frameId = gameWindow.requestAnimationFrame(tick);
  });
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return { gpu, software: /swiftshader|llvmpipe|softpipe|lavapipe|software/i.test(gpu),
    viewport: `${gameWindow.innerWidth}×${gameWindow.innerHeight}`, pixels: `${canvas.width}×${canvas.height}`, dpr: gameWindow.devicePixelRatio,
    frames: samples.length, fps: Number((1000 / mean).toFixed(2)), meanMs: Number(mean.toFixed(2)),
    p95Ms: Number(sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(2)), maxMs: Number(sorted.at(-1).toFixed(2)),
    crt: canvas.dataset.crt, reducedMotion: canvas.dataset.reducedMotion, title: canvas.dataset.title };
}
