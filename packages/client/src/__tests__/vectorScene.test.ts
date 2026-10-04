import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { VectorScene } from '../render/VectorScene.js';

const state = vi.hoisted(() => ({ renderers: [] as unknown[], options: [] as unknown[] }));
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: class {
    domElement = document.createElement('canvas');
    info = { memory: { geometries: 12, textures: 1 } };
    ratio = 1; width = 1; height = 1;
    render = vi.fn(); setRenderTarget = vi.fn(); dispose = vi.fn(); forceContextLoss = vi.fn(); setClearColor = vi.fn();
    constructor(options: unknown) { state.renderers.push(this); state.options.push(options); }
    setPixelRatio(ratio: number): void { this.ratio = ratio; }
    setSize(width: number, height: number): void { this.width = width; this.height = height; }
    getDrawingBufferSize(target: THREE.Vector2): THREE.Vector2 { return target.set(this.width * this.ratio, this.height * this.ratio); }
  } };
});
class Target {
  dataset: Record<string, string> = {};
  children: Target[] = [];
  clientWidth = 800; clientHeight = 600;
  hidden = false;
  matches = false;
  removed = false;
  private classes = new Set<string>();
  classList = {
    toggle: (name: string, enabled: boolean) => { if (enabled) this.classes.add(name); else this.classes.delete(name); },
    contains: (name: string) => this.classes.has(name),
  };
  listeners = new Map<string, Set<EventListener>>();
  addEventListener(name: string, listener: EventListener): void { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(listener); }
  removeEventListener(name: string, listener: EventListener): void { this.listeners.get(name)?.delete(listener); }
  dispatchEvent(event: Event): boolean { for (const listener of this.listeners.get(event.type) ?? []) listener(event); return !event.defaultPrevented; }
  setAttribute(): void {}
  appendChild(element: Target): void { this.children.push(element); }
  remove(): void { this.removed = true; }
  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number } { return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight }; }
  get listenerCount(): number { return Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0); }
}
interface Renderer {
  domElement: Target; ratio: number; width: number; height: number;
  render: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>;
  setRenderTarget: ReturnType<typeof vi.fn>;
}
let scene: VectorScene;
let root: Target; let win: Target; let doc: Target; let body: Target; let media: Target;
let frames: Map<number, FrameRequestCallback>;
let disconnect: ReturnType<typeof vi.fn>;
beforeEach(() => {
  state.renderers = []; state.options = [];
  root = new Target(); win = new Target(); doc = new Target(); body = new Target(); media = new Target(); frames = new Map();
  let frameId = 0;
  vi.stubGlobal('window', Object.assign(win, { devicePixelRatio: 3, innerWidth: 800, innerHeight: 600, matchMedia: () => media }));
  vi.stubGlobal('document', Object.assign(doc, { body, getElementById: (id: string) => id === 'canvas-container' ? root : null, createElement: () => new Target() }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = disconnect; });
  scene = new VectorScene('canvas-container');
});
afterEach(() => { scene.destroy(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const renderer = (): Renderer => state.renderers[0] as Renderer;

describe('Spec-07 scene, compositor and resource lifecycle', () => {
  it('initializes once, requests the exact renderer options and caps DPR at two', () => {
    scene.init(root as unknown as HTMLElement);
    expect(state.renderers).toHaveLength(1); expect(root.children).toHaveLength(1);
    expect(state.options[0]).toEqual({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    expect(renderer().ratio).toBe(2); expect(renderer().width).toBe(800); expect(renderer().height).toBe(600);
    expect(frames.size).toBe(1); expect(root.dataset.rendererState).toBe('ready');
  });
  it('uses the 60-degree camera at z=30 and a real render-target compositor with FFT uniforms', () => {
    scene.setAudioEnergy(0.8, 0.6, 0.4); scene.update(1);
    const [worldScene, camera] = renderer().render.mock.calls[0] as [THREE.Scene, THREE.PerspectiveCamera];
    expect(camera.fov).toBe(60); expect(camera.near).toBe(0.1); expect(camera.far).toBe(1000); expect(camera.position.z).toBe(30);
    const target = renderer().setRenderTarget.mock.calls[0][0] as THREE.WebGLRenderTarget;
    expect(target.depthBuffer).toBe(true); // Dark card faces occlude the grid behind their strokes.
    expect(target.width).toBe(1600); expect(target.height).toBe(1200);
    expect(renderer().setRenderTarget.mock.calls[1]).toEqual([null]);
    const postScene = renderer().render.mock.calls[1][0] as THREE.Scene;
    const material = (postScene.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>).material;
    expect(material.uniforms.tDiffuse.value).toBe(target.texture); expect(material.uniforms.uMidEnergy.value).toBe(0.6);
    expect(material.fragmentShader).toContain('mandala'); expect(material.fragmentShader).toContain('bright(');
    expect(worldScene.children.filter(object => object instanceof THREE.LineSegments)).toHaveLength(1);
  });
  it('keeps CRT and reduced-motion settings independent and synchronized with canvas/DOM', () => {
    scene.toggleReducedMotion(); expect(body.classList.contains('reduced-motion')).toBe(true);
    expect(renderer().domElement.dataset.reducedMotion).toBe('true');
    scene.toggleCrt(); expect(renderer().domElement.dataset.crt).toBe('false');
    expect(renderer().domElement.dataset.reducedMotion).toBe('true');
    media.dispatchEvent(Object.assign(new Event('change'), { matches: false }));
    expect(renderer().domElement.dataset.reducedMotion).toBe('false'); expect(renderer().domElement.dataset.crt).toBe('false');
  });
  it('emits 250 opposing sparks, shockwaves and proportional aberration, with 75% reduced emissions', () => {
    scene.triggerClashExplosion('OVERCHARGE', 'PARRY', 2); expect(scene.getDiagnostics().particles).toBe(250);
    scene.update(1);
    const postScene = renderer().render.mock.calls[1][0] as THREE.Scene;
    const uniforms = (postScene.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>).material.uniforms;
    expect(uniforms.uDamageIntensity.value).toBe(0.5);
    scene.toggleReducedMotion(); scene.triggerClashExplosion('BRACE', 'BRACE', 2);
    expect(scene.getDiagnostics().particles).toBe(62); // floor each 125-source half independently
    scene.update(2); expect(uniforms.uDamageIntensity.value).toBe(0);
  });
  it('resizes renderer/target/camera together and maps cursor coordinates onto the world plane', () => {
    scene.onResize(1200, 600); scene.update(1);
    const camera = renderer().render.mock.calls[0][1] as THREE.PerspectiveCamera;
    expect(camera.aspect).toBe(2); expect(renderer().width).toBe(1200);
    const center = scene.screenToWorld(600, 300).clone(); expect(center.x).toBeCloseTo(0); expect(center.y).toBeCloseTo(0); expect(center.z).toBeCloseTo(0);
    const right = scene.screenToWorld(1200, 300); expect(right.x).toBeGreaterThan(30);
  });
  it('celebrates a match victory with pooled suit-colored confetti respecting reduced motion', () => {
    scene.triggerVictoryConfetti(); expect(scene.getDiagnostics().particles).toBe(300);
    scene.toggleReducedMotion(); scene.triggerVictoryConfetti(); expect(scene.getDiagnostics().particles).toBe(72);
    expect(state.renderers).toHaveLength(1);
  });
  it('stops RAF on context loss/visibility, resumes only once and preserves UI settings', () => {
    const event = new Event('webglcontextlost', { cancelable: true }); renderer().domElement.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(frames.size).toBe(0); expect(scene.getDiagnostics().lost).toBe(true);
    scene.update(1); expect(renderer().render).not.toHaveBeenCalled();
    renderer().domElement.dispatchEvent(new Event('webglcontextrestored'));
    expect(frames.size).toBe(1); expect(scene.getDiagnostics().lost).toBe(false);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); expect(frames.size).toBe(0);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); doc.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(1);
  });
  it('keeps all geometries/materials stable through repeated updates and card changes', () => {
    scene.setTitleMode(false); scene.setCards([{ id: 'a', rank: 14, suit: 'HEARTS' }]); scene.update(1);
    const world = renderer().render.mock.calls[0][0] as THREE.Scene;
    const geometryIds = (): string[] => {
      const ids: string[] = []; world.traverse(object => { if ('geometry' in object) ids.push((object.geometry as THREE.BufferGeometry).uuid); }); return ids;
    };
    const original = geometryIds();
    for (let i = 0; i < 100; i++) { scene.setCards([{ id: 'a', rank: 5, suit: 'SPADES' }]); scene.update(1 + i / 60); }
    expect(geometryIds()).toEqual(original); expect(state.renderers).toHaveLength(1);
    scene.setTitleMode(true); expect(renderer().domElement.dataset.title).toBe('true');
  });
  it('late updates after destruction are harmless without allocating a new renderer', () => {
    scene.destroy();
    expect(() => {
      scene.setCards([{ id: 'late', rank: 14, suit: 'HEARTS' }]);
      scene.triggerSparks(0, 0); scene.triggerShockwave(0, 0); scene.triggerClashExplosion('BRACE', 'PARRY', 1);
      scene.update(10);
    }).not.toThrow();
    expect(state.renderers).toHaveLength(1);
  });
  it('destroy cancels every RAF/listener/observer and disposes GPU resources exactly once', () => {
    scene.update(1); const world = renderer().render.mock.calls[0][0] as THREE.Scene;
    const disposals: ReturnType<typeof vi.spyOn>[] = [];
    world.traverse(object => {
      if (object instanceof THREE.LineSegments || object instanceof THREE.Points || object instanceof THREE.Mesh) {
        disposals.push(vi.spyOn(object.geometry, 'dispose')); disposals.push(vi.spyOn(object.material as THREE.Material, 'dispose'));
      }
    });
    const canvas = renderer().domElement; scene.destroy(); scene.destroy();
    expect(frames.size).toBe(0); expect(win.listenerCount).toBe(0); expect(doc.listenerCount).toBe(0); expect(media.listenerCount).toBe(0); expect(canvas.listenerCount).toBe(0);
    expect(disconnect).toHaveBeenCalledOnce(); expect(renderer().dispose).toHaveBeenCalledOnce(); expect(canvas.removed).toBe(true);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
  });
});
