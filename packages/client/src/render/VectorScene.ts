import * as THREE from 'three';
import type { Card, Stance } from '@cyberante/shared';
import { ReactiveGrid } from './ReactiveGrid.js';
import { ParticleSystem } from './ParticleSystem.js';
import { ProceduralCard } from './ProceduralCard.js';
import postShader from './shaders/postCrtBloom.glsl?raw';
import { masterAudio } from '../audio/AudioEngine.js';

export class VectorScene {
  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private grid: ReactiveGrid | null = null;
  public particles: ParticleSystem | null = null;
  private readonly cards: ProceduralCard[] = [];
  private target: THREE.WebGLRenderTarget | null = null;
  private postScene: THREE.Scene | null = null;
  private postCamera: THREE.OrthographicCamera | null = null;
  private postQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
  private observer: ResizeObserver | null = null;
  private media: MediaQueryList | null = null;
  private frame: number | undefined;
  private previousTime: number | null = null;
  private lost = false;
  private reduced = false;
  private crt = true;
  private title = true;
  private manualAudio = false;
  private bass = 0;
  private mid = 0;
  private high = 0;
  private damage = 0;
  private cardViewport: HTMLElement | null = null;
  private cardLayoutDirty = false;
  private width = 1;
  private height = 1;
  private readonly mouse = new THREE.Vector2();
  private mouseActive = false;
  private readonly world = new THREE.Vector3();
  private readonly burstOrigin = new THREE.Vector3();
  private readonly waveOrigin = new THREE.Vector2();
  private readonly size = new THREE.Vector2();
  private readonly postUniforms = {
    tDiffuse: { value: null as THREE.Texture | null }, uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 }, uDamageIntensity: { value: 0 }, uMidEnergy: { value: 0 },
    uCrt: { value: 1 }, uReducedMotion: { value: 0 }, uTitle: { value: 1 },
  };

  constructor(containerId?: string) {
    const container = document.getElementById(containerId ?? 'canvas-container');
    if (container) this.init(container);
    else if (containerId) throw new Error(`Canvas container #${containerId} not found`);
  }
  public init(container: HTMLElement): void {
    if (this.renderer) return;
    this.container = container;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch { container.dataset.rendererState = 'unavailable'; return; }
    this.renderer.setClearColor(0x030712, 1);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 30);
    this.camera.updateMatrixWorld();
    this.grid = new ReactiveGrid(); this.scene.add(this.grid.mesh);
    this.particles = new ParticleSystem(); this.scene.add(this.particles.mesh);
    for (let i = 0; i < 10; i++) {
      const card = new ProceduralCard({ id: `visual-${i}`, rank: 14, suit: 'SPADES' });
      card.group.visible = false; this.cards.push(card); this.scene.add(card.group);
    }
    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({ uniforms: this.postUniforms, vertexShader:
      'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: postShader, depthTest: false, depthWrite: false });
    this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.postScene.add(this.postQuad);
    this.media = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.setReducedMotion(this.media.matches);
    this.media.addEventListener('change', this.onMotionPreference);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerout', this.onPointerOut);
    window.addEventListener('scroll', this.onScroll, true);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.observer = new ResizeObserver(this.onWindowResize); this.observer.observe(container);
    this.onWindowResize();
    container.dataset.rendererState = 'ready';
    this.setTitleMode(this.title);
    this.syncCanvasSettings();
    this.startFrames();
  }
  private readonly tick = (milliseconds: number): void => {
    this.frame = undefined;
    if (!this.renderer || this.lost || document.hidden) return;
    this.update(milliseconds / 1000);
    this.frame = requestAnimationFrame(this.tick);
  };
  private startFrames(): void {
    if (this.frame === undefined && this.renderer && !this.lost && !document.hidden) this.frame = requestAnimationFrame(this.tick);
  }
  private stopFrames(): void { if (this.frame !== undefined) cancelAnimationFrame(this.frame); this.frame = undefined; }
  private readonly onContextLost = (event: Event): void => {
    event.preventDefault(); this.lost = true; this.stopFrames();
    if (this.container) this.container.dataset.rendererState = 'lost';
  };
  private readonly onContextRestored = (): void => {
    this.lost = false; this.previousTime = null;
    this.onResize(this.width, this.height);
    if (this.container) this.container.dataset.rendererState = 'ready';
    this.startFrames();
  };
  private readonly onVisibility = (): void => {
    this.previousTime = null;
    if (document.hidden) { this.stopFrames(); this.particles?.clear(); this.damage = 0; }
    else this.startFrames();
  };
  private readonly onMotionPreference = (event: MediaQueryListEvent): void => this.setReducedMotion(event.matches);
  private readonly onWindowResize = (): void => {
    if (this.container) this.onResize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
  };
  private readonly onScroll = (): void => { this.cardLayoutDirty = true; };
  private readonly onPointerOut = (event: PointerEvent): void => { if (!event.relatedTarget) this.mouseActive = false; };
  private readonly onPointerMove = (event: PointerEvent): void => {
    const pos = this.screenToWorld(event.clientX, event.clientY);
    this.mouse.set(pos.x, pos.y); this.mouseActive = true;
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-card-id]') : null;
    this.highlightCard(element?.dataset.cardId);
  };
  public screenToWorld(clientX: number, clientY: number): THREE.Vector3 {
    if (!this.camera || !this.container) return this.world.set(0, 0, 0);
    const rect = this.container.getBoundingClientRect();
    this.world.set((clientX - rect.left) / this.width * 2 - 1, -(clientY - rect.top) / this.height * 2 + 1, 0.5).unproject(this.camera);
    this.world.sub(this.camera.position).normalize();
    const distance = -this.camera.position.z / this.world.z;
    return this.world.multiplyScalar(distance).add(this.camera.position);
  }
  public triggerShockwave(x: number, y: number, intensity = 1): void {
    this.waveOrigin.set(x, y); this.grid?.triggerShockwave(this.waveOrigin, intensity);
  }
  public triggerSparks(x: number, y: number, colorHex = 0x00f3ff): void {
    this.burstOrigin.set(x, y, 0); this.particles?.burst(this.burstOrigin, 40, colorHex);
  }
  public triggerBurn(x: number, y: number, colorHex: number): void {
    this.burstOrigin.set(x, y, 0); this.particles?.burst(this.burstOrigin, 100, colorHex);
    this.triggerShockwave(x, y, 1.5);
  }
  public triggerClashExplosion(p1Stance: Stance, p2Stance: Stance, intensity: number): void {
    const strength = Math.max(0.5, Math.min(4, intensity));
    this.burstOrigin.set(-1.5, 0, 0); this.particles?.burst(this.burstOrigin, 125, 0x00f3ff, p1Stance === 'OVERCHARGE' ? 1.8 : 1.3);
    this.burstOrigin.set(1.5, 0, 0); this.particles?.burst(this.burstOrigin, 125, 0xff0055, p2Stance === 'OVERCHARGE' ? 1.8 : 1.3);
    this.triggerShockwave(0, 0, strength * 2);
    this.damage = this.reduced ? 0 : strength / 4;
  }
  public setAudioEnergy(bass: number, mid: number, high: number): void {
    this.manualAudio = true;
    this.bass = THREE.MathUtils.clamp(bass, 0, 1); this.mid = THREE.MathUtils.clamp(mid, 0, 1); this.high = THREE.MathUtils.clamp(high, 0, 1);
  }
  public setTitleMode(enabled: boolean): void {
    this.title = enabled; this.postUniforms.uTitle.value = enabled ? 1 : 0;
    if (this.grid) this.grid.mesh.material.opacity = enabled ? 0.22 : 0.65;
    if (enabled) this.clearCards(); this.syncCanvasSettings();
  }
  public setCards(self: readonly Card[], opponent?: readonly Card[]): void {
    if (!this.cards.length) return;
    for (let i = 0; i < 10; i++) {
      const data = i < 5 ? self[i] : opponent?.[i - 5];
      this.cards[i].group.visible = i < 5 ? Boolean(data) : self.length > 0;
      this.cards[i].setFaceDown(i >= 5 && !data);
      if (data) this.cards[i].setCard(data);
      if (i >= 5) this.cards[i].setTint(0xff0055);
    }
    this.cardLayoutDirty = true;
  }
  public clearCards(): void { for (const card of this.cards) card.group.visible = false; }
  public highlightCard(id?: string): void { for (const card of this.cards) card.setHighlight(card.cardData.id === id); }
  public setCardViewport(element: HTMLElement): void { this.cardViewport = element; this.layoutCards(); }
  private layoutCards(): void {
    this.cardLayoutDirty = false;
    if (this.cardViewport && !this.title) {
      const rect = this.cardViewport.getBoundingClientRect();
      const topLeft = this.screenToWorld(rect.left, rect.top); const left = topLeft.x, top = topLeft.y;
      const bottomRight = this.screenToWorld(rect.right, rect.bottom);
      const centerX = (left + bottomRight.x) / 2, centerY = (top + bottomRight.y) / 2;
      const height = top - bottomRight.y;
      const scale = Math.max(0.01, Math.min((bottomRight.x - left) / 24, height / 12));
      for (let i = 0; i < this.cards.length; i++) {
        this.cards[i].group.position.set(centerX + ((i % 5) - 2) * 4.2 * scale, centerY + (i < 5 ? -height / 4 : height / 4), 0);
        this.cards[i].group.scale.setScalar(scale);
      }
      return;
    }
    const scale = Math.min(0.65, this.width / this.height * 1.25);
    for (let i = 0; i < this.cards.length; i++) {
      this.cards[i].group.position.set(((i % 5) - 2) * 4.2 * scale, i < 5 ? -1.8 : 2.1, 0);
      this.cards[i].group.scale.setScalar(scale);
    }
  }
  public toggleReducedMotion(): boolean { this.setReducedMotion(!this.reduced); return this.reduced; }
  private setReducedMotion(enabled: boolean): void {
    this.reduced = enabled; this.damage = 0;
    this.grid?.setReducedMotion(enabled); this.particles?.setReducedMotion(enabled);
    this.postUniforms.uReducedMotion.value = enabled ? 1 : 0;
    document.body.classList.toggle('reduced-motion', enabled);
    this.syncCanvasSettings();
    document.dispatchEvent(new Event('visualsettingschange'));
  }
  public toggleCrt(): boolean {
    this.crt = !this.crt; this.postUniforms.uCrt.value = this.crt ? 1 : 0;
    document.body.classList.toggle('clean-display', !this.crt);
    this.syncCanvasSettings(); document.dispatchEvent(new Event('visualsettingschange'));
    return this.crt;
  }
  private syncCanvasSettings(): void {
    if (!this.renderer) return;
    Object.assign(this.renderer.domElement.dataset, { crt: String(this.crt), reducedMotion: String(this.reduced), title: String(this.title) });
  }
  public onResize(width: number, height: number): void {
    if (!this.renderer || !this.camera) return;
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    this.camera.aspect = this.width / this.height; this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.getDrawingBufferSize(this.size);
    if (!this.target) this.target = new THREE.WebGLRenderTarget(this.size.x, this.size.y, { depthBuffer: true });
    else this.target.setSize(this.size.x, this.size.y);
    this.postUniforms.tDiffuse.value = this.target.texture;
    this.postUniforms.uResolution.value.copy(this.size);
    this.layoutCards();
  }
  /** Absolute elapsed seconds, matching ReactiveGrid; RAF converts milliseconds. */
  public update(time: number): void {
    if (!this.renderer || !this.scene || !this.camera || this.lost || !Number.isFinite(time)) return;
    const delta = this.previousTime === null ? 0 : Math.min(0.05, Math.max(0, time - this.previousTime));
    this.previousTime = time;
    if (!this.manualAudio) {
      const energy = masterAudio.getEnergyLevels(); this.bass = energy.bass; this.mid = energy.mid; this.high = energy.high;
    }
    if (this.cardLayoutDirty) this.layoutCards();
    this.grid!.update(time, this.bass, this.mouseActive ? this.mouse : undefined);
    this.particles!.update(delta); this.particles!.setAudioEnergy(this.high, time);
    this.damage *= Math.exp(-delta * 5);
    this.postUniforms.uTime.value = time;
    this.postUniforms.uMidEnergy.value = this.reduced ? 0 : this.mid;
    this.postUniforms.uDamageIntensity.value = this.damage;
    this.renderer.setRenderTarget(this.target); this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null); this.renderer.render(this.postScene!, this.postCamera!);
  }
  public getDiagnostics(): { particles: number; geometries: number; textures: number; lost: boolean } {
    return { particles: this.particles?.activeCount ?? 0, geometries: this.renderer?.info.memory.geometries ?? 0,
      textures: this.renderer?.info.memory.textures ?? 0, lost: this.lost };
  }
  public destroy(): void {
    this.stopFrames(); this.observer?.disconnect(); this.observer = null;
    window.removeEventListener('resize', this.onWindowResize); window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerout', this.onPointerOut); window.removeEventListener('scroll', this.onScroll, true); document.removeEventListener('visibilitychange', this.onVisibility);
    this.media?.removeEventListener('change', this.onMotionPreference); this.media = null;
    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    }
    this.grid?.dispose(); this.particles?.dispose(); for (const card of this.cards) card.dispose(); this.cards.length = 0;
    this.target?.dispose(); this.postQuad?.geometry.dispose(); this.postQuad?.material.dispose();
    this.renderer?.dispose(); this.renderer?.forceContextLoss(); this.renderer?.domElement.remove();
    if (this.container) this.container.dataset.rendererState = 'destroyed';
    this.renderer = null; this.scene = null; this.camera = null; this.grid = null; this.particles = null;
    this.target = null; this.postScene = null; this.postCamera = null; this.postQuad = null; this.container = null;
    this.previousTime = null; this.lost = false; this.cardViewport = null;
  }
}
