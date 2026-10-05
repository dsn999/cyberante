uniform float uTime;
uniform vec2 uGridScale;
uniform float uBassEnergy;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform float uReducedMotion;
uniform vec4 uWaves[4]; // center.xy, start time, amplitude

float gridDisplacement(vec2 point) {
  float z = sin(point.x * 0.15 + uTime * 2.0) * cos(point.y * 0.15 + uTime * 1.5);
  z *= 0.35 + uBassEnergy * 2.5;
  float d2 = dot(point - uMouse, point - uMouse);
  if (uMouseActive > 0.5 && d2 < 64.0) z -= 9.0 / (d2 + 1.0);
  for (int i = 0; i < 4; i++) {
    float age = max(0.0, uTime - uWaves[i].z);
    float r = distance(point, uWaves[i].xy);
    z += uWaves[i].w * exp(-2.5 * age) * sin(1.4 * r - 18.0 * age);
  }
  return uReducedMotion > 0.5 ? clamp(z, -0.1, 0.1) : z;
}
