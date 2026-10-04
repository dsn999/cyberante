import * as THREE from 'three';
import displacement from './shaders/gridDisplacement.glsl?raw';

export class ReactiveGrid {
  public readonly mesh: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private time = 0;
  private nextWave = 0;
  public readonly uniforms = {
    uTime: { value: 0 }, uBassEnergy: { value: 0 },
    uMouse: { value: new THREE.Vector2() }, uMouseActive: { value: 0 },
    uReducedMotion: { value: 0 },
    uWaves: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, 0)) },
  };

  constructor(widthSegments = 40, heightSegments = 25) {
    if (![widthSegments, heightSegments].every(n => Number.isInteger(n) && n > 0 && n <= 160)) {
      throw new RangeError('Grid segments must be integers from 1 to 160');
    }
    const positions = new Float32Array((widthSegments + 1) * (heightSegments + 1) * 3);
    const indices: number[] = [];
    for (let y = 0; y <= heightSegments; y++) for (let x = 0; x <= widthSegments; x++) {
      const vertex = y * (widthSegments + 1) + x;
      positions[vertex * 3] = -25 + x * 50 / widthSegments;
      positions[vertex * 3 + 1] = -15 + y * 30 / heightSegments;
      if (x < widthSegments) indices.push(vertex, vertex + 1);
      if (y < heightSegments) indices.push(vertex, vertex + widthSegments + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 45);
    const material = new THREE.LineBasicMaterial({ color: 0x00f3ff, blending: THREE.AdditiveBlending,
      transparent: true, opacity: 0.65, depthWrite: false });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = displacement + '\n' + shader.vertexShader.replace('#include <begin_vertex>',
        'vec3 transformed = vec3(position); transformed.z += gridDisplacement(position.xy);');
    };
    material.customProgramCacheKey = () => 'reactive-grid-v1';
    this.mesh = new THREE.LineSegments(geometry, material);
    this.mesh.position.z = -5;
  }
  public triggerShockwave(center: THREE.Vector2, intensity = 1): void {
    this.uniforms.uWaves.value[this.nextWave].set(center.x, center.y, this.time, Math.max(0, Math.min(8, intensity)));
    this.nextWave = (this.nextWave + 1) % 4;
  }
  public update(time: number, bassEnergy: number, mousePos?: THREE.Vector2): void {
    this.time = Math.max(0, time);
    // Freeze the harmonic motion as well as clamping all deformation in reduced mode.
    this.uniforms.uTime.value = this.uniforms.uReducedMotion.value ? 0 : this.time;
    this.uniforms.uBassEnergy.value = Math.max(0, Math.min(1, bassEnergy));
    this.uniforms.uMouseActive.value = mousePos ? 1 : 0;
    if (mousePos) this.uniforms.uMouse.value.copy(mousePos);
  }
  public setReducedMotion(enabled: boolean): void {
    this.uniforms.uReducedMotion.value = enabled ? 1 : 0;
    for (const wave of this.uniforms.uWaves.value) wave.w = 0;
  }
  public dispose(): void { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
