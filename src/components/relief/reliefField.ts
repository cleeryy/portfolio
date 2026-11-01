/* ============================================================================
   reliefField.ts — the terrain, and the plates cut from it
   ----------------------------------------------------------------------------
   A relief model is not a mesh with a map painted on it. It is a stack of
   contours, each one cut out of card and set at the height it measures: walk
   the ground and the lines close in; stand on a plateau and there are none.

   So the asset is built the way a surveyor would build it:

   1. **A height field, sampled once.** Three octaves of value noise over a
      seeded integer hash — the same hash family the atmosphere runs on the
      GPU, moved to the CPU so the drawing is deterministic and the SVG can be
      printed from the same numbers. A ridge, one summit, and an irregular
      radial mask so the outermost contour is a coastline instead of the four
      sides of a grid.
   2. **Contours at twenty levels** (ten on a phone), extracted by marching
      squares and *joined into polylines*: an unjoined soup of cell-sized
      segments cannot be extruded, because there is no vertex to hang a cut
      edge from.
   3. **Twenty plates.** Each level is drawn twice — top face and bottom face,
      one card's thickness apart — and stitched at every fourth vertex by a
      short vertical. That is what gives the solid real thickness in
      perspective; the fill is left out on purpose, because a filled model would
      need shading and this sheet has none.

   Everything here is pure: no DOM, no three, no time. The scene turns the
   model into one position buffer, and the fallback plate projects the very
   same polylines orthographically. They cannot drift apart, because there is
   only one field.
   ========================================================================== */

/** How many plates a level set has. A phone halves it, as the brief asks. */
export const RELIEF_LEVELS_FINE = 20
export const RELIEF_LEVELS_COARSE = 10

/** Cells of the sampling grid. Enough for a smooth hairline, not more. */
const NX = 192
const NZ = 126

/** The footprint, in drawing units: wider than deep, like a map sheet. */
const HALF_X = 1.62
const HALF_Z = 0.76

/** Height of the whole stack, before each plate's own thickness is added. */
const STACK_HEIGHT = 0.92

/** Contours are sampled between these fractions of the field's own peak. */
const LEVEL_LO = 0.1
const LEVEL_HI = 0.95

/** A plate is about a third of the gap: card, not a slab. */
const THICKNESS_RATIO = 0.34

/** One stitch every N vertices of a contour. */
const STITCH_STRIDE = 4

/** Deterministic seed. Changing it re-surveys the terrain, nothing else. */
const SEED = 0x2f6e2b1

/**
 * Where the drawing is allowed to sit, in NDC of its own canvas. NDC y is up.
 *
 * Shared by the scene (which fits the solid into it) and by the fallback plate
 * (which insets the same rectangle in CSS), so a context loss cannot resize the
 * drawing under the reader: the two frames are the same frame.
 */
export const RELIEF_BOX = {
  fine: { x0: -0.86, x1: 0.975, y0: -0.76, y1: 0.82 },
  coarse: { x0: -0.94, x1: 0.94, y0: -0.9, y1: 0.92 },
} as const

/* The move, in radians: the object turns about 40° across the pass and leans
   ±6° with the pointer. Exported because the frame is fitted on the union of
   both, not on the pose at rest. */
export const RELIEF_SWEEP = 0.698
export const RELIEF_TILT = 0.105
/** Bounded idle sway, included in the fit so a still visitor never clips it. */
export const RELIEF_DRIFT = 0.026

/* --------------------------------------------------------------------------
   The field
   ------------------------------------------------------------------------ */

function hash2(ix: number, iy: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ SEED
  h = Math.imul(h ^ (h >>> 15), 0x2545f491)
  h ^= h >>> 13
  return (h >>> 0) / 4294967295
}

/** Value noise with a smoothstep interpolant — the atmosphere's, on the CPU. */
function noise2(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)

  const a = hash2(ix, iy)
  const b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1)
  const d = hash2(ix + 1, iy + 1)

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * The landform. Three octaves for the ground, one long ridge so the model reads
 * as a range rather than a plate of blobs, one summit off-centre left so the
 * eye has a high point to land on, and a mask that dissolves the field into the
 * sheet before the grid's own edge is reached.
 */
