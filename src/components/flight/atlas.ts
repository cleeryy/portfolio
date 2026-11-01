import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
} from 'three'

/* ============================================================================
   atlas.ts — the labels, drawn once
   ----------------------------------------------------------------------------
   The field has no image asset and no fetch: forty mono strings are set into a
   1024 × 1024 canvas the first time the section is built, and sampled forever
   after. Ten rows of four cells, 256 × 102 each, with the label left-hugging
   its cell, a hairline under it and a tick at the rule's left end — the same
   "value + rule" the sheet's legend uses.

   Each cell is *cropped* to the string's measured width. The cell records that
   rectangle and its aspect; the instance scales its quad from it, so `wg0` and
   `CVE-2024-6386` are typeset at one size rather than one square plate each.

   The canvas is white on transparent on purpose: it is a mask. The ink is a
   uniform in the shader, so the one texture prints dark on the sheet and is
   absorbed into the plate at the hand-off without a second upload.

   Call `drawAtlas` after `document.fonts.ready` — the caller owns that wait,
   and owns the fallback if it never resolves.
   ========================================================================== */

export const ATLAS_SIZE = 1024
export const ATLAS_COLS = 4
export const ATLAS_ROWS = 10
export const ATLAS_CELL_W = ATLAS_SIZE / ATLAS_COLS
export const ATLAS_CELL_H = 102

/** Padding around a label inside its cell, in atlas pixels. */
const PAD = 14
/** The largest a string may be drawn before it is set down a size. */
const MAX_TEXT = 210
/** The size every label is drawn at, before fitting. 28px of a 102-cell row. */
const BASE_SIZE = 28
const BASELINE = 48
const RULE = 62

export type AtlasCell = {
  u0: number
  v0: number
  u1: number
  v1: number
  /** Drawn width ÷ drawn height of the cropped cell, for the instance's quad. */
  aspect: number
}

/** The sheet's mono, read from the token so the atlas cannot drift from the page. */
export function monoStack(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--font-mono')
  const stack = raw.trim().replace(/\s+/g, ' ')
  return stack || "ui-monospace, 'SF Mono', Menlo, monospace"
}

/**
 * Set the labels into the atlas and return the crop of each cell.
 *
 * A string too wide for its cell is set down one size rather than cropped: the
 * atlas is 256px wide per label and the longest names here are thirteen
 * characters, so this is a guard, not a rule that fires.
 */
export function drawAtlas(
  ctx: CanvasRenderingContext2D,
  labels: string[],
): AtlasCell[] {
  const stack = monoStack()
  const cells: AtlasCell[] = []

  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'

  for (let i = 0; i < labels.length && i < ATLAS_COLS * ATLAS_ROWS; i++) {
    const col = i % ATLAS_COLS
    const row = Math.floor(i / ATLAS_COLS)
    const x0 = col * ATLAS_CELL_W
    const y0 = row * ATLAS_CELL_H
    const text = labels[i]

    let size = BASE_SIZE
    ctx.font = `400 ${size}px ${stack}`
    let width = ctx.measureText(text).width

    if (width > MAX_TEXT) {
      size = Math.max(16, Math.floor((BASE_SIZE * MAX_TEXT) / width))
      ctx.font = `400 ${size}px ${stack}`
      width = ctx.measureText(text).width
    }

    ctx.fillText(text, x0 + PAD, y0 + BASELINE)

    // The rule is the label's own underline, and the tick is the survey mark at
    // its head: the same pair the register prints under a station name.
    ctx.globalAlpha = 0.55
    ctx.fillRect(x0 + PAD, y0 + RULE, width, 1)
    ctx.fillRect(x0 + PAD, y0 + RULE, 1, 6)
    ctx.globalAlpha = 1

    const used = Math.ceil(PAD + width + PAD)
    cells.push({
      u0: x0 / ATLAS_SIZE,
      v0: 1 - (y0 + ATLAS_CELL_H) / ATLAS_SIZE,
      u1: (x0 + used) / ATLAS_SIZE,
      v1: 1 - y0 / ATLAS_SIZE,
      aspect: used / ATLAS_CELL_H,
    })
  }

  return cells
}

/**
 * Wrap the drawn canvas. Mipmapped so the far dissolve has something to sample
 * that is not a shimmer; clamped so a cropped cell can never read its neighbour.
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
