uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDamageIntensity;
uniform float uMidEnergy;
uniform float uCrt;
uniform float uReducedMotion;
uniform float uTitle;
varying vec2 vUv;

vec3 spectrum(float phase) {
  return 0.5 + 0.5 * cos(6.2831853 * (phase + vec3(0.0, 0.33, 0.67)));
}
vec3 mandala(vec2 uv) {
  vec2 p = (uv - vec2(0.32, 0.51)) * vec2(uResolution.x / uResolution.y, 1.0);
  float t = uReducedMotion > 0.5 ? 2.0 : uTime * 0.3;
  float r = length(p);
  float a = atan(p.y, p.x) + t * 0.3;
  float petals = sin(a * 8.0 + sin(r * 9.0 - t) * 1.3);
  float lace = exp(-abs(sin(r * 23.0 + petals * 2.0 - t * 2.0)) * 30.0);
  float rays = pow(abs(cos(a * 12.0 - r * 7.0 + t)), 30.0);
  float halo = exp(-abs(r - 0.29 - petals * 0.025) * 95.0);
  float petalGlow = pow(0.5 + 0.5 * cos(a * 8.0 + r * 6.0 - t * 1.2), 8.0) * exp(-abs(r - 0.3) * 9.0);
  float field = exp(-r * 1.5) * (lace * 0.9 + rays * 0.3 + halo * 1.3 + petalGlow * 0.8);
  return spectrum(r * 1.6 + a * 0.16 - t * 0.12) * field + vec3(0.025, 0.005, 0.055);
}
vec3 bright(vec2 uv) {
  vec3 c = texture2D(tDiffuse, uv).rgb;
  return c * smoothstep(0.25, 0.75, max(c.r, max(c.g, c.b)));
}
void main() {
  vec2 centered = vUv - 0.5;
  float r2 = dot(centered, centered);
  vec2 uv = vUv + centered * r2 * 0.08 * uCrt;
  float damage = uReducedMotion > 0.5 ? 0.0 : uDamageIntensity;
  vec2 separation = centered * (0.001 + damage * 0.012) * uCrt;
  vec3 col = vec3(texture2D(tDiffuse, uv + separation).r,
    texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - separation).b);
  if (uCrt > 0.5) {
    vec2 px = 2.5 / uResolution;
    vec3 bloom = bright(uv + vec2(px.x, 0.0)) + bright(uv - vec2(px.x, 0.0))
      + bright(uv + vec2(0.0, px.y)) + bright(uv - vec2(0.0, px.y));
    col += bloom * 0.16;
  }
  if (uTitle > 0.5) col += mandala(vUv);
  float scanline = 1.0 - 0.15 * step(1.0, mod(gl_FragCoord.y, 2.0));
  col *= mix(1.0, scanline * (1.0 + uMidEnergy * 0.035), uCrt);
  col *= mix(1.0, 1.0 - r2 * r2 * 2.0, uCrt);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
}
