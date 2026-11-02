/* ============================================================================
   bayer.ts — one dither matrix, two materials
   ----------------------------------------------------------------------------
   The sheet's grain and the plate change's dots have to be the same screen, so
   they are generated from the same construction: the recursive Bayer matrix.

   The 2 × 2 seed is the arithmetic rule `(2x + 3y) mod 4` — that is exactly
   [0 2; 3 1] — and it recurses as `4·M(n) + seed`, which is how the printed
   convention is defined. The fragment shader runs the same recursion on
   `gl_FragCoord`; this module produces the 8 × 8 tile the veil masks with.

   Nothing here is a colour. The tile is pure alpha, so the veil's ink stays a
   CSS token and the shader keeps its own copy of `--ink` as raw sRGB floats.
   ========================================================================== */

/** Edge of the matrix. 8 × 8 = 64 printable levels. */
export const BAYER_SIZE = 8

/** The 2 × 2 seed, as a rule rather than a table. */
function seed(x: number, y: number) {
  return (2 * x + 3 * y) % 4
}

/**
 * The 8 × 8 ranks, 0..63, row-major.
 *
 * `16·lo + 4·mid + hi` is the unrolled recursion: three levels of the seed,
 * each one contributing the two low bits of its 2 × 2 block.
 */
export function bayerRanks(): number[] {
  const ranks: number[] = []

  for (let y = 0; y < BAYER_SIZE; y++) {
    for (let x = 0; x < BAYER_SIZE; x++) {
      const lo = seed(x % 2, y % 2)
      const mid = seed(Math.floor(x / 2) % 2, Math.floor(y / 2) % 2)
      const hi = seed(Math.floor(x / 4), Math.floor(y / 4))
      ranks.push(16 * lo + 4 * mid + hi)
    }
  }

  return ranks
}

/**
 * The same matrix as a repeating tile, for `mask-image`.
 *
 * It is a *binary* screen at 50%: a cell is printed when its rank is below the
 * middle of the matrix. That is what a halftone is — not an alpha ramp across
 * the tile (which reads as a moiré gradient at 1px, not as print), but dots in
 * the dispersed Bayer order, all of them fully printed. The band's own gradient
 * carries the tone; the tile carries the screen.
 *
 * `cell` is the edge of one dot in CSS pixels and `coverage` the share of cells
 * that print. Both matter: at 50% a Bayer matrix *is* a checkerboard, which
 * reads as a screen door rather than as a screen, so the tile stays under a
 * third. The mask is white because only its alpha is used — the band behind it
 * is painted with the ink token, and the band's own gradient carries the tone.
 */
export function bayerMaskTile(cell = 3, coverage = 0.34): string {
  const ranks = bayerRanks()
  const size = BAYER_SIZE * cell
  const dots: string[] = []

  for (let y = 0; y < BAYER_SIZE; y++) {
    for (let x = 0; x < BAYER_SIZE; x++) {
      if (ranks[y * BAYER_SIZE + x] >= BAYER_SIZE * BAYER_SIZE * coverage) continue
      dots.push(`<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`)
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<g fill="#fff">${dots.join('')}</g></svg>`

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
