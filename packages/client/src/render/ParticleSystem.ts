// ============================================================================
// CYBERANTE: Vector Particle Explosion System (Geometry Wars Sparks)
// ============================================================================

import * as THREE from 'three';

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

export class ParticleSystem {
  public mesh: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private particles: Particle[] = [];
  private positions: Float32Array;
  private colors: Float32Array;
  private maxParticles = 1200;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Points(this.geometry, material);
  }

  public burst(origin: THREE.Vector3, count: number = 150, hexColor: number = 0x00f3ff): void {
    const baseColor = new THREE.Color(hexColor);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.15 + Math.random() * 0.45;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        (Math.random() - 0.5) * 0.2
      );

      this.particles.push({
        pos: origin.clone(),
        vel,
        life: 1.0,
        maxLife: 0.6 + Math.random() * 0.6,
        color: baseColor.clone(),
      });
    }
  }

  public update(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.pos.add(p.vel);
      p.vel.multiplyScalar(0.96); // Drag
      p.life -= delta / p.maxLife;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    const posAttr = this.geometry.attributes.position;
    const colAttr = this.geometry.attributes.color;

    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        this.positions[i * 3] = p.pos.x;
        this.positions[i * 3 + 1] = p.pos.y;
        this.positions[i * 3 + 2] = p.pos.z;

        this.colors[i * 3] = p.color.r * p.life;
        this.colors[i * 3 + 1] = p.color.g * p.life;
        this.colors[i * 3 + 2] = p.color.b * p.life;
      } else {
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = 0;
        this.positions[i * 3 + 2] = -9999;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
