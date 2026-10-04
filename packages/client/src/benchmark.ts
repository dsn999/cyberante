import { measureRenderer, type RendererMeasurement } from '../../../scripts/measureRenderer.mjs';

const element = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const frame = element<HTMLIFrameElement>('game');
const run = element<HTMLButtonElement>('run');
const status = element<HTMLParagraphElement>('status');
const controls = element<HTMLElement>('controls');
const progress = element<HTMLElement>('progress');
const report = element<HTMLTextAreaElement>('report');
let ready = false;
function loaded(): void {
  ready = Boolean(frame.contentDocument?.getElementById('btn-tutorial'));
  run.disabled = !ready;
  status.textContent = ready ? 'Ready. Measurements take about 12 seconds on a 60 Hz display.' : 'Game unavailable. Build and start the production server first.';
}
frame.addEventListener('load', loaded);
if (frame.contentDocument?.readyState === 'complete') loaded();
run.addEventListener('click', () => { void benchmark(); });
async function benchmark(): Promise<void> {
  if (!ready || run.disabled) return;
  const device = element<HTMLInputElement>('device');
  if (!device.reportValidity()) return;
  run.disabled = true; controls.hidden = true; progress.hidden = false;
  try {
    const gameWindow = frame.contentWindow!;
    const click = (selector: string): void => {
      const button = frame.contentDocument?.querySelector<HTMLButtonElement>(selector);
      if (!button || button.disabled) throw new Error(`Training control unavailable: ${selector}`);
      button.click();
    };
    // This direct activation initializes audio while the Start gesture is still active.
    click('#btn-tutorial'); click('#tut-skip-btn');
    const canvas = frame.contentDocument!.querySelector<HTMLCanvasElement>('canvas');
    if (canvas?.dataset.reducedMotion === 'true') click('#btn-menu-motion');
    if (canvas?.dataset.crt === 'false') click('#btn-menu-crt');
    progress.textContent = 'Measuring splash…';
    const splash = await measureRenderer({ gameWindow });
    click('#btn-tutorial'); click('#btn-auto-split');
    click('[data-card-id="flux-4"] .nudge-down-btn'); click('#tut-next-btn');
    click('[data-card-id="burn-k"] .burn-btn'); click('#tut-next-btn'); click('#stance-overcharge');
    progress.textContent = 'Measuring arena…';
    const arena = await measureRenderer({ gameWindow });
    progress.textContent = 'Measuring clash…';
    click('#btn-lock-in');
    const clash = await measureRenderer({ gameWindow, sampleFrames: 90, warmupFrames: 0 });
    const stages: Record<string, RendererMeasurement> = { splash, arena, clash };
    report.value = JSON.stringify({ recordedAt: new Date().toISOString(), device: device.value.trim(), hardwareClass: element<HTMLSelectElement>('hardware').value,
      userAgent: navigator.userAgent, targetFps: 60, stages }, null, 2);
    element('summary').textContent = Object.entries(stages).map(([name, result]) => `${name}: ${result.fps} FPS (${result.p95Ms}ms p95)`).join(' · ');
    element('results').hidden = false;
    status.textContent = Object.values(stages).some(result => result.software) ? 'Software rendering detected. Save the diagnostic results; physical GPU acceptance is still open.' : 'Finished. Copy or download the results for acceptance review.';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Benchmark failed';
  } finally { progress.hidden = true; controls.hidden = false; run.disabled = false; }
}
element('copy').addEventListener('click', () => {
  if (!navigator.clipboard) { report.select(); status.textContent = 'Select and copy the JSON shown below.'; return; }
  void navigator.clipboard.writeText(report.value).then(() => { status.textContent = 'Results copied.'; }).catch(() => { report.select(); status.textContent = 'Select and copy the JSON shown below.'; });
});
element('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([report.value], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'cyberante-hardware-benchmark.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
