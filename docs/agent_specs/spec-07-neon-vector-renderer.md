# SPEC-07: Reactive Neon Vector Renderer & Particle Engine

## 1. Goal & Non-Goals
- **Goal:** Implement code-driven Three.js neon vector rendering inspired by retro-arcade vector displays and phosphor oscilloscopes, featuring a reactive warping wireframe grid, physics displacement / gravity wells, additive glowing vector particle explosions, CRT post-processing, and audio-reactive uniform coupling.
- **Non-Goals:** Do not load raster image textures (PNG/JPG), 3D GLTF models, or sprite sheets (100% procedural vector rendering).

## 2. Inputs, Target Files & Dependencies
- **Target Files:**
  - `packages/client/src/render/VectorScene.ts`
  - `packages/client/src/render/ReactiveGrid.ts`
  - `packages/client/src/render/ProceduralCard.ts`
  - `packages/client/src/render/ParticleSystem.ts`
  - `packages/client/src/render/shaders/gridDisplacement.glsl`
  - `packages/client/src/render/shaders/postCrtBloom.glsl`
- **Dependencies:**
  - `three` (^0.166.1) for WebGL canvas and scene management.
  - `@cyberante/shared` contracts (`Stance`, `BurnType`, `Suit`, `SUIT_COLORS`).
  - Strict zero-texture asset footprint (no `.png`, `.jpg`, `.webp`, or `.gltf` files).

## 3. Public API & Contract Signatures

### 3.1 VectorScene Class (`packages/client/src/render/VectorScene.ts`)
```typescript
import { Stance } from '@cyberante/shared';

export class VectorScene {
  constructor(containerId?: string);

  public init(container: HTMLElement): void;
  public triggerShockwave(x: number, y: number, intensity?: number): void;
  public triggerSparks(x: number, y: number, colorHex?: number): void;
  public triggerClashExplosion(p1Stance: Stance, p2Stance: Stance, intensity: number, incomingDamage?: number): void;
  public setAudioEnergy(bass: number, mid: number, high: number): void;

  public toggleReducedMotion(): boolean;
  public toggleCrt(): boolean;

  public onResize(width: number, height: number): void;
  public update(time: number): void;
  public destroy(): void;
}
```

The controller passes local-player stance first and opponent stance second.
Optional `incomingDamage` sets chromatic intensity from damage received by the
local player; zero incoming damage adds no damage-driven aberration. Existing
three-argument calls retain intensity-driven behavior. Round-win and match-win
celebrations use the same pooled `triggerVictoryConfetti()` effect, deduplicated
by exchange and match respectively.

### 3.2 ReactiveGrid Class (`packages/client/src/render/ReactiveGrid.ts`)
```typescript
import * as THREE from 'three';

export class ReactiveGrid {
  public mesh: THREE.LineSegments;

  constructor(widthSegments?: number, heightSegments?: number);

  public triggerShockwave(center: THREE.Vector2, intensity?: number): void;
  public update(time: number, bassEnergy: number, mousePos?: THREE.Vector2): void;
  public setReducedMotion(enabled: boolean): void;
}
```

### 3.3 ParticleSystem Class (`packages/client/src/render/ParticleSystem.ts`)
```typescript
import * as THREE from 'three';

export class ParticleSystem {
  public mesh: THREE.Points;

  constructor(maxParticles?: number);

  public burst(pos: THREE.Vector3, count?: number, colorHex?: number): void;
  public update(delta: number): void;
  public setReducedMotion(enabled: boolean): void;
}
```

## 4. Detailed Behavior & Visual Pipeline

### 4.1 Scene Setup & Viewport
- **Camera:** `PerspectiveCamera` with $60^\circ$ FOV, near clip $0.1$, far clip $1000$, positioned at $(0, 0, 30)$.
- **Renderer:** `WebGLRenderer` with `antialias: true, alpha: true, powerPreference: 'high-performance'`.
- Canvas fills `#canvas-container` element with dynamic resize observer handling window dimensions and device pixel ratios ($DPR \le 2.0$).

### 4.2 Dynamic Reactive Wireframe Grid
- **Geometry:** Grid of $40 \times 25$ segments spanning world space from $X \in [-25, 25]$, $Y \in [-15, 15]$.
- **Material:** `LineBasicMaterial` with color `#00f3ff` (Neon Cyan) and `blending: THREE.AdditiveBlending, transparent: true, opacity: 0.65`.
- **Vertex Displacement Physics:**
  1. **Mouse Gravity Well:** Vertices within radius $R = 8.0$ of normalized cursor position are displaced downwards along the $Z$-axis with inverse falloff:
     $$\Delta Z_{\text{mouse}} = \frac{-G \cdot \text{strength}}{\|\mathbf{v}_{xy} - \mathbf{p}_{\text{mouse}}\|^2 + 1.0}$$
  2. **Shockwave Propagation:** Clashes and burns trigger radial expanding ripples centered at $(x_0, y_0)$:
     $$Z(r, t) = A \cdot e^{-\lambda t} \cdot \sin(k \cdot r - \omega \cdot t)$$
     where $r = \|\mathbf{v}_{xy} - \mathbf{p}_{\text{center}}\|$, $\lambda$ is exponential damping ($2.5$), and $\omega$ is wave speed ($18.0$).
  3. **Audio Resonance:** Audio FFT bass energy scales grid vertex displacement amplitude in real-time.