function heightAt(x: number, z: number): number {
  // The x frequency is set higher than the z frequency so the noise stays
  // round on a footprint that is twice as wide as it is deep: the terrain is
  // stretched, the weather that shaped it is not.
  const u = x * 2.45
  const v = z * 2.05

  const ground =
    0.55 * noise2(u, v) +
    0.28 * noise2(u * 2.03 + 11.7, v * 2.03 + 4.3) +
    0.14 * noise2(u * 4.11 + 6.1, v * 4.11 + 17.9)

  const ridgeZ = (z + 0.16) * 2.2
  const ridge =
    0.3 *
    Math.exp(-ridgeZ * ridgeZ) *
    (0.55 + 0.45 * noise2(u * 0.78 + 3.7, v * 0.78 + 8.1))

  const sx = (x + 0.58) / 0.66
  const sz = (z + 0.04) / 0.44
  const summit = 0.24 * Math.exp(-(sx * sx + sz * sz))

  const rx = x / 1.63
  const rz = z / 0.77
  const r =
    Math.sqrt(rx * rx + rz * rz) +
    0.15 * (noise2(u * 1.7 + 21.3, v * 1.7 + 5.9) - 0.5)

  return (ground * 0.86 + ridge + summit) * smoothstep(1.04, 0.42, r)
}

/* --------------------------------------------------------------------------
   Marching squares
   ------------------------------------------------------------------------ */

/**
 * Edge ids. A horizontal edge sits between (i, j) and (i+1, j); a vertical one
 * between (i, j) and (i, j+1). Both cells that share an edge compute the same
 * interpolated point, which is what lets the segments be joined.
 */
function edgeId(kind: 0 | 1, i: number, j: number): number {
  // `NX + 1` columns for both kinds: a vertical edge at i = NX must not land on
  // the next row's first horizontal edge.
  return 2 * (j * (NX + 1) + i) + kind
}

/* Scratch for one crossing, so `crossing()` allocates nothing. */
let cx = 0
let cz = 0

/**
 * The point where the level crosses one edge of a cell, written to `cx`/`cz`.
 * `values` is the sampled grid, row-major, `NX + 1` wide.
 */
function crossing(
  values: Float32Array,
  kind: 0 | 1,
  i: number,
  j: number,
  level: number,
): void {
  const stride = NX + 1
  const stepX = (HALF_X * 2) / NX
  const stepZ = (HALF_Z * 2) / NZ
  const x0 = -HALF_X + i * stepX
  const z0 = -HALF_Z + j * stepZ

  if (kind === 1) {
    // Left edge: from (i, j) to (i, j+1). The order is always bottom → top, so
    // the cell above computes the same point.
    const a = values[j * stride + i]
    const d = values[(j + 1) * stride + i]
    const t = (level - a) / (d - a || 1e-9)
    cx = x0
    cz = z0 + t * stepZ
    return
  }

  // Bottom edge: from (i, j) to (i+1, j), always left → right.
  const a = values[j * stride + i]
  const b = values[j * stride + i + 1]
  const t = (level - a) / (b - a || 1e-9)
  cx = x0 + t * stepX
  cz = z0
}

/**
 * Every level, in one pass over the grid. Returns one list of joined polylines
 * per level, flat `[x, z, …]` runs.
 *
 * A cell is visited for the levels it actually straddles — `lo` and `hi` are its
 * own corner extremes, so the level index range is arithmetic, not a search.
 * Testing every cell against every level would be seventeen times the work for
 * the same drawing.
 *
 * The join matters twice over: the extrusion hangs its stitches from vertices,
 * and a 1px line drawn as hundreds of one-cell segments would show every cell
 * boundary on the far side of the turn. A polyline is one continuous stroke.
 */
