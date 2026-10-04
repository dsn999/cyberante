// Geometry Wars Grid Vertex Displacement Shader
uniform float uTime;
uniform float uBassEnergy;
uniform vec2 uShockwaveCenter;
uniform float uShockwaveRadius;
uniform float uShockwaveIntensity;

varying vec2 vUv;
varying float vDisplacement;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Harmonic base undulation modulated by procedural audio bass
  float wave = sin(pos.x * 0.15 + uTime * 2.0) * cos(pos.y * 0.15 + uTime * 1.5);
  pos.z += wave * (0.8 + uBassEnergy * 2.5);

  // Shockwave radial displacement
  float dist = distance(pos.xy, uShockwaveCenter);
  if (uShockwaveRadius > 0.0) {
    float diff = dist - uShockwaveRadius;
    if (abs(diff) < 4.0) {
      float impact = sin(diff * 1.5) * uShockwaveIntensity * exp(-dist * 0.05);
      pos.z += impact * 6.0;
    }
  }

  vDisplacement = pos.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
