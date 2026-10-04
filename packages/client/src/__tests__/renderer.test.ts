import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SUIT_COLORS, type Card, type Rank, type Suit } from '@cyberante/shared';
import { ReactiveGrid } from '../render/ReactiveGrid.js';
import { ParticleSystem } from '../render/ParticleSystem.js';
import { ProceduralCard } from '../render/ProceduralCard.js';

const resources: { dispose(): void }[] = [];
afterEach(() => { for (const item of resources) item.dispose(); resources.length = 0; vi.restoreAllMocks(); });

describe('Spec-07 subdivided GPU grid', () => {
  it('spans exactly 50×30 with every horizontal and vertical cell edge', () => {
    const grid = new ReactiveGrid(); resources.push(grid);
    const geometry = grid.mesh.geometry, positions = geometry.attributes.position;
    expect(positions.count).toBe(41 * 26); expect(geometry.index!.count).toBe((40 * 26 + 25 * 41) * 2);
    expect(positions.getX(0)).toBe(-25); expect(positions.getY(0)).toBe(-15);
    expect(positions.getX(positions.count - 1)).toBe(25); expect(positions.getY(positions.count - 1)).toBe(15);
    expect(positions.getX(21 * 41 + 20)).toBe(0); // Interior intersections can deform.
    expect(grid.mesh.material.opacity).toBe(0.65); expect(grid.mesh.material.color.getHexString()).toBe('00f3ff');
    expect(grid.mesh.material.blending).toBe(THREE.AdditiveBlending);
  });
  it('injects active displacement into the native line shader without rewriting CPU positions', () => {
    const grid = new ReactiveGrid(8, 6); resources.push(grid);
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '' } as THREE.WebGLProgramParametersWithUniforms;
    grid.mesh.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain('gridDisplacement(position.xy)');
    expect(shader.vertexShader).toContain('d2 < 64.0'); expect(shader.vertexShader).toContain('-= 9.0 / (d2 + 1.0)');
    expect(shader.vertexShader).toContain('exp(-2.5 * age)'); expect(shader.vertexShader).toContain('18.0 * age');
    expect(shader.vertexShader).toContain('clamp(z, -0.1, 0.1)');
    const positions = grid.mesh.geometry.attributes.position; const original = new Float32Array(positions.array);
    const version = (positions as THREE.BufferAttribute).version;
    for (let time = 0; time < 3; time += 0.01) grid.update(time, 0.7, new THREE.Vector2(2, 3));
    expect(positions.array).toEqual(original); expect((positions as THREE.BufferAttribute).version).toBe(version);
    expect(shader.uniforms.uBassEnergy.value).toBe(0.7); expect(shader.uniforms.uMouse.value).toEqual(new THREE.Vector2(2, 3));
  });
  it('owns a fixed four-wave pool with audio-clock timestamps and clamps motion/bass', () => {
    const grid = new ReactiveGrid(); resources.push(grid); grid.update(4, 5);
    grid.triggerShockwave(new THREE.Vector2(1, 2), 3);
    expect(grid.uniforms.uWaves.value[0]).toEqual(new THREE.Vector4(1, 2, 4, 3));
    expect(grid.uniforms.uBassEnergy.value).toBe(1); expect(grid.uniforms.uMouseActive.value).toBe(0);
    for (let i = 0; i < 100; i++) grid.triggerShockwave(new THREE.Vector2(), 100);
    expect(grid.uniforms.uWaves.value).toHaveLength(4); expect(grid.uniforms.uWaves.value.every(v => v.w <= 8)).toBe(true);
    grid.setReducedMotion(true); grid.update(20, 0.5);
    expect(grid.uniforms.uTime.value).toBe(0); expect(grid.uniforms.uReducedMotion.value).toBe(1);
    expect(grid.uniforms.uWaves.value.every(v => v.w === 0)).toBe(true);
  });
  it('validates segment counts and disposes geometry and material', () => {
    for (const value of [0, -1, NaN, 0.2, 1000]) expect(() => new ReactiveGrid(value)).toThrow(RangeError);
    const grid = new ReactiveGrid(); const geometry = vi.spyOn(grid.mesh.geometry, 'dispose'); const material = vi.spyOn(grid.mesh.material, 'dispose');
    grid.dispose(); expect(geometry).toHaveBeenCalledOnce(); expect(material).toHaveBeenCalledOnce();
  });
});