function extractContours(
  values: Float32Array,
  max: number,
  count: number,
): Float32Array[][] {
  const stride = NX + 1
  const stepT = (LEVEL_HI - LEVEL_LO) / Math.max(1, count - 1)

  const levelOf = (k: number) => (LEVEL_LO + stepT * k) * max

  const segA: number[][] = []
  const segB: number[][] = []
  for (let k = 0; k < count; k++) {
    segA.push([])
    segB.push([])
  }

  const push = (k: number, e0: number, e1: number) => {
    segA[k].push(e0)
    segB[k].push(e1)
  }

  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const a = values[j * stride + i]
      const b = values[j * stride + i + 1]
      const c = values[(j + 1) * stride + i + 1]
      const d = values[(j + 1) * stride + i]

      const lo = Math.min(a, b, c, d)
      const hi = Math.max(a, b, c, d)
      let k0 = Math.ceil((lo / max - LEVEL_LO) / stepT)
      let k1 = Math.floor((hi / max - LEVEL_LO) / stepT)
      if (k0 < 0) k0 = 0
      if (k1 > count - 1) k1 = count - 1
      if (k0 > k1) continue

      const e0 = edgeId(0, i, j) // bottom
      const e1 = edgeId(1, i + 1, j) // right
      const e2 = edgeId(0, i, j + 1) // top
      const e3 = edgeId(1, i, j) // left

      for (let k = k0; k <= k1; k++) {
        const level = levelOf(k)

        let mask = 0
        if (a > level) mask |= 1
        if (b > level) mask |= 2
        if (c > level) mask |= 4
        if (d > level) mask |= 8
        if (mask === 0 || mask === 15) continue

        switch (mask) {
          case 1:
          case 14:
            push(k, e0, e3)
            break
          case 2:
          case 13:
            push(k, e0, e1)
            break
          case 3:
          case 12:
            push(k, e1, e3)
            break
          case 4:
          case 11:
            push(k, e1, e2)
            break
          case 6:
          case 9:
            push(k, e0, e2)
            break
          case 7:
          case 8:
            push(k, e2, e3)
            break
          case 5:
          case 10: {
            // A saddle: two contours cross the cell, and the centre decides
            // which corners belong together. The pairing flips between the two
            // cases — that is the whole of the rule, and it is deterministic.
            const centreAbove = (a + b + c + d) * 0.25 > level
            const aroundCorners = mask === 5 ? centreAbove : !centreAbove
            if (aroundCorners) {
              push(k, e0, e1)
              push(k, e2, e3)
            } else {
              push(k, e0, e3)
              push(k, e1, e2)
            }
            break
          }
          default:
            break
        }
      }
    }
  }

  const out: Float32Array[][] = []
  for (let k = 0; k < count; k++) {
    out.push(joinSegments(values, levelOf(k), segA[k], segB[k]))
  }
  return out
}

/** Segment pairs at one level, walked end to end into open or closed polylines. */
function joinSegments(
  values: Float32Array,
  level: number,
  segA: number[],
  segB: number[],
): Float32Array[] {
  if (segA.length === 0) return []

  const adjacency = new Map<number, number[]>()
  for (let s = 0; s < segA.length; s++) {
    const listA = adjacency.get(segA[s])
    if (listA) listA.push(s)
    else adjacency.set(segA[s], [s])
    const listB = adjacency.get(segB[s])
    if (listB) listB.push(s)
    else adjacency.set(segB[s], [s])
  }

  const used = new Uint8Array(segA.length)
  const out: Float32Array[] = []
  const guardMax = segA.length + 2

  const trace = (start: number) => {
    used[start] = 1
    const forward: number[] = []
    const backward: number[] = []

    let edge = segB[start]
    let seg = start
    for (let guard = 0; guard < guardMax; guard++) {
      const near = adjacency.get(edge)
      if (!near) break
      const next = near[0] === seg ? near[1] : near[0]
      if (next === undefined || used[next]) break
      used[next] = 1
      const other = segA[next] === edge ? segB[next] : segA[next]
      forward.push(other)
      edge = other
      seg = next
    }

    edge = segA[start]
    seg = start
    for (let guard = 0; guard < guardMax; guard++) {
      const near = adjacency.get(edge)
      if (!near) break
      const next = near[0] === seg ? near[1] : near[0]
      if (next === undefined || used[next]) break
      used[next] = 1
      const other = segA[next] === edge ? segB[next] : segA[next]
      backward.push(other)
      edge = other
      seg = next
    }

    const points: number[] = []
    for (let k = backward.length - 1; k >= 0; k--) {
      crossingFromEdge(values, backward[k], level)
      points.push(cx, cz)
    }
    crossingFromEdge(values, segA[start], level)
    points.push(cx, cz)
    crossingFromEdge(values, segB[start], level)
    points.push(cx, cz)
    for (let k = 0; k < forward.length; k++) {
      crossingFromEdge(values, forward[k], level)
      points.push(cx, cz)
    }

    if (points.length >= 6) out.push(Float32Array.from(points))
  }

  for (let s = 0; s < segA.length; s++) {
    if (!used[s]) trace(s)
  }

  return out
}

