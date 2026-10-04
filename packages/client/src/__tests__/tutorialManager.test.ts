import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TutorialManager } from '../tutorial/TutorialManager';
const sound = vi.hoisted(() => ({ playVictory: vi.fn() }));
vi.mock('../audio/AudioEngine', () => ({ masterAudio: { sfx: sound } }));

class Node {
  hidden = false; disabled = false; textContent = ''; innerHTML = ''; id = '';
  dataset: Record<string, string> = {};
  children: Node[] = [];
  nodes = new Map<string, Node>();
  listeners = new Map<string, Set<(event: unknown) => void>>();
  classes = new Set<string>();
  properties = new Map<string, string>();
  classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name) };
  style = { setProperty: (name: string, value: string) => this.properties.set(name, value), removeProperty: (name: string) => this.properties.delete(name) };
  focus = vi.fn();
  scrollIntoView = vi.fn();
  appendChild(node: Node): void { this.children.push(node); }
  setAttribute(): void {}
  getBoundingClientRect(): { height: number } { return { height: 300 }; }
  querySelector(selector: string): Node { if (!this.nodes.has(selector)) this.nodes.set(selector, new Node()); return this.nodes.get(selector)!; }
  addEventListener(type: string, callback: (event: unknown) => void): void { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type)!.add(callback); }
  removeEventListener(type: string, callback: (event: unknown) => void): void { this.listeners.get(type)?.delete(callback); }
  emit(type: string, event: unknown = {}): void { this.listeners.get(type)?.forEach(listener => listener(event)); }
}
let parent: Node; let body: Node; let doc: Node; let target: Node;
let modalOpen: boolean; let tutorial: TutorialManager;
let complete: ReturnType<typeof vi.fn>; let publish: ReturnType<typeof vi.fn>; let clash: ReturnType<typeof vi.fn>;
let disconnect: ReturnType<typeof vi.fn>;
const overlay = (): Node => parent.children[0];
const button = (id: string): Node => overlay().querySelector(`#${id}`);
const validSplit = (): { assaultIds: string[]; aegisIds: string[]; stance: 'OVERCHARGE' } => ({ assaultIds: tutorial.state.cards.slice(0, 3).map(card => card.id), aegisIds: tutorial.state.cards.slice(3).map(card => card.id), stance: 'OVERCHARGE' });
beforeEach(() => {
  parent = new Node(); body = new Node(); doc = new Node(); target = new Node(); modalOpen = false;
  vi.stubGlobal('document', Object.assign(doc, { body, createElement: () => new Node(), querySelector: () => modalOpen ? new Node() : null, querySelectorAll: () => [target] }));
  disconnect = vi.fn(); vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = disconnect; });
  complete = vi.fn(); publish = vi.fn(); clash = vi.fn(); sound.playVictory.mockClear();
  tutorial = new TutorialManager(parent as unknown as HTMLElement, complete); tutorial.onStateChange = publish; tutorial.onClash = clash;
});
afterEach(() => { tutorial.hide(); vi.unstubAllGlobals(); });