### 4.3 Additive Vector Particle System
- **Pool Allocation:** Single `THREE.BufferGeometry` holding 1,000 preallocated particle vertices.
- **Attributes:** `position` (Float32Array $\times 3$), `velocity` (Float32Array $\times 3$), `color` (Float32Array $\times 3$), `lifetime` (Float32Array).
- **Material:** `PointsMaterial` with `size: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true`.
- **Event Bursts:**
  - **Pip Nudge / Bleed:** 30–50 particles burst at card coordinate with suit color:
    - Spades: `#00f3ff` (Cyan)
    - Clubs: `#00ff88` (Neon Green)
    - Diamonds: `#ffb700` (Amber Gold)
    - Hearts: `#ff0055` (Neon Rose)
  - **Burn-to-Cast:** 100 radial particles with accelerating outward velocity ($v \in [5, 15]$).
  - **Clash Impact:** 250 high-velocity sparks colliding with opposing color schemes (Player Cyan vs Opponent Crimson), followed by a shockwave ripple across the wireframe grid.

### 4.4 CRT Phosphor Post-Processing & Scanlines
- **Shader Pass / CSS Blend:**
  - Subtle scanline overlay at 2px intervals with opacity $0.15$.
  - Barrel distortion / CRT vignette darkening borders ($r^4$ curve).
  - Chromatic aberration displacement on high damage impact:
    $$\Delta R = (u, v) + \delta \cdot \mathbf{dir}, \quad \Delta B = (u, v) - \delta \cdot \mathbf{dir}$$
- **Reduced Motion Mode:**
  - Accessible via in-game settings toggle or `prefers-reduced-motion` media query.
  - Disables intense screen shakes, clamps grid vertex deformation to $\le 0.1$, and reduces particle emission counts by $75\%$.

## 5. Invariants & Edge Cases
1. **Zero External Assets:** 100% procedural vector geometry. No external image textures or 3D model files may be referenced.
2. **Memory Leaks:** Do not allocate new geometries or materials inside `update()` or `render()`. All buffers are preallocated.
3. **Context Loss Recovery:** Listen for `webglcontextlost` and `webglcontextrestored` events on canvas, preventing app crash if GPU driver resets.
4. **Performance Target:** Sustained 60 FPS on standard modern integrated GPUs (Intel Iris Xe, Apple Silicon, Snapdragon Mobile).

## 6. Forbidden Boundaries & Anti-Patterns
- Strictly FORBIDDEN from importing `.png`, `.jpg`, `.webp`, `.svg`, or `.gltf` model files.
- Do NOT use heavy CPU vertex loops when GLSL shaders or typed array strides can execute efficiently.

## 7. Test Specifications
- Confirm `packages/client` compiles cleanly with Three.js shaders and vector scene classes.
- Inspect production build output (`packages/client/dist`) to guarantee zero image assets are emitted.

## 8. Exact Verification Command
```bash
npm --workspace=packages/client run build
```

## 9. Codex Dispatch Prompt
```markdown
### Codex Task: Reactive Neon Vector Renderer & Particle Engine (Spec-07)
Implement/refactor the Three.js reactive neon vector renderer and particle system according to `docs/agent_specs/spec-07-neon-vector-renderer.md`.

Target files:
- `packages/client/src/render/VectorScene.ts`
- `packages/client/src/render/ReactiveGrid.ts`
- `packages/client/src/render/ParticleSystem.ts`
- `packages/client/src/render/ProceduralCard.ts`
- `packages/client/src/render/shaders/gridDisplacement.glsl`
- `packages/client/src/render/shaders/postCrtBloom.glsl`

Requirements:
1. Render a dynamic reactive wireframe grid with mouse gravity displacement and radial shockwaves.
2. Implement preallocated additive vector particle bursts for nudges, suit bleeds, burns, and clash impacts.
3. Couple grid displacement with Web Audio FFT bass energy.
4. Implement CRT scanline post-processing and reduced-motion accessibility toggle.
5. Zero external image or 3D asset dependencies.
6. Verify client build passes cleanly: `npm --workspace=packages/client run build`.
```

## 10. Definition of Done Checklist
- [x] Three.js vector scene rendering to `#canvas-container`.
- [x] Reactive warping wireframe grid with mouse gravity and shockwave propagation.
- [x] Additive vector particle system with pooled buffers.
- [x] Audio-reactive FFT bass coupling.
- [x] CRT post-processing and reduced-motion accessibility mode.
- [x] Zero external image or 3D asset files in client bundle.

### Verification evidence and acceptance staging (2026-10-04)

- Exact client build command and the repository build/test/sim gates pass.
- 29 renderer unit tests cover subdivided GPU grid uniforms, elapsed-time pooled
  particles, all ranks/suits, face masking, the compositor, settings, projection,
  resizing, context/visibility recovery and complete resource destruction.
- Native Chromium acceptance checks shader compilation, changing splash pixels,
  frozen reduced-motion pixels, mobile sizing, independent settings, real GPU
  context loss/restoration and stable buffer/texture allocations across matches.
- Desktop/mobile splash and arena screenshots were inspected. Production output
  contains no image, SVG, model or audio asset files.
- **User-approved staging:** Physical integrated/mobile GPU acceptance of the
  unchanged 60 FPS target remains in **Spec-10B**. SwiftShader software-renderer
  timing is diagnostic evidence and does not certify physical GPU performance.
  `scripts/rendererBenchmark.mjs` reports GPU identity, viewport, framebuffer size,
  FPS and mean/p95 intervals with actual WebGL work completion.
- See [the implementation strategy](../implementation_strategy.md#spec-07-implementation-evidence-2026-10-04)
  for dispatch evidence and the software diagnostic command.
