/* ============================================================================
   contour.ts — the atmosphere's landform, baked once and drifted
   ----------------------------------------------------------------------------
   The plate carries the same engraved field the rest of the sheet is printed
   on: the domain-warped height field of `components/atmosphere/shaders.ts`,
   ruled into contour bands. It is not a second artwork and it is not noise
   sampled from an image — the sheet is generated here, from the analytic
   function, once per plate.

   Why it is a texture and not per-cell shader maths: four field samples per
   cell in the vertex shader cost twenty-eight noise evaluations per instance —
   fine on a discrete GPU, six frames a second under software rendering. The
   field is a *slow* material; it does not need to be re-evaluated every frame.
   So it is baked at 64 × 40 once (about 5ms at mount, on the test machine),
   stored as a tangent + coverage map, and sampled with a slow drift. One
   texture read replaces twenty-eight noise evaluations, and the drift is a real
   movement of the whole engraving rather than a per-cell flicker.

   The map's three channels: R/G are the contour tangent (−1..1 mapped to
   0..1), B is the band coverage. The shader uses the tangent to set the glyph
   *along* the line — that is the whole difference between an engraved field and
   a dirty scan — and the coverage to choose the mark and its ink.

   The field is a canvas material, not part of the topology: the `<pre>` fallback
   prints the stations and the links, because one ink cannot carry both the
   drawing and the atmosphere. The topology is what the fallback has to be
   honest about.

   The plate prints the *index* contours only (every fifth level, the line a
   topographic sheet draws heavier). At cell resolution all thirty-one levels
   are a wallpaper; the fifth is a surveyed field.
   ========================================================================== */

export const CONTOUR = {
  scale: 2.35,
  warpFreq: 0.46,
  fieldFreq: 0.4,
  warpAmp: 1.9,
  levels: 31,
  /** Every fifth level: the index contour. */
  indexEvery: 0.2,
  gateFreq: 0.13,
  gateX: 11.3,
  gateY: 3.1,
  /** The band's own thresholds, in index units. */
  bandLow: 0.012,
  bandHigh: 0.055,
  /** Patches of blank sheet, so the contour is surveyed, not wallpapered. */
  gateLow: 0.38,
  gateHigh: 0.62,
  /** Fractional offsets of the four samples inside a texel. */
  sample: 0.25,
  /** A cell the band only clips is a tick, not a line. */
  stippleBelow: 0.45,
  /** Below this the cell is paper. */
  contourLow: 0.25,
  /**
   * A contour's ink, against the network's 0.68–1. The atmosphere's own budget
   * is 5.6%; a character needs a little more than a hairline to be seen, but not
   * much more, or the field becomes a second drawing.
   */
  alphaStipple: 0.1,
  alphaLine: 0.12,
  /**
   * The drift, as a UV shift around the bake. A Lissajous of two very slow
   * periods: the engraving breathes rather than slides, and it never runs off
   * the sheet or repeats a seam.
   */
  driftAmpX: 0.02,
  driftAmpY: 0.012,
  driftRateX: 0.045,
  driftRateY: 0.037,
} as const

/** The baked field: RGBA8, row-major, top row first. */
export type ContourField = { width: number; height: number; data: Uint8Array }

const fract = (v: number) => v - Math.floor(v)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** hash12 of shaders.ts, with the vec3 construction kept intact. */
function hash12(x: number, y: number): number {
  const c = 0.1031
  const a = fract(x * c)
  const b = fract(y * c)
  const z = a
  const d = a * (b + 33.33) + b * (z + 33.33) + z * (a + 33.33)
  const ax = a + d
  const by = b + d
  const bz = z + d
  return fract((ax + by) * bz)
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)

  const a = hash12(ix, iy)
  const b = hash12(ix + 1, iy)
  const c = hash12(ix, iy + 1)
  const d = hash12(ix + 1, iy + 1)

  return mix(mix(a, b, ux), mix(c, d, ux), uy)
}

function fbm2(x: number, y: number): number {
  return 0.55 * valueNoise(x, y) + 0.26 * valueNoise(x * 2.07 + 3.1, y * 2.07 + 7.7)
}

function fbm3(x: number, y: number): number {
  return (
    0.55 * valueNoise(x, y) +
    0.26 * valueNoise(x * 2.03 + 1.7, y * 2.03 + 9.2) +
    0.13 * valueNoise(x * 4.11 + 6.3, y * 4.11 + 2.9)
  )
}

/** The field at one point: its index coordinate `g` and the paper gate. */
function fieldAt(
  ux: number,
  uy: number,
  aspect: number,
): { g: number; gate: number } {
  const sx = (ux - 0.5) * aspect
  const sy = uy - 0.5
  const px = sx * CONTOUR.scale
  const py = sy * CONTOUR.scale

  // The bake is at t = 0; the drift is applied by the shader.
  const wx = fbm2(px * CONTOUR.warpFreq, py * CONTOUR.warpFreq) - 0.42
  const wy =
    fbm2(px * CONTOUR.warpFreq + 13.1, py * CONTOUR.warpFreq + 7.4) - 0.42

  const field = fbm3(
    px * CONTOUR.fieldFreq + wx * CONTOUR.warpAmp,
    py * CONTOUR.fieldFreq + wy * CONTOUR.warpAmp,
  )

  return {
    g: field * CONTOUR.levels * CONTOUR.indexEvery,
    gate: valueNoise(
      px * CONTOUR.gateFreq + CONTOUR.gateX,
      py * CONTOUR.gateFreq + CONTOUR.gateY,
    ),
  }
}

function bandInk(g: number, gate: number): number {
  const d = Math.abs(fract(g + 0.5) - 0.5)
  const line = 1 - smoothstep(CONTOUR.bandLow, CONTOUR.bandHigh, d)
  return line * smoothstep(CONTOUR.gateLow, CONTOUR.gateHigh, gate)
}

const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255)

/**
 * Bake the field. The resolution is deliberately below the character grid: the
 * field is a soft engraving, and a bilinear read of a 64 × 40 sheet is all the
 * detail a 110 × 64 character plate can use. The cost is one pass over 2560
 * texels at mount (about 5ms on the test machine), never per frame.
 */
export function buildContourField(
  cols: number,
  rows: number,
  width = 64,
  height = 40,
): ContourField {
  const aspect = cols / rows
  const data = new Uint8Array(width * height * 4)
  const ox = CONTOUR.sample / width
  const oy = CONTOUR.sample / height

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ux = (x + 0.5) / width
      const uy = (y + 0.5) / height

      const s00 = fieldAt(ux - ox, uy - oy, aspect)
      const s10 = fieldAt(ux + ox, uy - oy, aspect)
      const s01 = fieldAt(ux - ox, uy + oy, aspect)
      const s11 = fieldAt(ux + ox, uy + oy, aspect)

      const coverage =
        (bandInk(s00.g, s00.gate) +
          bandInk(s10.g, s10.gate) +
          bandInk(s01.g, s01.gate) +
          bandInk(s11.g, s11.gate)) *
        0.25

      // The tangent is perpendicular to the field gradient.
      const gx = s10.g + s11.g - s00.g - s01.g
      const gy = s01.g + s11.g - s00.g - s10.g
      const length = Math.hypot(gx, -gy)
      const tx = length > 1e-6 ? -gy / length : 1
      const ty = length > 1e-6 ? gx / length : 0

      const o = (y * width + x) * 4
      data[o] = byte(tx * 0.5 + 0.5)
      data[o + 1] = byte(ty * 0.5 + 0.5)
      data[o + 2] = byte(coverage)
      data[o + 3] = 255
    }
  }

  return { width, height, data }
}
