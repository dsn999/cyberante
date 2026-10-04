// ============================================================================
// CYBERANTE: Geometry Wars Dynamic Reactive Grid
// ============================================================================

import * as THREE from 'three';

export class ReactiveGrid {
  public mesh: THREE.LineSegments;
  private geometry: THREE.BufferGeometry;
  private originalPositions: Float32Array;
  private currentPositions: Float32Array;
  private shockwaveRadius: number = -1;
  private shockwaveIntensity: number = 0;
  private shockwaveCenter = new THREE.Vector2(0, 0);

  constructor(width: number = 80, height: number = 50, segmentsX: number = 40, segmentsY: number = 25) {
    const points: THREE.Vector3[] = [];

    const halfW = width / 2;
    const halfH = height / 2;
    const stepX = width / segmentsX;
    const stepY = height / segmentsY;

    // Horizontal lines
    for (let y = -halfH; y <= halfH; y += stepY) {
      points.push(new THREE.Vector3(-halfW, y, 0));
      points.push(new THREE.Vector3(halfW, y, 0));
    }

    // Vertical lines
    for (let x = -halfW; x <= halfW; x += stepX) {
      points.push(new THREE.Vector3(x, -halfH, 0));
      points.push(new THREE.Vector3(x, halfH, 0));
    }

    this.geometry = new THREE.BufferGeometry().setFromPoints(points);
    const posAttr = this.geometry.attributes.position;
    this.originalPositions = new Float32Array(posAttr.array);
    this.currentPositions = new Float32Array(posAttr.array);

    const material = new THREE.LineBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.LineSegments(this.geometry, material);
    this.mesh.position.z = -5;
  }

  public triggerShockwave(center: THREE.Vector2, intensity: number = 1.0): void {
    this.shockwaveCenter.copy(center);
    this.shockwaveIntensity = intensity;
    this.shockwaveRadius = 0;
  }

  public update(time: number, bassEnergy: number, mousePos?: THREE.Vector2): void {
    const pos = this.geometry.attributes.position;
    const count = pos.count;

    if (this.shockwaveRadius >= 0) {
      this.shockwaveRadius += 0.8;
      this.shockwaveIntensity *= 0.95;
      if (this.shockwaveRadius > 50 || this.shockwaveIntensity < 0.02) {
        this.shockwaveRadius = -1;
      }
    }

    for (let i = 0; i < count; i++) {
      const ox = this.originalPositions[i * 3];
      const oy = this.originalPositions[i * 3 + 1];

      // Base undulating harmonic wave
      const wave = Math.sin(ox * 0.15 + time * 2.0) * Math.cos(oy * 0.15 + time * 1.5);
      let z = wave * (0.5 + bassEnergy * 2.5);

      // Mouse gravity well pull
      if (mousePos) {
        const dx = ox - mousePos.x;
        const dy = oy - mousePos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 150) {
          const factor = (150 - distSq) / 150;
          z += factor * 3.0;
        }
      }

      // Shockwave impact
      if (this.shockwaveRadius >= 0) {
        const dx = ox - this.shockwaveCenter.x;
        const dy = oy - this.shockwaveCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const diff = Math.abs(dist - this.shockwaveRadius);
        if (diff < 4.0) {
          z += Math.sin(diff * 1.5) * this.shockwaveIntensity * 4.0;
        }
      }

      pos.setZ(i, z);
    }

    pos.needsUpdate = true;
  }
}