/**
 * `crossing()`, addressed by edge id. Edge ids encode their own kind and cell:
 *
 *   id = 2 · (j · (NX + 1) + i) + kind
 *
 * so the inverse is a divide and a mask — no lookup table, no allocation.
 */
function crossingFromEdge(values: Float32Array, id: number, level: number): void {
  const kind = (id & 1) as 0 | 1
  const cell = (id - kind) / 2
  const i = cell % (NX + 1)
  const j = (cell - i) / (NX + 1)
  crossing(values, kind, i, j, level)
}

/* --------------------------------------------------------------------------
   The model
   ------------------------------------------------------------------------ */

export type ReliefContour = {
  /** Flat `[x, z, …]`, in drawing units. */
  points: Float32Array
  /** Height of the plate's top face. */
  y: number
  /** Every fifth contour is an index contour, as on a printed sheet. */
  index: boolean
  /** The field value this line measures, normalised to 0..1. */
  level: number
}

export type ReliefModel = {
  contours: ReliefContour[]
  levels: number
  /** Total contour vertices, before the plates are extruded. */
  vertices: number
  thickness: number
  halfX: number
  halfZ: number
  maxY: number
  /** The one point the crimson tick marks. */
  here: { x: number; y: number; z: number }
  /**
   * The island's plan outline, as a 24-gon of extreme points (`[x, z, …]`).
   * The frame is fitted on this, not on the sampling grid's rectangle: a box
   * around an irregular island reserves air at every corner, and the drawing
   * ends up small in a frame that was solved for a rectangle nobody draws.
   */
  hull: Float32Array
  /** Top of the solid, pad included: every vertex lies below it. */
  hullTop: number
}

const models = new Map<number, ReliefModel>()

/** Phone or desk? One predicate, so the type and the scene cannot disagree. */
export function reliefCoarse(): boolean {
  return window.matchMedia('(max-width: 900px)').matches
}

export function reliefLevels(coarse: boolean): number {
  return coarse ? RELIEF_LEVELS_COARSE : RELIEF_LEVELS_FINE
}

/** The model is built once per level count and shared by canvas and plate. */
export function getReliefModel(coarse: boolean): ReliefModel {
  const count = reliefLevels(coarse)
  const cached = models.get(count)
  if (cached) return cached

  const stride = NX + 1
  const values = new Float32Array(stride * (NZ + 1))

  let max = 0
  let peakX = 0
  let peakZ = 0

  for (let j = 0; j <= NZ; j++) {
    const z = -HALF_Z + (j / NZ) * HALF_Z * 2
    for (let i = 0; i <= NX; i++) {
      const x = -HALF_X + (i / NX) * HALF_X * 2
      const value = heightAt(x, z)
      values[j * stride + i] = value
      if (value > max) {
        max = value
        peakX = x
        peakZ = z
      }
    }
  }

  const gap = STACK_HEIGHT / Math.max(1, count - 1)
  const thickness = gap * THICKNESS_RATIO

  const levels = extractContours(values, max, count)
  const contours: ReliefContour[] = []
  let vertices = 0

  for (let k = 0; k < count; k++) {
    const t = LEVEL_LO + ((LEVEL_HI - LEVEL_LO) * k) / Math.max(1, count - 1)
    const y = ((t - LEVEL_LO) / (LEVEL_HI - LEVEL_LO)) * STACK_HEIGHT + thickness

    for (const points of levels[k]) {
      vertices += points.length / 2
      contours.push({ points, y, index: k % 5 === 0, level: t })
    }
  }

  const hull = planHull(contours)
  const maxY = STACK_HEIGHT + thickness

  /* The mark stands on the terrain, not above it: it is placed on the highest
     contour, at the point of that line nearest the summit. A reticle floating
     in the middle of the top ring reads as a speck of dust on the lens. */
  let here = { x: peakX, y: maxY, z: peakZ }
  let top: ReliefContour | null = null
  for (const contour of contours) {
    if (!top || contour.y > top.y) top = contour
  }
  if (top) {
    let nearest = Infinity
    let hx = peakX
    let hz = peakZ
    for (let p = 0; p < top.points.length; p += 2) {
      const dx = top.points[p] - peakX
      const dz = top.points[p + 1] - peakZ
      const d = dx * dx + dz * dz
      if (d < nearest) {
        nearest = d
        hx = top.points[p]
        hz = top.points[p + 1]
      }
    }
    here = { x: hx, y: top.y + 0.004, z: hz }
  }

  // The plate rests on the sheet: the lowest cut sits at y − thickness = 0.
  const model: ReliefModel = {
    contours,
    levels: count,
    vertices,
    thickness,
    halfX: HALF_X,
    halfZ: HALF_Z,
    maxY,
    hull,
    hullTop: Math.max(maxY + 0.03, here.y + 0.12),
    here,
  }

  models.set(count, model)
  return model
}