describe('Spec-07 typed particle pool and elapsed-time physics', () => {
  beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(0.5); });
  const create = (capacity?: number): ParticleSystem => { const system = new ParticleSystem(capacity); resources.push(system); return system; };
  it('preallocates all four required attributes and the additive phosphor material', () => {
    const system = create(); expect(system.activeCount).toBe(0);
    for (const name of ['position', 'velocity', 'color', 'lifetime']) expect(system.mesh.geometry.attributes[name].count).toBe(1000);
    expect(system.mesh.material.size).toBe(0.6); expect(system.mesh.material.depthWrite).toBe(false);
    expect(system.mesh.material.blending).toBe(THREE.AdditiveBlending);
  });
  it('emits exact tactical counts, caps and reuses the same buffers under repeated bursts', () => {
    const system = create(); const attrs = system.mesh.geometry.attributes;
    system.burst(new THREE.Vector3(), 40); expect(system.activeCount).toBe(40);
    system.burst(new THREE.Vector3(), 100); expect(system.activeCount).toBe(140);
    system.burst(new THREE.Vector3(), 250); expect(system.activeCount).toBe(390);
    for (let i = 0; i < 100; i++) system.burst(new THREE.Vector3(1,2,3), 250, 0xff0055);
    expect(system.activeCount).toBe(1000); expect(system.mesh.geometry.attributes).toBe(attrs);
    expect(system.mesh.geometry.drawRange.count).toBe(1000);
    expect(attrs.position.getX(0)).toBe(1); expect(attrs.color.getX(0)).toBe(1);
  });
  it('uses 5–15 world units per second and accelerates Burn particles outward', () => {
    const system = create(); system.burst(new THREE.Vector3(), 1);
    expect(system.mesh.geometry.attributes.velocity.getX(0)).toBeCloseTo(-10);
    system.update(0.1); expect(system.mesh.geometry.attributes.velocity.getX(0)).toBeLessThan(-10);
    expect(system.mesh.geometry.attributes.position.getX(0)).toBeLessThan(-1);
    expect(system.mesh.geometry.attributes.color.getY(0)).toBeGreaterThan(0);
  });
  it('matches 30/60/120 FPS integration over the same elapsed time', () => {
    const final: number[] = [];
    for (const fps of [30, 60, 120]) {
      const system = create(); system.burst(new THREE.Vector3(), 1);
      for (let i = 0; i < fps / 2; i++) system.update(1 / fps);
      final.push(system.mesh.geometry.attributes.position.getX(0));
    }
    expect(final[0]).toBeCloseTo(final[1], 4); expect(final[1]).toBeCloseTo(final[2], 4);
  });
  it('expires and compacts particles, reuses capacity, and ignores invalid deltas', () => {
    const system = create(10); system.burst(new THREE.Vector3(), 10);
    system.update(NaN); system.update(-1); expect(system.activeCount).toBe(10);
    system.update(2); expect(system.activeCount).toBe(0); expect(system.mesh.geometry.drawRange.count).toBe(0);
    system.burst(new THREE.Vector3(), 10); expect(system.activeCount).toBe(10);
    system.clear(); expect(system.activeCount).toBe(0);
  });
  it('reduces emissions by 75%, clears active effects and disables FFT jitter', () => {
    const system = create(); system.burst(new THREE.Vector3(), 100); system.setReducedMotion(true);
    expect(system.activeCount).toBe(0); system.burst(new THREE.Vector3(), 100); expect(system.activeCount).toBe(25);
    system.setAudioEnergy(1, 2);
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <opaque_fragment>' } as THREE.WebGLProgramParametersWithUniforms;
    system.mesh.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.uniforms.uHighEnergy.value).toBe(0); expect(shader.fragmentShader).toContain('gl_PointCoord');
    system.setReducedMotion(false); system.setAudioEnergy(1, 2); expect(shader.uniforms.uHighEnergy.value).toBe(1);
  });
  it('validates capacity and disposes resources', () => {
    for (const capacity of [0, -1, 1.5, NaN, 20000]) expect(() => new ParticleSystem(capacity)).toThrow(RangeError);
    const system = new ParticleSystem(); const geometry = vi.spyOn(system.mesh.geometry, 'dispose'); const material = vi.spyOn(system.mesh.material, 'dispose');
    system.dispose(); expect(geometry).toHaveBeenCalledOnce(); expect(material).toHaveBeenCalledOnce();
  });
});

describe('Spec-07 procedural rank/suit strokes', () => {
  const create = (rank: Rank, suit: Suit = 'SPADES'): ProceduralCard => {
    const card = new ProceduralCard({ id: 'card', rank, suit }); resources.push(card); return card;
  };
  it('draws 13 distinct complete rank glyphs, including 10, J, Q, K and Ace', () => {
    const shapes = new Set<string>();
    for (let rank = 2; rank <= 14; rank++) {
      const card = create(rank as Rank); const mesh = card.group.children[0] as THREE.LineSegments;
      const values = mesh.geometry.attributes.position.array.slice(0, mesh.geometry.drawRange.count * 3);
      expect(Array.from(values).every(Number.isFinite)).toBe(true); shapes.add(Array.from(values).join(','));
    }
    expect(shapes.size).toBe(13);
  });
  it('draws distinct suit geometry with canonical colors', () => {
    const shapes = new Set<string>();
    for (const suit of Object.keys(SUIT_COLORS) as Suit[]) {
      const card = create(14, suit), mesh = card.group.children[0] as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
      shapes.add(Array.from(mesh.geometry.attributes.position.array.slice(0, mesh.geometry.drawRange.count * 3)).join(','));
      expect(mesh.material.color.getHexString()).toBe(SUIT_COLORS[suit].slice(1));
    }
    expect(shapes.size).toBe(4);
  });
  it('masks the entire face, retains stable geometry/material on transformations, and never mutates input', () => {
    const input: Card = { id: 'own', rank: 5, suit: 'HEARTS' }; const card = new ProceduralCard(input); resources.push(card);
    const mesh = card.group.children[0] as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    const geo = mesh.geometry; const material = mesh.material;
    card.setFaceDown(true); const back = new Float32Array(geo.attributes.position.array.slice(0, geo.drawRange.count * 3));
    card.setCard({ id: 'opponent', rank: 14, suit: 'SPADES' });
    expect(geo.attributes.position.array.slice(0, geo.drawRange.count * 3)).toEqual(back);
    card.setFaceDown(false); card.setHighlight(true); expect(material.color.getHexString()).toBe('ffffff');
    expect(mesh.geometry).toBe(geo); expect(mesh.material).toBe(material);
    expect(input).toEqual({ id: 'own', rank: 5, suit: 'HEARTS' });
    const copy = card.cardData; copy.rank = 2; expect(card.cardData.rank).toBe(14);
  });
});
