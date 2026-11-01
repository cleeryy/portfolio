import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
} from 'three'
import { GLYPHS } from './glyphs'

/* ============================================================================
   atlas.ts — the twelve characters, set once
   ----------------------------------------------------------------------------
   The same technique as `#flight`'s atlas: no image asset, no fetch. A 4 × 3
   canvas of 64px cells is drawn from `--font-mono` the first time the plate is
   built, and sampled for the rest of the session. The canvas is white on
   transparent: it is a mask, and the ink is a uniform in the shader, so the one
   texture prints every level of the ladder without a second upload.

   The important difference from the flight atlas: this one is a **text cell**,
   not a cropped label. Each glyph is drawn at the cell's left origin, at a font
   size equal to the cell, with the baseline placed where a `line-height: 1`
   line box puts it. That is what makes the WebGL plate and the `<pre>` fallback
   the same drawing at the same size — the fallback is literally the same text.

   Call `drawAtlas` again after `document.fonts.ready`: the glyphs keep their
   cells, so the texture only needs a redraw and a `needsUpdate`.
   ========================================================================== */

export const ATLAS_COLS = 4
export const ATLAS_ROWS = 3
export const ATLAS_CELL = 64
export const ATLAS_WIDTH = ATLAS_COLS * ATLAS_CELL
export const ATLAS_HEIGHT = ATLAS_ROWS * ATLAS_CELL

/**
 * How much larger than the cell the characters are set. A square plate cell is
 * wider than a monospace advance; at 1.0 the line glyphs leave a gap on every
 * side and a route reads as a dotted line. At 1.08 the em box still fits the
 * cell's ink range (ascenders and the comma's tail included), and the strokes
 * hold at a 10px print. The stylesheet sets the same ratio for the `<pre>`.
 */
export const GLYPH_SCALE = 1.08

/** The sheet's mono, read from the token so the plate cannot drift from the page. */
export function monoStack(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--font-mono')
  const stack = raw.trim().replace(/\s+/g, ' ')
  return stack || "ui-monospace, 'SF Mono', Menlo, monospace"
}

/**
 * Set the twelve glyphs into the atlas.
 *
 * The baseline is solved from the font's own box, not from the cell's centre:
 * a character's ink is not centred on its em, and centring it would shift every
 * row of the fallback against the canvas by a pixel or two. This is the same
 * arithmetic CSS does for `line-height: 1`.
 */
export function drawAtlas(ctx: CanvasRenderingContext2D): void {
  const stack = monoStack()

  ctx.clearRect(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  // 500, not 400: at a 10px print a regular mono stem is a half-covered pixel,
  // and the whole plate greys out. The weight is the plate's, not the page's.
  ctx.font = `500 ${ATLAS_CELL * GLYPH_SCALE}px ${stack}`

  const metrics = ctx.measureText('Hg')
  const ascent = metrics.fontBoundingBoxAscent ?? ATLAS_CELL * 0.8
  const descent = metrics.fontBoundingBoxDescent ?? ATLAS_CELL * 0.2
  const baseline = (ATLAS_CELL - (ascent + descent)) * 0.5 + ascent

  GLYPHS.forEach((glyph, index) => {
    const col = index % ATLAS_COLS
    const row = Math.floor(index / ATLAS_COLS)
    // Left origin of the character cell: the same place the `<pre>` puts it.
    ctx.fillText(glyph, col * ATLAS_CELL, row * ATLAS_CELL + baseline)
  })
}

/**
 * Wrap the drawn canvas. Mipmapped so the down-scale to a 9–13px cell is a
 * filter, not a shimmer; clamped so a cell can never read its neighbour.
 */
export function createAtlasTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas)
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.generateMipmaps = true
  texture.anisotropy = 1
  texture.needsUpdate = true
  return texture
}
