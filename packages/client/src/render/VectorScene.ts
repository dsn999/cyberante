// ============================================================================
// CYBERANTE: Master Vector Scene & WebGL Render Pipeline
// ============================================================================

import * as THREE from 'three';
import { ReactiveGrid } from './ReactiveGrid';
import { ParticleSystem } from './ParticleSystem';
import { masterAudio } from '../audio/AudioEngine';

export class VectorScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private grid: ReactiveGrid;
  public particles: ParticleSystem;
  private clock: THREE.Clock = new THREE.Clock();
  private mousePos = new THREE.Vector2(0, 0);

  constructor(containerId: string = 'canvas-container') {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`Canvas container #${containerId} not found in DOM.`);
    }
    this.container = el;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030712);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 25;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // Instantiate Reactive Grid & Particles
    this.grid = new ReactiveGrid();
    this.scene.add(this.grid.mesh);

    this.particles = new ParticleSystem();
    this.scene.add(this.particles.mesh);

    window.addEventListener('resize', this.onWindowResize.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));

    this.animate();
  }

  public triggerShockwave(x: number, y: number, intensity: number = 1.0): void {
    this.grid.triggerShockwave(new THREE.Vector2(x, y), intensity);
  }

  public triggerSparks(x: number, y: number, color: number = 0x00f3ff): void {
    this.particles.burst(new THREE.Vector3(x, y, 0), 120, color);
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private onMouseMove(e: MouseEvent): void {
    // Convert screen coordinates to world plane approximations
    const normX = (e.clientX / window.innerWidth) * 2 - 1;
    const normY = -(e.clientY / window.innerHeight) * 2 + 1;
    this.mousePos.set(normX * 20, normY * 12);
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // Query real-time procedural audio FFT
    const energy = masterAudio.getEnergyLevels();

    // Update geometry wars grid and particle physics
    this.grid.update(elapsedTime, energy.bass, this.mousePos);
    this.particles.update(delta);

    this.renderer.render(this.scene, this.camera);
  }
}
