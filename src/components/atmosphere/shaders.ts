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

   And two material properties:

   - driven by `uCoarse` (the damped scroll throw), the print coarsens. The
     screen's cell grows from one device pixel to three, the hairlines spread,
     and at the top of the range the ink is kept only where the screen prints —
     so the contours break into a chain of dots. The sheet is being dragged under
     the lamp, not glitched: no split channels, no random noise, one program, one
     branchless path.
   - under the pointer, `uLens` / `uLensR` / `uLensOn` open a loupe: the screen's
     cell grows again (never past three device pixels), the contour field is
     sampled a second time a hair to the side so the line doubles, and the rim of
     the glass takes the survey crimson at 35 % on that doubled line. It can only
     add a second impression, never more ink per pixel: the `uBudget` clamp at the
     foot of the shader still owns the reading column's contrast.

   Everything is analytic and allocation-free: six uniforms change per frame
   and the pixel cost is eight value-noise samples — four for the warp, three
   for the landform, one for the inked patches — plus a second landform sample
   only inside the loupe.
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
  uniform float uCoarse;
  uniform float uBudget;
  uniform vec3 uInk;
  uniform vec2 uLens;
  uniform float uLensR;
  uniform float uLensOn;
  uniform vec3 uMark;

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

    /* 3. Contours, and the index contour every fifth level. uCoarse spreads
          the hairline before the screen breaks it: ink under pressure is wider,
          then it is not there. */
    float spread = 1.0 + 2.2 * uCoarse;
    float g = field * 31.0;
    float wLine = max(fwidth(g), 1.0e-5) * spread;
    float line = 1.0 - smoothstep(wLine * 0.16, wLine * 0.62, abs(fract(g + 0.5) - 0.5));

    float gi = g * 0.2;
    float wIndex = max(fwidth(gi), 1.0e-5) * spread;
    float index = 1.0 - smoothstep(wIndex * 0.24, wIndex * 0.80, abs(fract(gi + 0.5) - 0.5));

    float ink = line * 0.55 + index * 1.0;

    /* 4. Not every part of the plate is inked, and the type is the figure. */
    float cover = valueNoise(p * 0.13 + vec2(11.3, 3.1));
    float density = mix(0.16, 1.0, smoothstep(0.26, 0.62, cover));

    float reach = length(s * vec2(0.78, 1.0));
    density *= mix(0.55, 1.0, smoothstep(0.02, 0.72, reach));

    ink *= density;

    /* 5. The loupe. Under the pointer the glass sits on the sheet: the screen's
          cell grows, and the contour is printed a hair out of register, so one
          hairline becomes two. The second sample is only taken inside the glass
          (outside it ring is exactly zero, so the branch is coherent for most
          of the sheet), and it reuses the first sample's line widths — a
          derivative inside a per-pixel branch would be undefined where the
          glass edge cuts a warp.

          ring already carries uLensOn, so a closed loupe changes nothing:
          at zero every term below collapses to the original print. The rim
          takes uMark — 35 % on the doubled line, and the glass edge's own
          share under it — while the alpha is never touched: the loupe can
          reveal a coarser screen, never a darker reading column. */
    float d = length((vUv - uLens) * vec2(uAspect, 1.0));
    // Reversed edges are undefined in GLSL, so the ring is written as its
    // complement: 1 inside 0.72 · r, 0 outside r.
    float ring = (1.0 - smoothstep(uLensR * 0.72, uLensR, d)) * uLensOn;
    float markMix = 0.0;
    float rimMix = 0.0;

    if (ring > 0.001) {
      vec2 lensUv = vUv + vec2(0.0016, 0.0007) * ring;
      vec2 s2 = (lensUv - 0.5) * vec2(uAspect, 1.0);
      vec2 p2 = s2 * (1.0 + bend * 0.30 * dot(s2, s2)) * 2.35;

      vec2 warp2 = vec2(
        fbm2(p2 * 0.46 + drift) - 0.42,
        fbm2(p2 * 0.46 + drift + vec2(13.1, 7.4)) - 0.42
      );
      float field2 = fbm3(p2 * 0.40 + warp2 * 1.9 + drift * 0.55);

      float g2 = field2 * 31.0;
      float line2 = 1.0 - smoothstep(wLine * 0.16, wLine * 0.62, abs(fract(g2 + 0.5) - 0.5));

      float gi2 = g2 * 0.2;
      float index2 = 1.0 - smoothstep(wIndex * 0.24, wIndex * 0.80, abs(fract(gi2 + 0.5) - 0.5));

      float ink2 = (line2 * 0.55 + index2) * density;

      // The second impression joins the first; max keeps a crossing from
      // printing darker than either line.
      ink = max(ink, ink2 * ring);

      // One ring of crimson where the glass edge passes. A band, not the disc:
      // the tint rides on whatever the screen prints there, so the circle is
      // broken by the same dots as the rest of the plate and never becomes a
      // vector outline laid over the paper.
      float rim =
        smoothstep(uLensR * 0.88, uLensR * 0.91, d) *
        (1.0 - smoothstep(uLensR * 0.95, uLensR * 0.98, d));
      rimMix = rim * uLensOn;
      // The doubled line takes the mark at 35 %...
      markMix = rimMix * 0.35;

      /* A ring that exists only where a contour happens to cross the rim is
         not a rim. The glass edge lays a band of its own, at the same alpha
         ceiling as any other ink, and the screen breaks it into the same dots
         as the rest of the plate: a printed circle, not a vector overlay. */
      ink = max(ink, rimMix);
    }

    /* 6. The screen. Six levels of ink through the 8 × 8 matrix, on cells that
          grow with the throw — one device pixel at rest, three at the top — so
          the halftone itself becomes the thing you can see. The grain is fixed
          in screen space and quantised to the same cell, so it reads as paper
          tooth and not as video.

          The tear: at the top of the throw the ink is kept only on the cells the
          screen prints, which turns a widened hairline into a chain of dots
          instead of a bar. It can only remove ink, so the contrast budget — the
          alpha clamp at the foot of this shader — is never approached from
          above.

          The loupe adds its own coarsening to the same term, capped with the
          throw at three device pixels. */
    vec2 cell = floor(gl_FragCoord.xy / (1.0 + 2.0 * clamp(uCoarse + ring, 0.0, 1.0)));
    float b = bayer8(cell);

    ink *= mix(1.0, 0.45 + 0.55 * smoothstep(0.22, 0.62, b), smoothstep(0.45, 1.0, uCoarse));

    float v = clamp(ink, 0.0, 1.0) * 6.0;
    v += (hash12(cell) - 0.5) * 0.55;

    float level = (floor(max(v, 0.0)) + step(b, fract(v))) / 6.0;

    /* Blank paper stays blank: no scattered dots where the field is empty.
       The clamp is the contrast budget: the grain can push one level past the
       top of the ladder, and the layer must never write more ink than stated. */
    level = clamp(level * step(0.015, v), 0.0, 1.0);

    /* ...and the glass edge itself carries the rest of the mark. At 35 % of a
       5.6 % ink the ring is a grey smudge rather than a crimson one; the
       remaining 65 % is what makes the rim read as one ring. The alpha below is
       untouched, so the reading column's contrast is exactly what it was. */
    vec3 tone = mix(uInk, uMark, markMix);
    tone = mix(tone, uMark, rimMix * 0.65);

    gl_FragColor = vec4(tone, level * uBudget);
  }
`
