import {
  ENTRY_ID,
  EXIT_ID,
  territoryLinks,
  territoryStations,
  type TerritoryStation,
  type TierId,
} from '../../content/territory'
import { GLYPH, GLYPHS, LEVEL_ALPHA, MARK_GLYPH, matchGlyph, type DirMass } from './glyphs'

/* ============================================================================
   plate.ts — the drawing, resolved to a character grid
   ----------------------------------------------------------------------------
   One function produces the character matrix three times, for three readers:

   - the WebGL plate, which needs the *network* layer as instance attributes
     (the contour is its own baked texture, and never enters this matrix);
   - the `<pre>` fallback, which needs the network printed as text;
   - the pointer hit test, which needs the station positions in cell units.

   It is deliberately pure: no DOM, no WebGL, no canvas. The drawing is the same
   stations and the same links as `#territory` — `territoryStations` and
   `territoryLinks` are imported, never re-declared. The only thing this module
   invents is where on the sheet each mark lands, and that is a projection, not
   a network.

   Why the layout is flattened rather than projected in 3D: at 110 characters
   wide a perspective view collapses the three plans into each other, and the
   section's one job is that the shape reads in two seconds. So the sheet is
   seen as the printed plate sees it — edge at the top, fabric in the middle,
   services at the foot — with `z` kept as a small vertical skew, exactly the
   convention `TerritoryPlate.tsx` uses.
   ========================================================================== */

/** The two grids. Phones get their own matrix, not a scaled-down one. */
export const PLATE_GRID = {
  wide: { cols: 110, rows: 64 },
  phone: { cols: 56, rows: 40 },
} as const

/** Vertical position of each plan, before the drawing is fitted to the grid. */
const TIER_Y: Record<TierId, number> = { edge: 0.2, fabric: 0.5, services: 0.8 }

/** Horizontal reference: the plate's own 9-unit drawing measure. */
const X_REF = 4.5
const X_MIN = 0.1
const X_SPAN = 0.8

/** How much depth becomes height. Small: the plans must stay three bands. */
const Z_SKEW = 0.03

/** How far above the edge the way in sits. */
const ENTRY_LIFT = 0.115

/** Where the copies leave the sheet, on the projected x axis. */
const EXIT_X = 0.885

/** The fitted vertical measure, so the drawing uses the plate it is given. */
const Y_MIN = 0.07
const Y_MAX = 0.88

/** A host tie is a peg, not a line: the same decision as the scene's. */
const PEG_MIN = 3.2
const PEG_REACH = 0.32
const TIE_TONE = 0.62

/** Ink laid down per sample, and the sample spacing along a link, in cells. */
const SAMPLE_STEP = 0.34
const SAMPLE_INK = 0.115

/** Backup dashes: period and inked share, in cells. */
const DASH_PERIOD = 3.2
const DASH_INK = 1.5

const projectX = (x: number) => X_MIN + ((x + X_REF) / (X_REF * 2)) * X_SPAN
const rawY = (tier: TierId, z: number) => TIER_Y[tier] - z * Z_SKEW

/**
 * The vertical fit is measured from the data, not assumed: the entry is the
 * highest mark and the lowest guest is the lowest, and the drawing is stretched
 * between them. A station added at the foot of the plan moves the fit with it.
 */
const RAW_Y = (() => {
  let min = TIER_Y.edge - ENTRY_LIFT
  let max = -Infinity
  for (const station of territoryStations) {
    const y = rawY(station.tier, station.z)
    if (y < min) min = y
    if (y > max) max = y
  }
  return { min, max }
})()

const projectY = (tier: TierId, z: number) =>
  Y_MIN + ((rawY(tier, z) - RAW_Y.min) / (RAW_Y.max - RAW_Y.min)) * (Y_MAX - Y_MIN)

export type PlatePoint = { x: number; y: number }

export function projectStation(station: TerritoryStation): PlatePoint {
  return { x: projectX(station.x), y: projectY(station.tier, station.z) }
}

export type PlateMark = {
  id: string
  /** Cell-space coordinates, for the pointer hit test. */
  x: number
  y: number
}

