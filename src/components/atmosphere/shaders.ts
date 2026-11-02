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
   - under the pointer, `uLens` / `uLensR` / `uLensOn` open a loupe. A printer's
     magnifier reveals the print instead of washing it: inside the glass the ink
     is denser (the reading-column budget is deliberately relaxed under the
     lens), the ordered screen is a full 3-device-pixel cell, the contour prints
     a second time 2.4 px out of register, and the glass is bounded by a hard
     crimson rim, one 1 px inner highlight and a measuring reticle (one circle at
     0.62 R plus eight ticks at 45°). At `uLensOn = 0` every added term is
     exactly zero — the frame is the phase-A frame, pixel for pixel.

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
  uniform float uDpr;
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

  /* The sheet's height at a warped position. Factored out because the loupe
     samples it a second time, 2.4 px out of register. */
  float landformAt(vec2 p, vec2 drift) {
    vec2 warp = vec2(
      fbm2(p * 0.46 + drift) - 0.42,
      fbm2(p * 0.46 + drift + vec2(13.1, 7.4)) - 0.42
    );
    return fbm3(p * 0.40 + warp * 1.9 + drift * 0.55);
  }

  void main() {
    vec2 s = (vUv - 0.5) * vec2(uAspect, 1.0);

    /* One device pixel in UV, needed by the loupe's screen and safe to take
       here: a derivative inside the per-pixel branch below would be undefined
       where the glass edge cuts a warp. cssPx is the same unit in CSS pixels,
       so the rim, highlight and reticle keep their stated widths at any DPR. */
    vec2 texel = fwidth(vUv);
    float cssPx = max(texel.y * uDpr, 1.0e-6);

    /* 1. The lens. s · (1 + bend·r²) samples further out at the edges, so the
          middle of the plate magnifies — the bend a sheet takes when it is
          thrown, not a wobble. A plate change presses it further. */
    float bend = clamp(uBend + uPulse * 0.75, -1.6, 1.6);

    /* The sheet is never still: a drift that takes a few seconds to walk one
       contour line past a fixed point. */
    vec2 drift = vec2(uTime * 0.0130, uTime * -0.0082);

    /* 2/3. Domain warp, then contours and the index contour every fifth level.
            uCoarse spreads the hairline before the screen breaks it: ink under
            pressure is wider, then it is not there. */
    vec2 p = s * (1.0 + bend * 0.30 * dot(s, s)) * 2.35;
    float field = landformAt(p, drift);

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

    /* 5. The loupe. The aperture is eased in scene.ts; every term below is
          multiplied by it, so a closed loupe is exactly the phase-A print. */
    float lensOn = clamp(uLensOn, 0.0, 1.0);
    float ring = 0.0;
    float disc = 0.0;
    float rim = 0.0;
    float reticle = 0.0;
    float tick = 0.0;
    float highlight = 0.0;

    if (lensOn > 0.0) {
      vec2 q = (vUv - uLens) * vec2(uAspect, 1.0);
      float d = length(q);

      /* 1. The falloff, 1 at the centre and 0 at the glass edge. */
      ring = (1.0 - smoothstep(uLensR * 0.72, uLensR, d)) * lensOn;

      /* The same aperture with the hard edge the screen needs: a lens does not
         crossfade its image, it is bounded. */
      disc = (1.0 - smoothstep(uLensR * 0.94, uLensR, d)) * lensOn;

      /* Increment 1 — ink density. The plate inside the glass is printed
         heavier: 2.3× the contour term, clamped. This is the whole reason a
         loupe exists — the outside ink is deliberately faint, and magnifying a
         faint mark only makes a larger faint mark. The reading-column budget
         is relaxed by the same factor below, and only under the glass. */
      float dens = mix(1.0, 2.3, ring);
      ink = clamp(ink * dens, 0.0, 1.0);

      /* Increment 2 — the second impression. One more sample of the same
         contour field, 2.4 device pixels off, added at 85 %. A misregistered
         plate doubles the hairline; it does not smear it, because the second
         impression is a full-width contour and not a blurred copy. */
      vec2 off = vec2(0.78, 0.63) * texel * 2.4;
      vec2 sB = (vUv + off - 0.5) * vec2(uAspect, 1.0);
      vec2 pB = sB * (1.0 + bend * 0.30 * dot(sB, sB)) * 2.35;
      float fieldB = landformAt(pB, drift);
      float gB = fieldB * 31.0;
      float lineB = 1.0 - smoothstep(wLine * 0.16, wLine * 0.62, abs(fract(gB + 0.5) - 0.5));
      float giB = gB * 0.2;
      float indexB = 1.0 - smoothstep(wIndex * 0.24, wIndex * 0.80, abs(fract(giB + 0.5) - 0.5));
      float inkB = (lineB * 0.55 + indexB) * density;
      ink = clamp(ink + inkB * dens * 0.85, 0.0, 1.0);

      /* Increment 4 — the rim is a lens edge, not a halo. 1.5 CSS px of --mark
         at 0.8, transferred over 0.02 R at most: hard enough to read as the
         cut edge of glass at 100 %, with no wash across the disc.

         The coverage is analytic rather than a smoothstep on the distance: a
         1.5 px band sampled at 1 px can miss whole fragments, which is what
         made the first pass a dashed line. A box filter over one device pixel
         keeps the edge hard and the ring continuous at any DPR. */
      float rimHalf = 0.75 * cssPx;
      float rimEdge = abs(d - uLensR);
      float rimCov = clamp((rimHalf - rimEdge) / max(texel.y, 1.0e-6) + 0.5, 0.0, 1.0);
      rim = rimCov * lensOn * 0.8;

      /* One CSS pixel of white at 4 % just inside the edge: the light that
         catches the bevel. It is a highlight, never a fill. */
      float hiEdge = abs(d - (uLensR - 2.0 * cssPx));
      float hiCov = clamp((0.5 * cssPx - hiEdge) / max(texel.y, 1.0e-6) + 0.5, 0.0, 1.0);
      highlight = hiCov * lensOn * 0.04;

      /* Increment 5 — the measuring reticle. One hairline circle at 0.62 R and
         eight 2 px ticks on the inner edge at 45° steps, all --mark at 0.28.
         This is the difference between a printer's loupe and a browser
         magnifier; it is quiet enough to sit under the ink. */
      float circleEdge = abs(d - uLensR * 0.62);
      float circleCov = clamp((0.5 * cssPx - circleEdge) / max(texel.y, 1.0e-6) + 0.5, 0.0, 1.0);
      reticle = circleCov * lensOn * 0.28;

      float sector = abs(mod(atan(q.y, q.x) + 0.3926991, 0.7853982) - 0.3926991);
      float lateral = sector * max(d, 1.0e-5);
      float tickWidth = clamp((0.5 * cssPx - lateral) / max(texel.y, 1.0e-6) + 0.5, 0.0, 1.0);
      float tickIn = clamp((d - (uLensR - 3.0 * cssPx)) / max(texel.y, 1.0e-6) + 0.5, 0.0, 1.0);
      float tickOut = clamp(((uLensR - 0.75 * cssPx) - d) / max(texel.y, 1.0e-6) + 0.5, 0.0, 1.0);
      tick = tickWidth * tickIn * tickOut * lensOn * 0.28;
    }

    /* 6. The screen. Six levels of ink through the 8 × 8 matrix, on cells that
          grow with the throw — one device pixel at rest, three at the top — so
          the halftone itself becomes the thing you can see. The grain is fixed
          in screen space and quantised to the same cell, so it reads as paper
          tooth and not as video.

          Inside the glass the cell reaches three device pixels and the ladder
          drops from six printed levels to three: the same ink is carried by
          3 px dots and the empty cells between them, so a contour is read as a
          halftone, not as a smooth darkening. It can only remove ink, never
          add it, so the relaxed density above is untouched. */
    vec2 cell = floor(gl_FragCoord.xy / (1.0 + 2.0 * clamp(uCoarse + disc, 0.0, 1.0)));
    float b = bayer8(cell);

    ink *= mix(1.0, 0.45 + 0.55 * smoothstep(0.22, 0.62, b), smoothstep(0.45, 1.0, uCoarse));

    float levels = mix(6.0, 3.0, ring);
    float v = clamp(ink, 0.0, 1.0) * levels;
    // The grain is screen-space paper tooth; on a 3 px cell a full-strength
    // tooth reads as frost over the glass, so the loupe damps it and leaves the
    // print alone. At rest the multiplier is exactly 1.
    v += (hash12(cell) - 0.5) * 0.55 * (1.0 - 0.85 * disc);

    float level = (floor(max(v, 0.0)) + step(b, fract(v))) / levels;

    /* Blank paper stays blank: no scattered dots where the field is empty.
       The clamp is the contrast budget outside the glass; under the glass the
       budget is raised by the same 2.3× as the ink, and never above. */
    level = clamp(level * step(0.015, v), 0.0, 1.0);

    float budget = uBudget * mix(1.0, 2.3, ring);
    vec4 plate = vec4(uInk, level * budget);

    /* The marks are furniture on the plate, not ink over the reading column:
       they carry their own alpha instead of the print's ladder. */
    float markA = max(rim, max(reticle, tick));
    if (markA > 0.0) {
      float a = markA + plate.a * (1.0 - markA);
      vec3 rgb = (uMark * markA + plate.rgb * plate.a * (1.0 - markA)) / max(a, 1.0e-4);
      plate = vec4(rgb, a);
    }

    /* The bevel. White at four per cent, composited over the print. */
    if (highlight > 0.0) {
      float a = highlight + plate.a * (1.0 - highlight);
      vec3 rgb = (vec3(1.0) * highlight + plate.rgb * plate.a * (1.0 - highlight)) / max(a, 1.0e-4);
      plate = vec4(rgb, a);
    }

    gl_FragColor = plate;
  }
`