/**
 * The plan outline: for 24 directions around the model, the vertex that reaches
 * furthest along it. Twenty-four points are plenty for a silhouette that is
 * then fitted fifteen times over, and the cost is one pass over the contour
 * vertices — not a general convex hull, and not a second copy of the field.
 */
function planHull(contours: ReliefContour[]): Float32Array {
  const DIRECTIONS = 24
  const out = new Float32Array(DIRECTIONS * 2)
  const cos = new Float32Array(DIRECTIONS)
  const sin = new Float32Array(DIRECTIONS)
  const best = new Float32Array(DIRECTIONS)

  for (let i = 0; i < DIRECTIONS; i++) {
    const angle = (i / DIRECTIONS) * Math.PI * 2
    cos[i] = Math.cos(angle)
    sin[i] = Math.sin(angle)
    best[i] = -Infinity
  }

  for (const contour of contours) {
    const pts = contour.points
    for (let p = 0; p < pts.length; p += 2) {
      const x = pts[p]
      const z = pts[p + 1]
      for (let i = 0; i < DIRECTIONS; i++) {
        const d = x * cos[i] + z * sin[i]
        if (d > best[i]) {
          best[i] = d
          out[i * 2] = x
          out[i * 2 + 1] = z
        }
      }
    }
  }

  return out
}

/* --------------------------------------------------------------------------
   The buffer the scene draws
   ------------------------------------------------------------------------ */

export type ReliefGeometry = {
  positions: Float32Array
  /** 1 for an index contour, 0.5 for a hairline. */
  weights: Float32Array
  /** 1 for the single crimson mark. */
  crimes: Float32Array
  segments: number
}

/**
 * The extruded plates, as one segment buffer.
 *
 * For every contour: the top face, the bottom face one card lower, and a stitch
 * every fourth vertex. The two faces are what make the thickness read; the
 * stitches are what make the cut edge visible from the side. No fill, no
 * triangle: this is a drawing of a solid, not a shaded one.
 */
export function buildReliefGeometry(model: ReliefModel): ReliefGeometry {
  const positions: number[] = []
  const weights: number[] = []
  const crimes: number[] = []

  const segment = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    weight: number,
    crime = 0,
  ) => {
    positions.push(ax, ay, az, bx, by, bz)
    weights.push(weight, weight)
    crimes.push(crime, crime)
  }

  for (const contour of model.contours) {
    const pts = contour.points
    const y = contour.y
    const low = y - model.thickness
    const weight = contour.index ? 1 : 0.46
    const count = pts.length / 2

    for (let p = 0; p < count - 1; p++) {
      const x0 = pts[p * 2]
      const z0 = pts[p * 2 + 1]
      const x1 = pts[p * 2 + 2]
      const z1 = pts[p * 2 + 3]

      segment(x0, y, z0, x1, y, z1, weight)
      segment(x0, low, z0, x1, low, z1, weight)
    }

    for (let p = 0; p < count; p += STITCH_STRIDE) {
      const x = pts[p * 2]
      const z = pts[p * 2 + 1]
      segment(x, y, z, x, low, z, weight)
    }
    // The last vertex always gets its cut edge, whatever the stride lands on:
    // an open polyline's end without a stitch reads as a missing corner.
    if ((count - 1) % STITCH_STRIDE !== 0) {
      const x = pts[(count - 1) * 2]
      const z = pts[(count - 1) * 2 + 1]
      segment(x, y, z, x, low, z, weight)
    }
  }

  /* One mark, and only one: a survey pin on the summit contour, at the point
     the margin's coordinate names. The stem is what makes it a pin standing on
     the terrain — a reticle alone, on a drawing with no filled surface, reads
     as a speck in the air. */
  const g = 0.02
  const h = 0.055
  const { x, y, z } = model.here
  const head = y + 0.1
  segment(x, y, z, x, head, z, 1, 1)
  segment(x - h, head, z, x - g, head, z, 1, 1)
  segment(x + g, head, z, x + h, head, z, 1, 1)
  segment(x, head, z - h, x, head, z - g, 1, 1)
  segment(x, head, z + g, x, head, z + h, 1, 1)

  return {
    positions: Float32Array.from(positions),
    weights: Float32Array.from(weights),
    crimes: Float32Array.from(crimes),
    segments: positions.length / 6,
  }
}