export type Plate = {
  cols: number
  rows: number
  /**
   * Seven floats per cell, row-major: cell x, cell y, glyph id (−1 for none),
   * ink alpha, crimson flag, resolve order, clear-margin flag.
   */
  data: Float32Array
  /** Station positions in cell units, in `territoryStations` order. */
  marks: PlateMark[]
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** A deterministic scatter for the resolve order; not a visual hash. */
function jitter(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * Build the character matrix.
 *
 * The canvas is the only material that prints the contour field: it reads a
 * field baked once at mount, so the engraving can move while the drawing stays.
 * This function is the fixed drawing — the stations and the links — which is
 * also exactly what the `<pre>` fallback prints. Keeping the field out of the
 * text is deliberate: one ink cannot carry both the drawing and the atmosphere,
 * and the topology is what the fallback has to be honest about.
 */
export function buildPlate(cols: number, rows: number): Plate {
  const count = cols * rows
  const ink = new Float32Array(count)
  const dirs = new Float32Array(count * 4)
  const mark = new Uint8Array(count)
  const forced = new Int16Array(count).fill(-1)
  const forcedAlpha = new Float32Array(count)

  /* ---- the two points that are not stations ---------------------------- */

  const points = new Map<string, PlatePoint>()
  for (const station of territoryStations) points.set(station.id, projectStation(station))

  const opnsense = points.get('opnsense')
  const pbs = points.get('pbs')
  if (!opnsense || !pbs) {
    return { cols, rows, data: new Float32Array(count * 7), marks: [] }
  }

  points.set(ENTRY_ID, { x: opnsense.x, y: Y_MIN })
  points.set(EXIT_ID, { x: EXIT_X, y: pbs.y })

  /* ---- stamping -------------------------------------------------------- */

  /**
   * Lay one sample into the cell that contains it, and record which of the
   * four directions it runs in. The cell owns its ink; a line thinner than a
   * character is a fact of the drawing, not a reason to thicken it.
   */
  const stamp = (x: number, y: number, dx: number, dy: number, weight: number) => {
    const cx = Math.floor(x)
    const cy = Math.floor(y)
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return

    const i = cy * cols + cx
    ink[i] += weight

    let angle = Math.atan2(dy, dx)
    if (angle < 0) angle += Math.PI

    let bin: number
    if (angle < Math.PI / 8 || angle >= (Math.PI * 7) / 8) bin = 0
    else if (angle < (Math.PI * 3) / 8) bin = 3
    else if (angle < (Math.PI * 5) / 8) bin = 1
    else bin = 2

    dirs[i * 4 + bin] += weight
  }

  const stroke = (a: PlatePoint, b: PlatePoint, tone: number, dashed: boolean) => {
    const ax = a.x * cols
    const ay = a.y * rows
    const bx = b.x * cols
    const by = b.y * rows

    const dx = bx - ax
    const dy = by - ay
    const length = Math.hypot(dx, dy)
    if (length < 0.001) return

    const steps = Math.max(2, Math.ceil(length / SAMPLE_STEP))
    const weight = tone * SAMPLE_INK

    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      if (dashed) {
        const phase = (t * length) % DASH_PERIOD
        if (phase > DASH_INK) continue
      }
      stamp(ax + dx * t, ay + dy * t, dx, dy, weight)
    }
  }

  /* ---- the links ------------------------------------------------------- */

  for (const link of territoryLinks) {
    const a = points.get(link.a)
    const b = points.get(link.b)
    if (!a || !b) continue

    const tone = link.kind === 'host' ? TIE_TONE : link.kind === 'backup' ? 0.95 : 1

    // A tie is a peg towards its node, never a line all the way there: ten of
    // those close the plan into a comb, which is the same reason the scene
    // rests its ties as stubs.
    if (link.tie) {
      const length = Math.hypot((b.x - a.x) * cols, (b.y - a.y) * rows)
      if (length < 0.001) continue
      const reach = Math.min(1, Math.max(PEG_MIN, length * PEG_REACH) / length)
      stroke(a, { x: a.x + (b.x - a.x) * reach, y: a.y + (b.y - a.y) * reach }, tone, false)
      continue
    }

    stroke(a, b, tone, link.kind === 'backup')
  }

  /* ---- the marks ------------------------------------------------------- */

  const cellOf = (p: PlatePoint) => ({
    x: Math.min(cols - 1, Math.max(0, Math.round(p.x * cols - 0.5))),
    y: Math.min(rows - 1, Math.max(0, Math.round(p.y * rows - 0.5))),
  })

  const force = (x: number, y: number, glyph: number, alpha: number, crimson: boolean) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return
    const i = y * cols + x
    forced[i] = glyph
    forcedAlpha[i] = alpha
    if (crimson) mark[i] = 1
  }

  for (const station of territoryStations) {
    const c = cellOf(projectStation(station))

    if (station.kind === 'control') {
      // One crimson cluster, not one crimson cell: the control point is a ring
      // on the plate above, and a ring is the only shape a character grid can
      // give it without inventing a symbol.
      const levelHigh = LEVEL_ALPHA[3]
      const levelMid = LEVEL_ALPHA[2]
      force(c.x, c.y, MARK_GLYPH.control, levelHigh, true)
      force(c.x + 1, c.y, MARK_GLYPH.node, levelHigh, true)
      force(c.x - 1, c.y, MARK_GLYPH.node, levelHigh, true)
      force(c.x, c.y + 1, MARK_GLYPH.node, levelHigh, true)
      force(c.x, c.y - 1, MARK_GLYPH.node, levelHigh, true)
      force(c.x + 1, c.y + 1, GLYPH.dot, levelMid, true)
      force(c.x + 1, c.y - 1, GLYPH.dot, levelMid, true)
      force(c.x - 1, c.y + 1, GLYPH.dot, levelMid, true)
      force(c.x - 1, c.y - 1, GLYPH.dot, levelMid, true)
      continue
    }

    force(
      c.x,
      c.y,
      station.kind === 'node' ? MARK_GLYPH.node : MARK_GLYPH.service,
      LEVEL_ALPHA[3],
      false,
    )
  }

  /* ---- the matrix ------------------------------------------------------ */

  const opnCell = cellOf(opnsense)
  const maxDistance = Math.hypot(
    Math.max(opnCell.x + 0.5, cols - opnCell.x - 0.5),
    Math.max(opnCell.y + 0.5, rows - opnCell.y - 0.5),
  )

  const targetGlyph = new Int16Array(count).fill(-1)
  const targetAlpha = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    let glyph = forced[i]
    let alpha = forcedAlpha[i]

    if (glyph < 0) {
      const local: DirMass = [dirs[i * 4], dirs[i * 4 + 1], dirs[i * 4 + 2], dirs[i * 4 + 3]]
      const choice = matchGlyph(local, clamp01(ink[i]))
      if (choice) {
        glyph = choice.index
        alpha = LEVEL_ALPHA[choice.level]
      }
    }

    targetGlyph[i] = glyph
    targetAlpha[i] = alpha
  }

  /**
   * The clear margin around the drawing. A contour that runs through a link
   * turns the line into a dotted mess and the field into a dirty scan; the
   * atmosphere solves the same problem by thinning its ink where the type
   * lives. Here the network gets one cell of clean paper on every side, so the
   * contour is the margin of the drawing, not a second mark on it.
   */
  const halo = new Uint8Array(count)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (targetGlyph[y * cols + x] < 0) continue
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox
          const ny = y + oy
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          halo[ny * cols + nx] = 1
        }
      }
    }
  }

  // Seven floats per cell: the six the shader reads, and the clear-margin flag.
  const data = new Float32Array(count * 7)

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const o = i * 7

      const glyph = targetGlyph[i]
      const alpha = targetAlpha[i]

      const distance = Math.hypot(x + 0.5 - (opnCell.x + 0.5), y + 0.5 - (opnCell.y + 0.5))
      const order = clamp01((distance / Math.max(maxDistance, 1)) * 0.93 + jitter(x, y) * 0.07)

      data[o] = x + 0.5
      data[o + 1] = y + 0.5
      data[o + 2] = glyph
      data[o + 3] = glyph < 0 ? 0 : alpha
      data[o + 4] = mark[i]
      data[o + 5] = order
      data[o + 6] = halo[i]
    }
  }

  return {
    cols,
    rows,
    data,
    marks: territoryStations.map((station) => {
      const p = projectStation(station)
      return { id: station.id, x: p.x * cols, y: p.y * rows }
    }),
  }
}

/**
 * The fallback, as text: `rows` lines of exactly `cols` characters. Trailing
 * spaces are kept, because the grid is the drawing and a trimmed line would
 * shift every cell after it. The caller owns the mono type; this is only the
 * matrix — the same matrix the canvas reads, with the stations and links of
 * `#territory` and nothing invented.
 */
export function composePre(cols: number, rows: number): string {
  const plate = buildPlate(cols, rows)
  const lines: string[] = []

  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < cols; x++) {
      const glyph = plate.data[(y * cols + x) * 7 + 2]
      line += glyph >= 0 ? GLYPHS[glyph] : ' '
    }
    lines.push(line)
  }

  return lines.join('\n')
}
