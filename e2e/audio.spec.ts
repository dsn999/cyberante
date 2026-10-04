import { expect, test } from '@playwright/test';

type AudioProbe = {
  contexts: AudioContext[];
  nodes: AudioNode[];
  connected: Set<AudioNode>;
  sources: OscillatorNode[];
  analysers: AnalyserNode[];
  pitches: number[];
};
type ProbedWindow = Window & { audioProbe: AudioProbe };

// Observe real native nodes in the test harness; production exports no test hook.
async function observeAudio(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const probe: AudioProbe = { contexts: [], nodes: [], connected: new Set(), sources: [], analysers: [], pitches: [] };
    (window as unknown as ProbedWindow).audioProbe = probe;
    const NativeContext = window.AudioContext;
    function observe<T extends AudioNode>(node: T): T {
      probe.nodes.push(node);
      const connect = node.connect.bind(node);
      const disconnect = node.disconnect.bind(node);
      node.connect = ((target: AudioNode | AudioParam, output = 0, input = 0) => {
        probe.connected.add(node);
        if (target instanceof AudioNode) return connect(target, output, input);
        connect(target, output);
      }) as AudioNode['connect'];
      node.disconnect = () => { probe.connected.delete(node); disconnect(); };
      return node;
    }
    window.AudioContext = class extends NativeContext {
      constructor(options?: AudioContextOptions) { super(options); probe.contexts.push(this); }
      createGain(): GainNode { return observe(super.createGain()); }
      createAnalyser(): AnalyserNode { const node = observe(super.createAnalyser()); probe.analysers.push(node); return node; }
      createBiquadFilter(): BiquadFilterNode { return observe(super.createBiquadFilter()); }
      createOscillator(): OscillatorNode {
        const node = observe(super.createOscillator()); probe.sources.push(node);
        const set = node.frequency.setValueAtTime.bind(node.frequency);
        node.frequency.setValueAtTime = (value, time) => { probe.pitches.push(value); return set(value, time); };
        return node;
      }
      createBufferSource(): AudioBufferSourceNode { return observe(super.createBufferSource()); }
      createWaveShaper(): WaveShaperNode { return observe(super.createWaveShaper()); }
    };
  });
}

test('native Web Audio unlocks once, produces FFT energy, mutes and releases transient nodes across repeated play', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const mediaRequests: string[] = [];
  page.on('request', request => { if (/\.(mp3|wav|ogg|aac|flac)(\?|$)/i.test(request.url())) mediaRequests.push(request.url()); });
  await observeAudio(page);
  await page.goto('/');
  expect(await page.evaluate(() => (window as unknown as ProbedWindow).audioProbe.contexts.length)).toBe(0);
  for (let iteration = 0; iteration < 3; iteration++) {
    await page.locator('#btn-solo').click();
    await expect(page.locator('#phase-label')).toHaveText('SHAPING');
    await page.waitForFunction(() => {
      const probe = (window as unknown as ProbedWindow).audioProbe;
      if (probe.contexts[0]?.state !== 'running' || !probe.analysers[0]) return false;
      const bins = new Uint8Array(128); probe.analysers[0].getByteFrequencyData(bins);
      return bins.slice(1, 101).some(value => value > 0);
    });
    const graph = await page.evaluate(() => {
      const probe = (window as unknown as ProbedWindow).audioProbe;
      return { contexts: probe.contexts.length, fft: probe.analysers[0].fftSize, master: (probe.nodes[0] as GainNode).gain.value };
    });
    expect(graph.contexts).toBe(1); expect(graph.fft).toBe(256); expect(graph.master).toBeCloseTo(0.3);
    await page.locator('.card-face').first().click();
    await page.locator('.nudge-up-btn').first().click();
    await page.locator('.bleed-btn').first().click();
    await page.locator('.burn-btn').first().click();
    await page.locator('#btn-toggle-mute').click();
    await expect.poll(() => page.evaluate(() => ((window as unknown as ProbedWindow).audioProbe.nodes[0] as GainNode).gain.value)).toBe(0);
    // Master + analyser + two channel buses + music filter are the persistent graph.
    expect(await page.evaluate(() => (window as unknown as ProbedWindow).audioProbe.connected.size)).toBe(5);
    await page.locator('#btn-toggle-mute').click();
    await page.locator('#btn-exit').click();
    expect(await page.evaluate(() => (window as unknown as ProbedWindow).audioProbe.connected.size)).toBe(5);
  }
  expect(mediaRequests).toEqual([]); expect(errors).toEqual([]);
});

test('unsupported Web Audio preserves solo controls and mute settings without errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  await page.goto('/'); await page.locator('#btn-mute').click();
  await page.locator('#btn-solo').click(); await expect(page.locator('#phase-label')).toHaveText('SHAPING');
  await expect(page.locator('#btn-toggle-mute')).toHaveText('AUDIO: MUTED');
  await page.locator('#btn-toggle-mute').click(); await page.locator('.nudge-up-btn').first().click();
  await expect(page.locator('#player-flux')).toHaveText('2/3');
  await page.locator('#btn-exit').click(); await expect(page.locator('#main-menu-overlay')).toBeVisible();
  expect(errors).toEqual([]);
});


test('authoritative solo phases trigger stance, laser, impact and one match fanfare', async ({ page }) => {
  await observeAudio(page); await page.clock.install(); await page.goto('/');
  await page.locator('#btn-solo').click();
  await page.waitForFunction(() => (window as unknown as ProbedWindow).audioProbe.contexts[0]?.state === 'running');
  let clashes = 0;
  for (let i = 0; i < 120; i++) {
    const phase = await page.locator('#phase-label').textContent();
    if (phase === 'MATCH OVER') break;
    if (phase === 'DEAL') await page.clock.fastForward(2000);
    else if (phase === 'SHAPING') { await page.locator('#btn-ready').click(); await page.clock.fastForward(1500); }
    else if (phase === 'COMMITMENT') {
      await page.locator('#stance-parry').click(); await page.locator('#stance-brace').click();
      await page.locator('#stance-overcharge').click(); await page.locator('#btn-lock-in').click();
      await page.clock.fastForward(1500);
    } else if (phase === 'CLASH REVEAL') { clashes++; await page.clock.fastForward(4000); }
    else if (phase === 'ROUND RESOLVE') await page.clock.fastForward(3000);
    else throw new Error(`Unexpected phase: ${phase}`);
  }
  await expect(page.locator('#phase-label')).toHaveText('MATCH OVER');
  const pitches = await page.evaluate(() => (window as unknown as ProbedWindow).audioProbe.pitches);
  for (const frequency of [120, 220, 1400, 320, 880, 110, 65]) expect(pitches).toContain(frequency);
  // 110Hz occurs only as the FM modulator; one for each actual exchange reveal.
  expect(pitches.filter(hz => hz === 110)).toHaveLength(clashes);
  const victory = (await page.locator('#center-banner').textContent())?.includes('VICTORY');
  const fanfare = victory ? [293.66, 349.23, 440, 587.32] : [293.66, 261.63, 220, 146.83];
  expect(pitches.filter((_hz, index) => fanfare.every((hz, offset) => pitches[index + offset] === hz))).toHaveLength(1);
  await page.locator('#btn-rematch').click(); await expect(page.locator('#phase-label')).toHaveText('DEAL');
  await page.locator('#btn-exit').click();
  expect(await page.evaluate(() => (window as unknown as ProbedWindow).audioProbe.connected.size)).toBe(5);
});
