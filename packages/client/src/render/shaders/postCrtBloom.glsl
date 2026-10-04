// CRT Scanline, Vignette, and Chromatic Aberration Fragment Shader
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDamageIntensity;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  // Barrel distortion
  vec2 centered = uv - 0.5;
  float r2 = dot(centered, centered);
  vec2 distortedUv = uv + centered * (r2 * 0.08);

  // Chromatic Aberration channel separation based on damage impulse
  float aberration = 0.003 + uDamageIntensity * 0.025;
  float r = texture2D(tDiffuse, distortedUv + vec2(aberration, 0.0)).r;
  float g = texture2D(tDiffuse, distortedUv).g;
  float b = texture2D(tDiffuse, distortedUv - vec2(aberration, 0.0)).b;

  vec3 col = vec3(r, g, b);

  // Scanlines
  float scanline = sin(distortedUv.y * uResolution.y * 1.5) * 0.04;
  col -= scanline;

  // Vignette
  float vignette = 1.0 - dot(centered, centered) * 1.2;
  col *= clamp(vignette, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