/* --------------------------------------------------------------------------
   The fallback plate
   ------------------------------------------------------------------------ */

export type ReliefPlateData = {
  viewBox: string
  paths: { d: string; index: boolean }[]
  mark: string
}

/** The same 3/4 view the camera opens on, projected orthographically. */
const PLATE_AZ = 0.6
const PLATE_EL = 0.5

const PLATE_COS_AZ = Math.cos(PLATE_AZ)
const PLATE_SIN_AZ = Math.sin(PLATE_AZ)
const PLATE_COS_EL = Math.cos(PLATE_EL)
const PLATE_SIN_EL = Math.sin(PLATE_EL)

let plateX = 0
let plateY = 0

function project(x: number, y: number, z: number): void {
  const right = x * PLATE_COS_AZ - z * PLATE_SIN_AZ
  const depth = x * PLATE_SIN_AZ + z * PLATE_COS_AZ
  plateX = right
  plateY = -(y * PLATE_COS_EL + depth * PLATE_SIN_EL)
}

/**
 * The static plate: every contour, the same field, the same mark, printed once.
 * It costs a few dozen path strings, so it is built only when the section needs
 * it — as a poster under the first frame, and forever when WebGL never arrives.
 */
export function buildReliefPlate(model: ReliefModel): ReliefPlateData {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  const track = (x: number, y: number) => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const paths: { d: string; index: boolean }[] = []

  for (const contour of model.contours) {
    const pts = contour.points
    const count = pts.length / 2
    const sx: number[] = []
    const sy: number[] = []

    for (let p = 0; p < count; p++) {
      project(pts[p * 2], contour.y, pts[p * 2 + 1])
      const x = Math.round(plateX * 100) / 100
      const y = Math.round(plateY * 100) / 100
      sx.push(x)
      sy.push(y)
      track(x, y)
    }

    // Marching squares leaves a chord per cell, and on a printed plate those
    // chords are visible as corners — the canvas hides them under the screen,
    // a 1px stroke does not. So the path is drawn through the midpoints, with
    // each sampled vertex as a control point: the line is the same line, with
    // the plotter's hand put back into it.
    let d = `M${sx[0]} ${sy[0]}`
    for (let i = 1; i < count - 1; i++) {
      const mx = Math.round(((sx[i] + sx[i + 1]) / 2) * 100) / 100
      const my = Math.round(((sy[i] + sy[i + 1]) / 2) * 100) / 100
      d += `Q${sx[i]} ${sy[i]} ${mx} ${my}`
    }
    d += `L${sx[count - 1]} ${sy[count - 1]}`

    paths.push({ d, index: contour.index })
  }

  const { x, y, z } = model.here
  const g = 0.02
  const h = 0.055
  const head = y + 0.1
  let mark = ''
  project(x, y, z)
  mark += `M${Math.round(plateX * 100) / 100} ${Math.round(plateY * 100) / 100}`
  project(x, head, z)
  mark += `L${Math.round(plateX * 100) / 100} ${Math.round(plateY * 100) / 100}`
  const ticks: [number, number, number, number][] = [
    [x - h, z, x - g, z],
    [x + g, z, x + h, z],
    [x, z - h, x, z - g],
    [x, z + g, x, z + h],
  ]
  for (const [ax, az, bx, bz] of ticks) {
    project(ax, head, az)
    mark += `M${Math.round(plateX * 100) / 100} ${Math.round(plateY * 100) / 100}`
    project(bx, head, bz)
    mark += `L${Math.round(plateX * 100) / 100} ${Math.round(plateY * 100) / 100}`
  }

  const pad = Math.max(0.06, (maxX - minX) * 0.04)
  const w = Math.max(0.2, maxX - minX)
  const hgt = Math.max(0.2, maxY - minY)

  return {
    viewBox: `${(minX - pad).toFixed(2)} ${(minY - pad).toFixed(2)} ${(w + pad * 2).toFixed(2)} ${(hgt + pad * 2).toFixed(2)}`,
    paths,
    mark,
  }
}
