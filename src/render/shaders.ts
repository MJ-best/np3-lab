/*
 * Approximate Flexible Color pipeline. This is NOT Nikon's processing — it is a
 * plausible model so recipes can be compared side by side. Order:
 * sharpening → clarity → tone (sliders or custom curve) → saturation →
 * colour blender (8 hue bands in OKLCh) → colour grading (3 luminance ranges).
 */

export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = (a_pos + 1.0) * 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_src;
uniform sampler2D u_blur;
uniform sampler2D u_lut;      // 257 x 1, R32F, 0..1
uniform int u_useCurve;
uniform vec2 u_texel;

uniform float u_sharp;        // sharpening / 9
uniform float u_midSharp;     // mid-range sharpening / 5
uniform float u_clarity;      // clarity / 5
uniform float u_contrast;     // -1..1
uniform float u_highlights;
uniform float u_shadows;
uniform float u_whites;
uniform float u_blacks;
uniform float u_saturation;

uniform vec3 u_blender[8];    // hue, chroma, brightness (-1..1) for R,O,Y,G,C,B,P,M
uniform vec3 u_grade[3];      // (unused), chroma, brightness for shadows, mid, highlights
uniform vec2 u_gradeDir[3];   // OKLab a/b direction of each grading hue
uniform float u_blending;     // 0..1
uniform float u_balance;      // -1..1

const float CENTERS[8] = float[8](29.0, 60.0, 105.0, 142.0, 195.0, 264.0, 295.0, 330.0);

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 toSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 linToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0); m = pow(max(m, 0.0), 1.0 / 3.0); s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 oklabToLin(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
   -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
   -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}

float lutAt(float x) {
  float f = clamp(x, 0.0, 1.0) * 256.0;
  int i = int(floor(f));
  int j = min(i + 1, 256);
  float t = f - float(i);
  return mix(texelFetch(u_lut, ivec2(i, 0), 0).r, texelFetch(u_lut, ivec2(j, 0), 0).r, t);
}

// Inverse of smoothstep: flattens contrast while keeping black and white fixed.
float invSmooth(float v) { v = clamp(v, 0.0, 1.0); return 0.5 - sin(asin(1.0 - 2.0 * v) / 3.0); }

vec3 sampleAvg(vec2 d) {
  return (texture(u_src, v_uv + vec2(d.x, 0.0)).rgb + texture(u_src, v_uv - vec2(d.x, 0.0)).rgb +
          texture(u_src, v_uv + vec2(0.0, d.y)).rgb + texture(u_src, v_uv - vec2(0.0, d.y)).rgb) * 0.25;
}

void main() {
  vec3 c = texture(u_src, v_uv).rgb;

  // Sharpening (fine detail) and mid-range sharpening (coarser detail).
  c += (c - sampleAvg(u_texel)) * u_sharp * 0.9;
  c += (c - sampleAvg(u_texel * 4.0)) * u_midSharp * 0.45;
  c = clamp(c, 0.0, 1.0);

  // Clarity: midtone local contrast against a heavily blurred copy.
  float L = luma(c);
  float Lb = luma(texture(u_blur, v_uv).rgb);
  float midW = 1.0 - pow(abs(2.0 * L - 1.0), 2.0);
  float Lc = clamp(L + (L - Lb) * u_clarity * 1.1 * midW, 0.0, 1.0);
  c = mix(c + (Lc - L), c * (Lc / max(L, 1e-4)), smoothstep(0.0, 0.08, L));

  if (u_useCurve == 1) {
    c = vec3(lutAt(c.r), lutAt(c.g), lutAt(c.b));
  } else {
    if (u_contrast >= 0.0) c = mix(c, smoothstep(0.0, 1.0, c), u_contrast);
    else c = mix(c, vec3(invSmooth(c.r), invSmooth(c.g), invSmooth(c.b)), -u_contrast * 0.85);
    float l = luma(c);
    float d = 0.0;
    d += u_highlights * 0.24 * smoothstep(0.45, 1.0, l);
    d += u_shadows * 0.20 * smoothstep(0.0, 0.10, l) * (1.0 - smoothstep(0.10, 0.55, l));
    d += u_whites * 0.14 * smoothstep(0.60, 1.0, l);
    d += u_blacks * 0.10 * (1.0 - smoothstep(0.0, 0.35, l));
    float l2 = clamp(l + d, 0.0, 1.0);
    c = mix(c + (l2 - l), c * (l2 / max(l, 1e-4)), smoothstep(0.0, 0.10, l));
  }
  c = clamp(c, 0.0, 1.0);

  vec3 lab = linToOklab(toLinear(c));
  float C = length(lab.yz);
  float hue = degrees(atan(lab.z, lab.y));
  if (hue < 0.0) hue += 360.0;

  C *= max(0.0, 1.0 + u_saturation);

  // Colour blender: interpolate the two neighbouring bands (tent weights sum to 1).
  vec3 adj = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    int j = (i + 1) % 8;
    float span = mod(CENTERS[j] - CENTERS[i] + 360.0, 360.0);
    float t = mod(hue - CENTERS[i] + 360.0, 360.0) / span;
    if (t <= 1.0) { adj = mix(u_blender[i], u_blender[j], t); break; }
  }
  float colorful = smoothstep(0.01, 0.07, C);
  hue += adj.x * 25.0 * colorful;
  C *= 1.0 + adj.y * (adj.y > 0.0 ? 0.7 : 1.0) * colorful;
  lab.x += adj.z * 0.12 * colorful;
  lab.yz = max(C, 0.0) * vec2(cos(radians(hue)), sin(radians(hue)));

  // Colour grading: split the image into shadows / midtones / highlights.
  float bw = 0.05 + u_blending * 0.25;
  float s1 = 0.36 + u_balance * 0.15;
  float s2 = 0.70 + u_balance * 0.15;
  float wS = 1.0 - smoothstep(s1 - bw, s1 + bw, lab.x);
  float wH = smoothstep(s2 - bw, s2 + bw, lab.x);
  float wM = clamp(1.0 - wS - wH, 0.0, 1.0);
  float w[3] = float[3](wS, wM, wH);
  for (int k = 0; k < 3; k++) {
    lab.yz += u_gradeDir[k] * u_grade[k].y * 0.06 * w[k];
    lab.x += u_grade[k].z * 0.10 * w[k];
  }

  outColor = vec4(clamp(toSrgb(oklabToLin(lab)), 0.0, 1.0), 1.0);
}`;
