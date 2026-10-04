# SPEC-07: Geometry Wars Neon Vector Renderer

## 1. Context & Objective
Implement code-driven Three.js neon vector graphics inspired by *Geometry Wars*, featuring a reactive warping wireframe grid, glowing particle explosions, and CRT post-processing.

## 2. Target Files
- `packages/client/src/render/VectorScene.ts`
- `packages/client/src/render/ReactiveGrid.ts`
- `packages/client/src/render/ProceduralCard.ts`
- `packages/client/src/render/ParticleSystem.ts`
- `packages/client/src/render/shaders/gridDisplacement.glsl`
- `packages/client/src/render/shaders/postCrtBloom.glsl`

## 3. Invariants & Rules
1. **Zero External Textures:** All lines, grids, typography, and card frames rendered via mathematical vectors.
2. **Dynamic Reactive Grid:** Undulating wireframe grid deformed by mouse hover, card drop gravity wells, and clash shockwaves.
3. **Additive Vector Particles:** Burst of 100–300 glowing geometric particles (triangles, diamonds) on card burn and damage impact.
4. **Compositing:** Neon bloom pass, scanlines, subtle CRT barrel distortion, and damage-responsive chromatic aberration.

## 4. Verification Command
Vite dev bundle verification and headless Three.js scene creation test.
