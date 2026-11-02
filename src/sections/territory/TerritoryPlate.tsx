import {
  ENTRY_ID,
  EXIT_ID,
  territoryGroups,
  territoryLinks,
  territoryStations,
  type MarkKind,
  type TerritoryCopy,
  type TierId,
} from '../../content/territory'

/* ============================================================================
   The plate, as a drawing
   ----------------------------------------------------------------------------
   This is the fallback, not the section. It is what a reader gets when WebGL is
   missing, when the renderer throws, or when the context is lost mid-session —
   and it is what sits behind the canvas for the first frame, so the section is
   never an empty box.

   It is built from the same data as the scene: the same stations, the same
   links, the same hosting ties. A fallback that is hand-placed drifts from the
   thing it stands in for, and a survey that drifts is wrong on purpose. Everything
   here is static: a fallback that animates is a second motion system to maintain,
   and the register that follows carries the same inventory as text.
   ========================================================================== */

/** The three plan rules. Marks hang off them; the concerns sit below. */
const BAND: Record<TierId, number> = { edge: 108, fabric: 214, services: 320 }

const PLAN_X = 4.5
const LEFT = 92
const WIDTH = 836
const SKEW = 7

const sx = (x: number): number => LEFT + ((x + PLAN_X) / (2 * PLAN_X)) * WIDTH
const sy = (tier: TierId, z: number): number => BAND[tier] - z * SKEW

/** A cross for a place, a filled square for something served, a ring for the control point. */
function Glyph({ kind, x, y }: { kind: MarkKind; x: number; y: number }) {
  if (kind === 'service') {
    return (
      <rect className="survey-glyph survey-glyph--square" x={x - 3.5} y={y - 3.5} width={7} height={7} />
    )
  }

  if (kind === 'control') {
    return (
      <g>
        <circle className="survey-glyph survey-glyph--ring" cx={x} cy={y} r={12} />
        <path className="survey-glyph" d={`M${x - 5} ${y}H${x + 5}M${x} ${y - 5}V${y + 5}`} />
      </g>
    )
  }

  return <path className="survey-glyph" d={`M${x - 6} ${y}H${x + 6}M${x} ${y - 6}V${y + 6}`} />
}

type Props = {
  copy: TerritoryCopy
  label: (id: string) => string
}

export default function TerritoryPlate({ copy, label }: Props) {
  const byId = new Map(territoryStations.map((station) => [station.id, station]))
  const at = (id: string) => {
    const station = byId.get(id)
    if (!station) return null
    return { x: sx(station.x), y: sy(station.tier, station.z) }
  }

  const opnsense = at('opnsense')
  const pbs = at('pbs')
  const entry = opnsense ? { x: opnsense.x, y: BAND.edge - 40 } : null
  const exit = pbs ? { x: pbs.x + 58, y: pbs.y } : null

  const concerns = territoryGroups.filter((group) => group.kind === 'concern')
  const tiers: TierId[] = ['edge', 'fabric', 'services']

  return (
    <svg
      className="tty-plate__svg"
      viewBox="0 0 1000 512"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <g>
        <path className="survey-rule" d="M36 26H964" />
        <path className="survey-rule" d="M36 486H964" />
      </g>

      {/* The links, before anything else: the marks sit on top of their ends. */}
      <g>
        {territoryLinks.map((link) => {
          const a = at(link.a) ?? (link.a === ENTRY_ID ? entry : link.a === EXIT_ID ? exit : null)
          const b = at(link.b) ?? (link.b === ENTRY_ID ? entry : link.b === EXIT_ID ? exit : null)
          if (!a || !b) return null

          // The hosting tie: a short peg towards the node, not a line that
          // reaches it. Ten of them would close the sheet into a comb.
          if (link.kind === 'host') {
            const dx = b.x - a.x
            const dy = b.y - a.y
            const len = Math.hypot(dx, dy) || 1
            const reach = 17 / len
            return (
              <path
                className="survey-link survey-link--tie"
                key={`${link.a}-${link.b}`}
                d={`M${a.x} ${a.y}L${a.x + dx * reach} ${a.y + dy * reach}`}
              />
            )
          }

          return (
            <path
              className={
                link.kind === 'backup' ? 'survey-link survey-link--dashed' : 'survey-link'
              }
              key={`${link.a}-${link.b}`}
              d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
            />
          )
        })}
      </g>

      {/* The two ends of the sheet: the way in, and where the copies leave. */}
      {entry && opnsense ? (
        <g>
          <path className="survey-link" d={`M${entry.x} ${entry.y - 18}V${opnsense.y - 14}`} />
          <text className="survey-note" x={entry.x} y={entry.y - 24} textAnchor="middle">
            {copy.annotations.entry}
          </text>
        </g>
      ) : null}
      {exit && pbs ? (
        <g>
          <path className="survey-link survey-link--dashed" d={`M${pbs.x + 6} ${pbs.y}H${exit.x - 8}`} />
          <text className="survey-note" x={exit.x} y={exit.y + 4}>
            {copy.annotations.exit}
          </text>
        </g>
      ) : null}

      {tiers.map((tier) => (
        <g className="survey-tier" data-tier={tier} key={tier}>
          <text className="survey-tier__name" x="40" y={BAND[tier] - 20}>
            {label(tier)}
          </text>
          <path className="survey-rule" d={`M${LEFT - 16} ${BAND[tier] - 24}H${LEFT + WIDTH}`} />
        </g>
      ))}

      {territoryStations.map((station) => {
        const p = at(station.id)
        if (!p) return null
        // The edge row's fan leaves each mark downwards, so its names set to the
        // right of the mark; everything else is named below, clear of the rules.
        const beside = station.tier === 'edge'
        return (
          <g className="survey-node" key={station.id}>
            <Glyph kind={station.kind} x={p.x} y={p.y} />
            <text
              className="survey-node__label"
              x={beside ? p.x + 13 : p.x}
              y={beside ? p.y + 4 : p.y + 22}
              textAnchor={beside ? 'start' : 'middle'}
            >
              {station.id}
            </text>
          </g>
        )
      })}

      {/* The plan closes here; what follows is true at every level of it. */}
      <g>
        <path className="survey-rule" d={`M36 356H964`} />
        <text className="survey-note" x="964" y="348" textAnchor="end">
          {copy.concernsLabel}
        </text>
      </g>

      {concerns.map((group, index) => {
        const y = 384 + index * 34
        return (
          <g className="survey-tier" data-tier={group.id} key={group.id}>
            <text className="survey-tier__key" x="40" y={y}>
              {label(group.id)}
            </text>
            <path className="survey-rule survey-rule--quiet" d={`M36 ${y + 8}H964`} />
            <text className="survey-node__label" x="150" y={y}>
              {group.nodes.join(' · ')}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
