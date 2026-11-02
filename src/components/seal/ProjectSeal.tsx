import './seal.css'

/* ============================================================================
   ProjectSeal — a survey mark cut from the project's own name
   ----------------------------------------------------------------------------
   This is a station plot on a sheet, not a badge and not a QR code: a fixed
   7 x 7 contour lattice, a short self-avoiding ink trace through it, and one
   crimson mark on the last station the trace reaches.

   Why it is deterministic. The only inputs are `slug` and the drawing grid.
   The seed is FNV-1a over the slug's code units, the choices come from an LCG
   whose state is a uint32 advanced with `Math.imul`, and the walk's branch is
   decided by `step() % options.length`. No `Math.random`, no clock, no
   `window`, no state: the same slug renders byte-identical markup on the
   server and in the browser, and again on the next deploy.

   Why the walk is self-avoiding. A trace that revisits a station doubles back
   over its own ink and prints a blob; a survey line only reads as a line if
   every station is visited once. So visited cells are excluded from the
   neighbour options, and when the walk is boxed in it jumps to the nearest
   unvisited station (Manhattan, lowest cell index on a tie) rather than
   retracing. That also fixes the dot count exactly: 15 to 19 stations, every
   time — 14 to 18 of them in ink, plus the single crimson mark.

   The lattice is drawn as one circle per station. A walked station is not a
   second circle stacked on a base dot — it is the same circle with the ink
   class — so no centre is ever painted twice, and the last station carries
   `seal__dot--mark` instead of `seal__dot--ink`.
   ========================================================================== */

const GRID = 7
const FIRST = 12
const PITCH = 12
const MIN_STATIONS = 15
const STATION_SPREAD = 5

type Cell = { col: number; row: number }

/** FNV-1a, 32-bit, over the slug's UTF-16 code units. */
function hash(slug: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** One LCG, one uint32 state, one step per call. */
function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state
  }
}

function indexOf(cell: Cell): number {
  return cell.row * GRID + cell.col
}

/** Unvisited orthogonal neighbours, in reading order, so `step() % n` is stable. */
function neighbours(current: Cell, visited: Set<number>): Cell[] {
  const offsets: ReadonlyArray<readonly [number, number]> = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]
  const options: Cell[] = []
  for (const [dCol, dRow] of offsets) {
    const col = current.col + dCol
    const row = current.row + dRow
    if (col < 0 || col >= GRID || row < 0 || row >= GRID) continue
    if (visited.has(row * GRID + col)) continue
    options.push({ col, row })
  }
  return options
}

/** Nearest unvisited station; ascending index scan plus a strict compare keeps the lowest index on a tie. */
function nearestUnvisited(current: Cell, visited: Set<number>): Cell {
  let best: Cell = current
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < GRID * GRID; index += 1) {
    if (visited.has(index)) continue
    const col = index % GRID
    const row = (index - col) / GRID
    const distance = Math.abs(col - current.col) + Math.abs(row - current.row)
    if (distance < bestDistance) {
      bestDistance = distance
      best = { col, row }
    }
  }
  return best
}

/** The trace, in visit order, always starting at the top-left station. */
function walk(slug: string): Cell[] {
  const seed = hash(slug)
  const step = lcg(seed)
  const target = MIN_STATIONS + (seed % STATION_SPREAD)
  const path: Cell[] = [{ col: 0, row: 0 }]
  const visited = new Set<number>([0])

  while (path.length < target) {
    const current = path[path.length - 1]
    const options = neighbours(current, visited)
    const next = options.length > 0 ? options[step() % options.length] : nearestUnvisited(current, visited)
    visited.add(indexOf(next))
    path.push(next)
  }

  return path
}

type ProjectSealProps = { slug: string; size?: number; className?: string }

export default function ProjectSeal({ slug, size = 96, className }: ProjectSealProps) {
  const path = walk(slug)
  const last = path[path.length - 1]
  const markIndex = indexOf(last)
  const ink = new Set(path.slice(0, -1).map(indexOf))

  return (
    <svg
      className={'seal' + (className ? ' ' + className : '')}
      viewBox="0 0 96 96"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        className="seal__frame"
        x="0.5"
        y="0.5"
        width="95"
        height="95"
        vectorEffect="non-scaling-stroke"
      />
      {Array.from({ length: GRID * GRID }, (_, index) => {
        const col = index % GRID
        const row = (index - col) / GRID
        const dotClass =
          index === markIndex
            ? 'seal__dot seal__dot--mark'
            : ink.has(index)
              ? 'seal__dot seal__dot--ink'
              : 'seal__dot'
        return (
          <circle
            key={index}
            className={dotClass}
            cx={FIRST + col * PITCH}
            cy={FIRST + row * PITCH}
            r="1"
          />
        )
      })}
      <path
        className="seal__cross"
        d="M6 2.5V9.5M2.5 6H9.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
