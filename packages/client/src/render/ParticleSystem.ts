import * as THREE from 'three';

/** A dense typed-array pool. Positions and acceleration use seconds, never frames. */
export class ParticleSystem {
  public readonly mesh: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly colors: Float32Array;
  private readonly baseColors: Float32Array;
  private readonly lifetimes: Float32Array;
  private readonly durations: Float32Array;
  private readonly color = new THREE.Color();
  private active = 0;
  private replacement = 0;
  private reduced = false;
  private readonly uniforms = { uHighEnergy: { value: 0 }, uParticleTime: { value: 0 } };

  constructor(private readonly maxParticles = 1000) {
    if (!Number.isInteger(maxParticles) || maxParticles < 1 || maxParticles > 10000) throw new RangeError('Invalid particle capacity');
    this.positions = new Float32Array(maxParticles * 3);
    this.velocities = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    this.baseColors = new Float32Array(maxParticles * 3);
    this.lifetimes = new Float32Array(maxParticles);
    this.durations = new Float32Array(maxParticles);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(this.velocities, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(this.lifetimes, 1));
    geometry.setDrawRange(0, 0);
    const material = new THREE.PointsMaterial({ size: 0.6, vertexColors: true, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = 'uniform float uHighEnergy; uniform float uParticleTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', 'vec3 transformed = vec3(position); transformed.xy += sin(position.yx * 8.0 + uParticleTime * 9.0) * uHighEnergy * 0.025;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
        'vec2 spark = abs(gl_PointCoord - 0.5); if (spark.x + spark.y > 0.5) discard;\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey = () => 'vector-particles-v1';
    this.mesh = new THREE.Points(geometry, material);
    this.mesh.frustumCulled = false;
  }
  public get activeCount(): number { return this.active; }
  public burst(pos: THREE.Vector3, count = 40, colorHex = 0x00f3ff, speedScale = 1): void {
    const emitted = Math.min(this.maxParticles, Math.max(0, Math.floor(count * (this.reduced ? 0.25 : 1))));
    this.color.setHex(colorHex);
    for (let n = 0; n < emitted; n++) {
      const i = this.active < this.maxParticles ? this.active++ : this.replacement++ % this.maxParticles;
      const angle = Math.random() * Math.PI * 2;
      const speed = (5 + Math.random() * 10) * speedScale * (this.reduced ? 0.2 : 1);
      this.positions[i * 3] = pos.x; this.positions[i * 3 + 1] = pos.y; this.positions[i * 3 + 2] = pos.z;
      this.velocities[i * 3] = Math.cos(angle) * speed;
      this.velocities[i * 3 + 1] = Math.sin(angle) * speed;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * speed * 0.4;
      this.baseColors[i * 3] = this.colors[i * 3] = this.color.r;
      this.baseColors[i * 3 + 1] = this.colors[i * 3 + 1] = this.color.g;
      this.baseColors[i * 3 + 2] = this.colors[i * 3 + 2] = this.color.b;
      this.lifetimes[i] = this.durations[i] = 0.6 + Math.random() * 0.6;
    }
    this.upload();
  }
  public update(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0 || !this.active) return;
    const acceleration = this.reduced ? 0 : 0.8;
    const factor = Math.exp(acceleration * delta);
    const travel = acceleration ? (factor - 1) / acceleration : delta;
    for (let i = this.active - 1; i >= 0; i--) {
      this.lifetimes[i] -= delta;
      if (this.lifetimes[i] <= 0) {
        const last = --this.active;
        if (i !== last) {
          this.lifetimes[i] = this.lifetimes[last]; this.durations[i] = this.durations[last];
          for (let axis = 0; axis < 3; axis++) {
            const target = i * 3 + axis, source = last * 3 + axis;
            this.positions[target] = this.positions[source]; this.velocities[target] = this.velocities[source];
            this.colors[target] = this.colors[source]; this.baseColors[target] = this.baseColors[source];
          }
        }
        continue;
      }
      for (let axis = 0; axis < 3; axis++) {
        const offset = i * 3 + axis;
        this.positions[offset] += this.velocities[offset] * travel;
        this.velocities[offset] *= factor;
        this.colors[offset] = this.baseColors[offset] * this.lifetimes[i] / this.durations[i];
      }
    }
    this.upload();
  }
  private upload(): void {
    this.mesh.geometry.setDrawRange(0, this.active);
    for (const name of ['position', 'velocity', 'color', 'lifetime']) this.mesh.geometry.attributes[name].needsUpdate = true;
  }
  public setAudioEnergy(high: number, time: number): void {
    this.uniforms.uHighEnergy.value = this.reduced ? 0 : Math.max(0, Math.min(1, high));
    this.uniforms.uParticleTime.value = time;
  }
  public clear(): void { this.active = 0; this.mesh.geometry.setDrawRange(0, 0); }
  public setReducedMotion(enabled: boolean): void { this.reduced = enabled; if (enabled) this.clear(); }
  public dispose(): void { this.clear(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
