/* ============================================================================
   The passage's shaders — one instanced quad layer, no post-processing
   ----------------------------------------------------------------------------
   The whole drawing is a field of label plates receding along −z. Each instance
   crops its own rectangle of the atlas, so a plate keeps the drawn aspect of the
   string it carries and a four-letter name is not stretched to fit a square.

   Three decisions, in the sheet's own language:

   1. **The atlas is a mask, not a picture.** White type on nothing, sampled for
      its alpha and thresholded. One texture therefore prints on paper and on
      ink: the ink is a uniform, and it lerps from `--ink` to `--deep` as the
      plate rises, so the labels are absorbed rather than inverted.

   2. **Distance is coverage, never alpha.** A far plate does not fade — it is
      printed through the 8 × 8 ordered screen with a lower coverage, so it
      breaks into the same dots the atmosphere's contours break into. The cell is
      two device pixels: a real screen at reading size, not a noise field. Near
      plates keep coverage 1, so they stay crisp ink: nothing here is blurred.

   3. **The lens is a dissolve.** A plate passing the camera loses coverage on
      the way out, so it leaves as dots instead of vanishing at the near plane.
      That is the whole depth-of-field: no second pass, no mip bias, one fetch.

   4. **The type is a clearing.** `uClear` is the cartouche's box. A plate whose
      own rectangle reaches it is faded *whole* — in the vertex shader, from the
      instance's projected centre and half-extent — so the field parts around
      the words instead of being cut through a letter. A per-pixel pass inside
      the box remains as the guarantee: nothing ever prints under the copy, even
      a plate too large for its centre to be caught. The sheet's rule is that
      the figure is the type; the field gives way to it.

   The screen is static in screen space — the same choice the atmosphere makes.
   A moving label therefore travels *through* the grain of the paper rather than
   carrying its own noise, which is what print does.
   ========================================================================== */

export const FLIGHT_VERT = /* glsl */ `
  // Per instance: the atlas rectangle this plate crops, and its tone.
  attribute vec4 aUv;
  attribute float aTone;

  /* The cartouche's clearing, in device pixels (see FLIGHT_FRAG). */
  uniform vec2 uResolution;
  uniform vec4 uClear;
  uniform float uClearFeather;

  varying vec2 vUv;
  varying float vDepth;
  varying float vTone;
  varying float vClear;

  void main() {
    // The plane is a unit quad; the atlas crop is applied here rather than baked
    // into a texture, so one 1024 texture holds forty differently-shaped labels.
    vUv = mix(aUv.xy, aUv.zw, uv);

    // Instancing is applied to the vertex, then the camera: the field never
    // moves, only the eye does.
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);

    vDepth = -mv.z;
    vTone = aTone;

    /* Does this plate's own rectangle reach the copy? Measured once per
       instance from its projected centre and half-extent, so the answer fades
       the whole label rather than erasing a letter at a time. */
    vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 corner = modelViewMatrix * instanceMatrix * vec4(0.5, 0.5, 0.0, 1.0);
    vec4 centreClip = projectionMatrix * centre;
    vec4 cornerClip = projectionMatrix * corner;
    vec2 centreScreen = (centreClip.xy / centreClip.w * 0.5 + 0.5) * uResolution;
    vec2 cornerScreen = (cornerClip.xy / cornerClip.w * 0.5 + 0.5) * uResolution;
    vec2 halfExtent = abs(cornerScreen - centreScreen);
    vec2 fromBox = abs(centreScreen - uClear.xy) - (uClear.zw + halfExtent);
    float gap = length(max(fromBox, 0.0)) + min(max(fromBox.x, fromBox.y), 0.0);
    vClear = smoothstep(0.0, uClearFeather, gap);

    gl_Position = projectionMatrix * mv;
  }
`

export const FLIGHT_FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D uAtlas;
  uniform vec3 uInk;
  uniform float uCover;
  /* Where a plate starts losing coverage because it is far away, and the hard
     cut. Uniforms rather than constants because the phone is given a shorter
     field (see FlightScene): the density in the readable band must match, and
     a recycle must never happen inside the visible band. */
  uniform vec2 uFar;
  uniform vec2 uGone;
  /* The cartouche's box: centre and half-size in device pixels, y up. */
  uniform vec4 uClear;
  uniform float uClearFeather;

  varying vec2 vUv;
  varying float vDepth;
  varying float vTone;
  varying float vClear;

  /* The same 8 × 8 matrix the sheet is printed through: the recursive
     construction, run on device pixels. m8 = 16·lo + 4·mid + hi. */
  float seed2(vec2 a) {
    return mod(2.0 * a.x + 3.0 * a.y, 4.0);
  }

  float bayer8(vec2 fragCoord) {
    vec2 p = floor(fragCoord);
    float lo = seed2(mod(p, 2.0));
    float mid = seed2(mod(floor(p * 0.5), 2.0));
    float hi = seed2(mod(floor(p * 0.25), 2.0));
    return (16.0 * lo + 4.0 * mid + hi) / 64.0;
  }

  void main() {
    // A hard glyph edge. The atlas is drawn antialiased; thresholding it here
    // keeps the type reading as printed ink at every size, and leaves the
    // dissolve to the screen — which is the only thing allowed to be soft.
    float glyph = texture2D(uAtlas, vUv).a;
    if (glyph < 0.5) discard;

    /* Coverage, from three independent jobs:

       - the near dissolve: a plate leaving past the lens gives up its dots
         between 1.4 and 4.8 units;
       - the far dissolve: uFar, softened per instance by its tone, so the field
         thins in a rhythm instead of a wall;
       - the hand-off: the whole field is taken back to a few dots as the plate
         rises, and uGone keeps nothing alive past the recycle line, so a
         generation never pops back into view. */
    float nearFade = smoothstep(1.4, 4.8, vDepth);
    float farFade = 1.0 - smoothstep(uFar.x, uFar.y, vDepth);
    float gone = 1.0 - smoothstep(uGone.x, uGone.y, vDepth);
    float cover = nearFade * mix(1.0, farFade, vTone) * gone * uCover;

    /* The clearing, two ways. vClear has already faded any plate whose
       rectangle reaches the copy, so what is left here is the guarantee: a
       rounded-rect distance field that takes coverage to zero inside the box.
       It only fires for a plate too large for its centre to have been caught —
       and then it is erasing ink nobody could read anyway. */
    vec2 rel = abs(gl_FragCoord.xy - uClear.xy) - uClear.zw;
    float outside = length(max(rel, 0.0)) + min(max(rel.x, rel.y), 0.0);
    float holding = 1.0 - smoothstep(-uClearFeather * 0.5, uClearFeather * 0.5, outside);
    cover *= vClear * mix(1.0, 0.0, holding);

    // Two device pixels per cell: at 1×1 the screen is finer than the type and
    // reads as grain; at 2×2 it reads as the halftone it is.
    vec2 cell = floor(gl_FragCoord.xy * 0.5);
    if (bayer8(cell) > cover) discard;

    gl_FragColor = vec4(uInk, 1.0);
  }
`