describe('Spec-09 TutorialManager public API and lifecycle', () => {
  it('starts at step zero and cannot advance without participating', () => {
    expect(tutorial.isRunning).toBe(false); tutorial.start(); expect(tutorial.isRunning).toBe(true); expect(tutorial.currentStepIndex).toBe(0);
    expect(button('tut-next-btn').disabled).toBe(true); tutorial.nextStep(); expect(tutorial.currentStepIndex).toBe(0);
    expect(target.classes.has('tutorial-target')).toBe(true); expect(parent.properties.get('--tutorial-height')).toBe('300px'); expect(publish).toHaveBeenCalledOnce();
  });
  it('COMMIT_HAND validates the exact split and calls nextStep', () => {
    tutorial.start(); const next = vi.spyOn(tutorial, 'nextStep'); tutorial.onUserAction('COMMIT_HAND'); expect(next).not.toHaveBeenCalled();
    tutorial.readSelection = () => validSplit();
    tutorial.onUserAction('COMMIT_HAND'); expect(next).toHaveBeenCalledOnce(); expect(tutorial.currentStepIndex).toBe(1);
  });
  it('holds the successful nudge result until the player continues and supports previous', () => {
    tutorial.start(); tutorial.onUserAction('COMMIT_HAND', validSplit()); tutorial.onUserAction('NUDGE_RANK', { cardId: 'flux-4', direction: 'DOWN' });
    expect(tutorial.currentStepIndex).toBe(1); expect(tutorial.state.cards[2].rank).toBe(3); expect(button('tut-next-btn').disabled).toBe(false); expect(target.classes.has('tutorial-target')).toBe(false);
    button('tut-next-btn').emit('click'); expect(tutorial.currentStepIndex).toBe(2); tutorial.prevStep(); expect(tutorial.currentStepIndex).toBe(1); expect(tutorial.state.cards[2].rank).toBe(4);
  });
  it('skip exits immediately and calls the completion callback only once', () => {
    tutorial.start(); button('tut-skip-btn').emit('click'); button('tut-skip-btn').emit('click'); expect(complete).toHaveBeenCalledOnce(); expect(tutorial.isRunning).toBe(false); expect(overlay().hidden).toBe(true);
  });
  it('Escape closes training unless rules are open or another handler consumed it', () => {
    tutorial.start(); const preventDefault = vi.fn(); modalOpen = true; doc.emit('keydown', { key: 'Escape', preventDefault }); expect(tutorial.isRunning).toBe(true);
    modalOpen = false; doc.emit('keydown', { key: 'Escape', defaultPrevented: true, preventDefault }); expect(tutorial.isRunning).toBe(true);
    doc.emit('keydown', { key: 'Escape', preventDefault }); expect(complete).toHaveBeenCalledOnce(); expect(preventDefault).toHaveBeenCalledOnce(); expect(tutorial.isRunning).toBe(false);
  });
  it('hide cleans highlights, classes, sizing observer and key listener without invoking callback', () => {
    tutorial.start(); tutorial.hide(); expect(target.classes.size).toBe(0); expect(body.classes.size).toBe(0); expect(parent.properties.size).toBe(0); expect(doc.listeners.get('keydown')?.size).toBe(0); expect(disconnect).toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled();
    tutorial.onUserAction('COMMIT_HAND', validSplit()); tutorial.nextStep(); expect(tutorial.currentStepIndex).toBe(0);
  });
  it('restarting repeatedly installs only one key listener and resets state', () => {
    tutorial.start(); tutorial.onUserAction('COMMIT_HAND', validSplit()); tutorial.start(); tutorial.start(); expect(tutorial.currentStepIndex).toBe(0); expect(doc.listeners.get('keydown')?.size).toBe(1);
  });
  it('final commitment triggers one simulated clash and an explicit completion banner', () => {
    tutorial.start(); tutorial.onUserAction('COMMIT_HAND', validSplit()); tutorial.onUserAction('NUDGE_RANK', { cardId: 'flux-4', direction: 'DOWN' }); tutorial.nextStep();
    tutorial.onUserAction('BURN_CARD', { cardId: 'burn-k' }); tutorial.nextStep(); tutorial.onUserAction('SELECT_STANCE', { stance: 'OVERCHARGE' }); tutorial.onUserAction('COMMIT_HAND', validSplit());
    expect(tutorial.state.complete).toBe(true); expect(clash).toHaveBeenCalledOnce(); expect(sound.playVictory).toHaveBeenCalledOnce(); expect(button('tutorial-title').textContent).toBe('TRAINING COMPLETE: OPERATIVE COMBAT READY');
    expect(complete).not.toHaveBeenCalled(); expect(tutorial.isRunning).toBe(true); tutorial.nextStep(); expect(clash).toHaveBeenCalledOnce();
    button('tut-next-btn').emit('click'); expect(complete).toHaveBeenCalledOnce(); expect(tutorial.isRunning).toBe(false);
  });
});
