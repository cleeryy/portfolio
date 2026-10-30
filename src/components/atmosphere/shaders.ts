/* ============================================================================
   The atmosphere shaders
   ----------------------------------------------------------------------------
   One fullscreen triangle, one program, one draw call. The fragment shader is
   the whole sheet: a domain-warped height field, ruled into hairlines, thinned
   where the type lives, and printed through an 8 × 8 ordered screen.

   Composition, top to bottom:

   1. a lens — the scroll velocity barrels the field outward from the centre of
      the viewport and the damping settles it back; at rest the lens is open;
   2. domain warp — two fbm samples push a third, so the contours meander like
      a surveyed landform instead of running parallel;
   3. contours — one hairline per level, one heavier line every fifth level (the
      index contour a real topographic sheet uses). Widths come from `fwidth`,
      so a line is ~1 device pixel at any resolution;
   4. density — slow patches of blank paper, and a thinning toward the middle of
      the sheet, where the reading happens;
   5. the screen — the ink is quantised to six printed levels through the Bayer
      matrix, plus a static per-pixel grain so the falloff breaks into dots.

   Everything is analytic and allocation-free: three uniforms change per frame
   and the pixel cost is eight value-noise samples — four for the warp, three
   for the landform, one for the inked patches.
   ========================================================================== */

export const ATMOSPHERE_VERT = /* glsl */ `
  varying vec2 vUv;

  void main() {
    // The geometry is a single oversized triangle in clip space; no matrices.
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export const ATMOSPHERE_FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform float uBend;
  uniform float uPulse;
  uniform float uBudget;
  uniform vec3 uInk;

  varying vec2 vUv;

  /* ------------------------------------------------------------------------
     Ordered dither: 8 × 8, the recursive construction, run on device pixels.
     m8 = 16·lo + 4·mid + hi is the same arithmetic as bayer.ts.
     ---------------------------------------------------------------------- */
  float bayerSeed(vec2 a) {
    return mod(2.0 * a.x + 3.0 * a.y, 4.0);
  }

  float bayer8(vec2 fragCoord) {
    vec2 p = floor(fragCoord);
    float lo = bayerSeed(mod(p, 2.0));
    float mid = bayerSeed(mod(floor(p * 0.5), 2.0));
    float hi = bayerSeed(mod(floor(p * 0.25), 2.0));
    return (16.0 * lo + 4.0 * mid + hi) / 64.0;
  }

  /* ------------------------------------------------------------------------
     Value noise. Cheap hash, smoothstep interpolation, three octaves: enough
     for a landform, not enough to cost a millisecond.
     ---------------------------------------------------------------------- */
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  /* Two octaves. The warp only carries the large shapes; spending a third
     octave there would double the cost of a term nobody can see. */
  float fbm2(vec2 p) {
    return 0.55 * valueNoise(p) + 0.26 * valueNoise(p * 2.07 + vec2(3.1, 7.7));
  }

  /* Three octaves, for the landform itself. */
  float fbm3(vec2 p) {
    float v = 0.55 * valueNoise(p);
    v += 0.26 * valueNoise(p * 2.03 + vec2(1.7, 9.2));
    v += 0.13 * valueNoise(p * 4.11 + vec2(6.3, 2.9));
    return v;
  }

  void main() {
    vec2 s = (vUv - 0.5) * vec2(uAspect, 1.0);

    /* 1. The lens. s · (1 + bend·r²) samples further out at the edges, so the
          middle of the plate magnifies — the bend a sheet takes when it is
          thrown, not a wobble. A plate change presses it further. */
    float bend = clamp(uBend + uPulse * 0.75, -1.6, 1.6);
    vec2 p = s * (1.0 + bend * 0.30 * dot(s, s)) * 2.35;

    /* The sheet is never still: a drift that takes a few seconds to walk one
       contour line past a fixed point. */
    vec2 drift = vec2(uTime * 0.0130, uTime * -0.0082);

    /* 2. Domain warp. */
    vec2 warp = vec2(
      fbm2(p * 0.46 + drift) - 0.42,
      fbm2(p * 0.46 + drift + vec2(13.1, 7.4)) - 0.42
    );
    float field = fbm3(p * 0.40 + warp * 1.9 + drift * 0.55);

    /* 3. Contours, and the index contour every fifth level. */
    float g = field * 31.0;
    float wLine = max(fwidth(g), 1.0e-5);
    float line = 1.0 - smoothstep(wLine * 0.16, wLine * 0.62, abs(fract(g + 0.5) - 0.5));

    float gi = g * 0.2;
    float wIndex = max(fwidth(gi), 1.0e-5);
    float index = 1.0 - smoothstep(wIndex * 0.24, wIndex * 0.80, abs(fract(gi + 0.5) - 0.5));

    float ink = line * 0.55 + index * 1.0;

    /* 4. Not every part of the plate is inked, and the type is the figure. */
    float cover = valueNoise(p * 0.13 + vec2(11.3, 3.1));
    ink *= mix(0.16, 1.0, smoothstep(0.26, 0.62, cover));

    float reach = length(s * vec2(0.78, 1.0));
    ink *= mix(0.55, 1.0, smoothstep(0.02, 0.72, reach));

    /* 5. The screen. Six levels of ink through the 8 × 8 matrix; the grain is
          fixed in screen space, so it reads as paper tooth and not as video. */
    float v = clamp(ink, 0.0, 1.0) * 6.0;
    v += (hash12(gl_FragCoord.xy) - 0.5) * 0.55;

    float b = bayer8(gl_FragCoord.xy);
    float level = (floor(max(v, 0.0)) + step(b, fract(v))) / 6.0;

    /* Blank paper stays blank: no scattered dots where the field is empty.
       The clamp is the contrast budget: the grain can push one level past the
       top of the ladder, and the layer must never write more ink than stated. */
    level = clamp(level * step(0.015, v), 0.0, 1.0);

    gl_FragColor = vec4(uInk, level * uBudget);
  }
`
