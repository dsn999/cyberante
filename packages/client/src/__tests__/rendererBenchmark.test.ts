import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { measureRenderer } from '../../../../scripts/measureRenderer.mjs';
let frames: Map<number, FrameRequestCallback>; let now: number; let env: Window;
let doc: { hidden: boolean; querySelector: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
let gl: { isContextLost: ReturnType<typeof vi.fn>; getExtension: ReturnType<typeof vi.fn>; getParameter: ReturnType<typeof vi.fn>; finish: ReturnType<typeof vi.fn>; RENDERER: number };
beforeEach(() => {
  vi.useFakeTimers(); now = 0; frames = new Map(); let id = 0;
  gl = { isContextLost: vi.fn(() => false), getExtension: vi.fn(() => null), getParameter: vi.fn(() => 'Intel physical GPU'), finish: vi.fn(), RENDERER: 1 };
  doc = { hidden: false, querySelector: vi.fn(() => ({ getContext: () => gl, width: 1280, height: 800, dataset: { crt: 'true', reducedMotion: 'false', title: 'true' } })), addEventListener: vi.fn(), removeEventListener: vi.fn() };
  env = { document: doc, innerWidth: 640, innerHeight: 400, devicePixelRatio: 2, performance: { now: () => now }, setTimeout, clearTimeout,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; }, cancelAnimationFrame: (id: number) => frames.delete(id) } as unknown as Window;
});
afterEach(() => { vi.useRealTimers(); });
const tick = (): void => { const [id, callback] = frames.entries().next().value!; frames.delete(id); now += 16; callback(now); };
describe('Spec-10B physical renderer measurement', () => {
  it('samples exact completed frames after warmup and records hardware/pixel/settings metadata', async () => {
    const pending = measureRenderer({ sampleFrames: 2, warmupFrames: 1, gameWindow: env }); for (let index = 0; index < 4; index++) tick();
    const result = await pending; expect(result.frames).toBe(2); expect(result.fps).toBe(62.5); expect(result.meanMs).toBe(16); expect(result.p95Ms).toBe(16);
    expect(result.viewport).toBe('640×400'); expect(result.pixels).toBe('1280×800'); expect(result.dpr).toBe(2); expect(result.software).toBe(false); expect(result.crt).toBe('true');
    expect(gl.finish).toHaveBeenCalledTimes(4); expect(frames.size).toBe(0); expect(doc.removeEventListener).toHaveBeenCalledOnce();
  });
  it('identifies software rendering rather than claiming physical GPU acceptance', async () => {
    gl.getParameter.mockReturnValue('ANGLE SwiftShader'); const pending = measureRenderer({ sampleFrames: 2, warmupFrames: 0, gameWindow: env }); tick(); tick(); tick(); expect((await pending).software).toBe(true);
  });
  it('rejects invalid frame counts before scheduling', async () => {
    await expect(measureRenderer({ sampleFrames: 0, gameWindow: env })).rejects.toThrow('Invalid'); expect(frames.size).toBe(0);
  });
  it('cancels frames and the watchdog if the tab becomes hidden', async () => {
    const pending = measureRenderer({ sampleFrames: 2, gameWindow: env }); const rejected = expect(pending).rejects.toThrow('tab hidden');
    doc.hidden = true; const callback = doc.addEventListener.mock.calls[0][1] as () => void; callback(); await rejected;
    expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0); expect(doc.removeEventListener).toHaveBeenCalledOnce();
  });
  it('cancels measurement on real context loss', async () => {
    const pending = measureRenderer({ sampleFrames: 2, gameWindow: env }); const rejected = expect(pending).rejects.toThrow('interrupted'); gl.isContextLost.mockReturnValue(true); tick(); await rejected; expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects a suspended frame loop with a bounded watchdog', async () => {
    const pending = measureRenderer({ gameWindow: env }); const rejected = expect(pending).rejects.toThrow('120 seconds'); vi.advanceTimersByTime(120000); await rejected; expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
  it('cleans up if the graphics completion call throws', async () => {
    gl.finish.mockImplementation(() => { throw new Error('Graphics completion failed'); });
    const pending = measureRenderer({ gameWindow: env }); const rejected = expect(pending).rejects.toThrow('Graphics completion failed');
    tick(); await rejected; expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0); expect(doc.removeEventListener).toHaveBeenCalledOnce();
  });
});
