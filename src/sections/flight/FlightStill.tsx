import { flightLabels } from '../../content/flight'

/* ============================================================================
   FlightStill — the passage, printed once
   ----------------------------------------------------------------------------
   What a reader sees when there is no canvas: reduced motion, no WebGL, or a
   context that was lost mid-flight. It is not a degraded scene — it is the same
   composition stopped: a corridor ruled from its vanishing point, labels at six
   depths, the far ones broken into the ordered screen, and the ink block.

   Two layouts, because the plate is two different plates. The wide one is a
   landscape sheet with its vanishing point right of centre; the narrow one is a
   vertical shaft composed for a phone, not the landscape cropped. The CSS picks
   one, so neither is ever a compromise of the other.

   The screen is the same arithmetic as the shader and the veil: the 8 × 8 Bayer
   matrix as a 64-level alpha ramp, so a masked label reads as a halftone rather
   than as damage.
   ========================================================================== */

const L = flightLabels

type StillLabel = {
  text: string
  x: number
  y: number
  size: number
  /** Rest opacity. The far group is also screened. */
  opacity: number
  near: boolean
}

type Layout = {
  id: string
  className: string
  width: number
  height: number
  vanish: readonly [number, number]
  rays: readonly (readonly [number, number])[]
  labels: StillLabel[]
}

/** One screen cell, in user units. Eight of them are one matrix. */
const CELL = 3

/** 8 × 8 ranks → a per-cell alpha ramp. Same recursion as `bayer.ts`, local. */
const SCREEN = (() => {
  const seed = (x: number, y: number) => (2 * x + 3 * y) % 4
  const cells: { x: number; y: number; opacity: number }[] = []
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const lo = seed(x % 2, y % 2)
      const mid = seed(Math.floor(x / 2) % 2, Math.floor(y / 2) % 2)
      const hi = seed(Math.floor(x / 4), Math.floor(y / 4))
      const rank = 16 * lo + 4 * mid + hi
      cells.push({ x: x * CELL, y: y * CELL, opacity: (rank + 0.5) / 64 })
    }
  }
  return cells
})()

const WIDE: Layout = {
  id: 'flt-wide',
  className: 'flt__still flt__still--wide',
  width: 1000,
  height: 640,
  vanish: [560, 300],
  rays: [
    [0, 86],
    [0, 244],
    [0, 556],
    [1000, 96],
    [1000, 344],
    [1000, 640],
  ],
  labels: [
    { text: L[14], x: 470, y: 214, size: 10.5, opacity: 0.52, near: false },
    { text: L[2], x: 600, y: 238, size: 11.5, opacity: 0.46, near: false },
    { text: L[1], x: 392, y: 268, size: 13, opacity: 0.56, near: false },
    { text: L[13], x: 296, y: 234, size: 12, opacity: 0.44, near: false },
    { text: L[9], x: 700, y: 300, size: 16, opacity: 0.78, near: true },
    { text: L[7], x: 288, y: 330, size: 22, opacity: 0.92, near: true },
    { text: L[0], x: 536, y: 336, size: 20, opacity: 0.86, near: true },
    { text: L[11], x: 678, y: 430, size: 27, opacity: 0.96, near: true },
    { text: L[21], x: 516, y: 480, size: 18, opacity: 0.74, near: true },
  ],
}

const NARROW: Layout = {
  id: 'flt-narrow',
  className: 'flt__still flt__still--narrow',
  width: 480,
  height: 900,
  vanish: [240, 300],
  rays: [
    [0, 110],
    [0, 430],
    [0, 900],
    [480, 126],
    [480, 470],
  ],
  labels: [
    { text: L[14], x: 208, y: 188, size: 10, opacity: 0.52, near: false },
    { text: L[2], x: 302, y: 212, size: 10.5, opacity: 0.46, near: false },
    { text: L[1], x: 140, y: 238, size: 12, opacity: 0.56, near: false },
    { text: L[13], x: 306, y: 282, size: 11, opacity: 0.44, near: false },
    { text: L[9], x: 246, y: 334, size: 16, opacity: 0.78, near: true },
    { text: L[7], x: 96, y: 392, size: 21, opacity: 0.92, near: true },
    { text: L[0], x: 250, y: 424, size: 19, opacity: 0.86, near: true },
    { text: L[11], x: 176, y: 486, size: 24, opacity: 0.96, near: true },
    { text: L[21], x: 104, y: 528, size: 15, opacity: 0.72, near: true },
  ],
}

function StillText({ label }: { label: StillLabel }) {
  // Mono advance ≈ 0.6 em; the rule under the label is the same one the atlas
  // draws, so the still and the canvas share a typographic unit.
  const width = label.size * 0.6 * label.text.length
  const rule = label.y + label.size * 0.34

  return (
    <g opacity={label.opacity}>
      <text x={label.x} y={label.y} fontSize={label.size}>
        {label.text}
      </text>
      <line
        className="flt-still__rule"
        x1={label.x}
        y1={rule}
        x2={label.x + width}
        y2={rule}
      />
      <line
        className="flt-still__rule"
        x1={label.x}
        y1={rule}
        x2={label.x}
        y2={rule + label.size * 0.24}
      />
    </g>
  )
}

function Plate({ layout }: { layout: Layout }) {
  const screen = `${layout.id}-screen`
  const mask = `${layout.id}-mask`
  const [vx, vy] = layout.vanish
  const far = layout.labels.filter((label) => !label.near)
  const near = layout.labels.filter((label) => label.near)

  return (
    <svg
      className={layout.className}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={screen}
          width={8 * CELL}
          height={8 * CELL}
          patternUnits="userSpaceOnUse"
        >
          {SCREEN.map((cell) => (
            <rect
              key={`${cell.x}-${cell.y}`}
              x={cell.x}
              y={cell.y}
              width={CELL}
              height={CELL}
              fill="#ffffff"
              opacity={cell.opacity}
            />
          ))}
        </pattern>
        <mask
          id={mask}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={layout.width}
          height={layout.height}
        >
          <rect width={layout.width} height={layout.height} fill={`url(#${screen})`} />
        </mask>
      </defs>

      <g className="flt-still__rays">
        {layout.rays.map(([x, y]) => (
          <line key={`${x}-${y}`} x1={vx} y1={vy} x2={x} y2={y} />
        ))}
      </g>

      {/* Far plates are printed through the screen; near plates are ink. */}
      <g mask={`url(#${mask})`}>
        {far.map((label) => (
          <StillText key={`${label.text}-${label.x}`} label={label} />
        ))}
      </g>
      <g>
        {near.map((label) => (
          <StillText key={`${label.text}-${label.x}`} label={label} />
        ))}
      </g>
    </svg>
  )
}

export default function FlightStill() {
  return (
    <>
      <Plate layout={WIDE} />
      <Plate layout={NARROW} />
    </>
  )
}
