/* ============================================================================
   glyphs.ts — the twelve characters, and how a cell chooses one
   ----------------------------------------------------------------------------
   The plate is not a luminance ramp. A cell of the drawing is not "dark" or
   "light": it is a piece of a line, and the character printed there has to have
   its ink in the same place. So every glyph carries a signature — where its ink
   lies — and every cell carries the same kind of signature, measured from the
   analytic line field rather than from a texture.

   Four directions, in screen space (`y` grows downward):

     0  —  horizontal       `—` `_`
     1  |  vertical         `|`
     2  /  up-right         `/`
     3  \  down-right       `\`

   A cell with a horizontal route through it measures `[1, 0, 0, 0]`; the em
   dash measures `[.88, .04, .04, .04]` and wins. A cell where two routes cross
   measures `[.5, .5, 0, 0]`; the plus wins. A cell with ink in every direction
   — a junction, a station, a dense knot — measures flat; the star wins.

   `ink` is the fraction of the cell the glyph actually covers, used only after
   the direction test: a faint line should not be set with a star just because a
   star is round. `spread` is the fourth term, and it is what separates `+`
   from `*`: a plus has ink on two axes, a star on four.

   The twelve are exactly the glyph set the section is allowed: punctuation
   only, no letters, no invented symbols. Everything on the plate is one of
   these characters, in one of four ink levels.
   ========================================================================== */

/** The set, in atlas order. Index is the glyph id used by the CPU and the shader. */
export const GLYPHS = [
  '/',
  '.',
  ',',
  ';',
  ':',
  '+',
  '\u2014',
  '|',
  '\\',
  '_',
  '*',
  "'",
] as const

/** Named indices, so the composition never depends on a literal position. */
export const GLYPH = {
  slash: 0,
  dot: 1,
  comma: 2,
  semi: 3,
  colon: 4,
  plus: 5,
  dash: 6,
  bar: 7,
  backslash: 8,
  underscore: 9,
  star: 10,
  quote: 11,
} as const

/** Four printed densities. The cell's coverage picks one; the shader reads it as alpha. */
export const LEVEL_ALPHA = [0.36, 0.68, 0.9, 1] as const

export type DirMass = [number, number, number, number]

type GlyphSpec = {
  char: string
  /** Fraction of the cell covered by the glyph's ink, 0..1. */
  ink: number
  /** Normalised ink mass per direction (horizontal, vertical, `/`, `\`). */
  dirs: DirMass
  /** 1 − the largest direction: 0 for a single stroke, .75 for an even knot. */
  spread: number
}

function spec(char: string, ink: number, dirs: DirMass): GlyphSpec {
  const sum = dirs[0] + dirs[1] + dirs[2] + dirs[3]
  const norm = dirs.map((value) => value / sum) as DirMass
  return { char, ink, dirs: norm, spread: 1 - Math.max(...norm) }
}

/**
 * Signatures are ideal, not sampled: the atlas is drawn with whatever the
 * `--font-mono` stack resolves to, and a signature read back from one font's
 * raster would be wrong for the next. What is true of the character is true in
 * every mono: an em dash runs across, a bar runs down, a slash runs up-right.
 *
 * `ink` is measured against the *character cell* (the mono advance), not the
 * square plate cell — the atlas draws each glyph at text size, on the
 * character's own origin, so that the plate is a text and not twelve stretched
 * signs.
 */
const SPECS: GlyphSpec[] = [
  spec('/', 0.3, [0.06, 0.06, 0.84, 0.04]),
  spec('.', 0.09, [0.25, 0.25, 0.25, 0.25]),
  spec(',', 0.11, [0.25, 0.25, 0.25, 0.25]),
  spec(';', 0.15, [0.25, 0.25, 0.25, 0.25]),
  spec(':', 0.17, [0.25, 0.25, 0.25, 0.25]),
  spec('+', 0.38, [0.44, 0.44, 0.06, 0.06]),
  spec('\u2014', 0.26, [0.88, 0.04, 0.04, 0.04]),
  spec('|', 0.26, [0.04, 0.88, 0.04, 0.04]),
  spec('\\', 0.3, [0.06, 0.06, 0.04, 0.84]),
  spec('_', 0.16, [0.8, 0.02, 0.09, 0.09]),
  spec('*', 0.46, [0.3, 0.3, 0.2, 0.2]),
  spec("'", 0.06, [0.25, 0.25, 0.25, 0.25]),
]

/* --------------------------------------------------------------------------
   The match
   ------------------------------------------------------------------------ */

/**
 * How much each term is allowed to speak. Direction first: the whole claim of
 * the section is that the character is chosen by shape. Coverage second, so a
 * short stroke is not set with a full-width dash. Spread last, to break the
 * ties the first two terms leave between `+` and `*`.
 */
const W_DIR = 1.3
const W_INK = 0.85
const W_SPREAD = 0.6

/** Below this the cell has no ink worth printing. */
export const MIN_COVERAGE = 0.09

export type GlyphChoice = { index: number; level: number }

/**
 * Choose the character for one cell.
 *
 * `dirs` is the measured direction mass (four bins, any positive scale) and
 * `coverage` the fraction of the cell the line field inks. Returns null when
 * the cell is empty, so the caller can leave it for the contour or the paper.
 */
export function matchGlyph(dirs: DirMass, coverage: number): GlyphChoice | null {
  if (coverage < MIN_COVERAGE) return null

  const sum = dirs[0] + dirs[1] + dirs[2] + dirs[3]
  if (sum <= 0) return null

  const h = dirs[0] / sum
  const v = dirs[1] / sum
  const up = dirs[2] / sum
  const down = dirs[3] / sum
  const spread = 1 - Math.max(h, v, up, down)

  let best = 0
  let bestScore = Infinity

  for (let i = 0; i < SPECS.length; i++) {
    const s = SPECS[i]
    const dot = h * s.dirs[0] + v * s.dirs[1] + up * s.dirs[2] + down * s.dirs[3]
    const score =
      W_DIR * (1 - dot) +
      W_INK * Math.abs(coverage - s.ink) +
      W_SPREAD * Math.abs(spread - s.spread)
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  }

  // Four printed levels, read off the same coverage. A single route through a
  // cell is level 2; a tie or a dash is level 1; a junction is level 3.
  const level = coverage < 0.16 ? 0 : coverage < 0.3 ? 1 : coverage < 0.62 ? 2 : 3

  return { index: best, level }
}

/** The three marks of the survey, transcribed into the character set. */
export const MARK_GLYPH = {
  node: GLYPH.plus,
  service: GLYPH.colon,
  control: GLYPH.star,
} as const
