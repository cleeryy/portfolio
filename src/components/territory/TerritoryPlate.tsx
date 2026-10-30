import type { TerritoryCopy } from '../../content/territory'

/* ============================================================================
   The plate, as a drawing
   ----------------------------------------------------------------------------
   This is the fallback, not the section. It is what a reader gets when WebGL is
   missing, when the renderer throws, or when the context is lost mid-session —
   and it is what sits behind the canvas for the first frame, so the section is
   never an empty box.

   It is the same survey the scene draws, flattened: three strata hung from
   labelled rules, the cross-cutting concerns below. Everything here is static
   on purpose: a fallback that animates is a second motion system to maintain,
   and the register that follows carries the same inventory as text.
   ========================================================================== */

type MarkKind = 'station' | 'service' | 'control'
type LabelPlacement = 'below' | 'right' | 'aboveRight'

type StationSpec = {
  id: string
  x: number
  y: number
  kind: MarkKind
  label: LabelPlacement
  /** Datum the station hangs from. Omitted when the station sits on a path. */
  from?: number
}

const EDGE: StationSpec[] = [
  { id: 'opnsense', x: 190, y: 112, kind: 'control', label: 'right' },
  { id: 'wireguard', x: 360, y: 112, kind: 'station', label: 'below', from: 88 },
  { id: 'warpgate', x: 530, y: 112, kind: 'station', label: 'below', from: 88 },
  { id: 'adguard', x: 700, y: 112, kind: 'station', label: 'below', from: 88 },
  { id: 'technitium', x: 870, y: 112, kind: 'station', label: 'below', from: 88 },
]

const FABRIC: StationSpec[] = [
  { id: 'pve1', x: 300, y: 250, kind: 'station', label: 'below' },
  { id: 'pve3', x: 560, y: 250, kind: 'station', label: 'below' },
  { id: 'vzdump', x: 620, y: 320, kind: 'service', label: 'below' },
  { id: 'pbs', x: 760, y: 320, kind: 'service', label: 'below' },
]

const SERVICES: StationSpec[] = [
  { id: 'nextcloud', x: 230, y: 416, kind: 'service', label: 'below', from: 392 },
  { id: 'immich', x: 365, y: 416, kind: 'service', label: 'below', from: 392 },
  { id: 'jellyfin', x: 500, y: 416, kind: 'service', label: 'below', from: 392 },
  { id: 'forgejo', x: 635, y: 416, kind: 'service', label: 'below', from: 392 },
  { id: 'matrix', x: 770, y: 416, kind: 'service', label: 'below', from: 392 },
  { id: 'mealboard', x: 905, y: 416, kind: 'service', label: 'below', from: 392 },
]

const IDENTITY: StationSpec[] = [
  { id: 'authentik', x: 290, y: 530, kind: 'service', label: 'aboveRight' },
  { id: 'infisical', x: 450, y: 530, kind: 'service', label: 'aboveRight' },
  { id: 'wazuh', x: 610, y: 530, kind: 'service', label: 'aboveRight' },
]

const SIGNAL: StationSpec[] = [
  { id: 'prometheus', x: 290, y: 570, kind: 'service', label: 'aboveRight' },
  { id: 'grafana', x: 450, y: 570, kind: 'service', label: 'aboveRight' },
  { id: 'beszel', x: 610, y: 570, kind: 'service', label: 'aboveRight' },
  { id: 'scraparr', x: 770, y: 570, kind: 'service', label: 'aboveRight' },
]

const DELIVERY: StationSpec[] = [
  { id: 'dokploy', x: 290, y: 610, kind: 'service', label: 'aboveRight' },
  { id: 'caddy', x: 450, y: 610, kind: 'service', label: 'aboveRight' },
  { id: 'github-actions', x: 610, y: 610, kind: 'service', label: 'aboveRight' },
  { id: 'n8n', x: 770, y: 610, kind: 'service', label: 'aboveRight' },
  { id: 'umami', x: 930, y: 610, kind: 'service', label: 'aboveRight' },
]

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

function Station({ tier, spec }: { tier: string; spec: StationSpec }) {
  const { id, x, y, kind, label, from } = spec
  const anchor = label === 'below' ? 'middle' : 'start'
  const labelX = label === 'below' ? x : x + (label === 'right' ? 16 : 9)
  const labelY = label === 'below' ? y + 26 : label === 'right' ? y + 4 : y - 13

  return (
    <g className="survey-node" data-tier={tier}>
      {from !== undefined ? (
        <path className="survey-link" d={`M${x} ${from}V${y - 7}`} />
      ) : null}
      <Glyph kind={kind} x={x} y={y} />
      <text className="survey-node__label" x={labelX} y={labelY} textAnchor={anchor}>
        {id}
      </text>
    </g>
  )
}

function TierStations({ tier, specs }: { tier: string; specs: StationSpec[] }) {
  return (
    <>
      {specs.map((spec) => (
        <Station key={spec.id} tier={tier} spec={spec} />
      ))}
    </>
  )
}

type Props = {
  copy: TerritoryCopy
  label: (id: string) => string
}

export default function TerritoryPlate({ copy, label }: Props) {
  return (
    <svg
      className="tty-plate__svg"
      viewBox="0 0 1040 690"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {/* The sheet: two neatline rules. Everything else hangs between them. */}
      <g>
        <path className="survey-rule" d="M36 40H1004" />
        <path className="survey-rule" d="M36 650H1004" />
      </g>

      {/* EDGE — where the outside ends. The crossing comes from off-sheet. */}
      <g className="survey-tier" data-tier="edge">
        <text className="survey-tier__name" x="36" y="80">
          {label('edge')}
        </text>
        <path className="survey-rule" d="M36 88H1004" />
        <path className="survey-link" d="M190 14V100" />
        <path className="survey-link" d="M190 124V200" />
        <text className="survey-note" x="200" y="22">
          {copy.annotations.entry}
        </text>
        <TierStations tier="edge" specs={EDGE} />
      </g>

      {/* FABRIC — what everything sits on. */}
      <g className="survey-tier" data-tier="fabric">
        <text className="survey-tier__name" x="36" y="192">
          {label('fabric')}
        </text>
        <path className="survey-rule" d="M36 200H1004" />
        <path className="survey-link" d="M430 200V246" />
        <path className="survey-link" d="M300 246H560" />
        <path className="survey-link" d="M300 254H560" />
        <text className="survey-note" x="414" y="238" textAnchor="end">
          {copy.annotations.cluster}
        </text>
        <path className="survey-link survey-link--dashed" d="M520 254V320H1032" />
        <text className="survey-note" x="528" y="304">
          {copy.annotations.backup}
        </text>
        <text className="survey-note" x="1004" y="342" textAnchor="end">
          {copy.annotations.exit}
        </text>
        <path className="survey-link" d="M430 254V392" />
        <TierStations tier="fabric" specs={FABRIC} />
      </g>

      {/* SERVICES — what gets used every day, on one bus. */}
      <g className="survey-tier" data-tier="services">
        <text className="survey-tier__name" x="36" y="384">
          {label('services')}
        </text>
        <path className="survey-rule" d="M36 392H1004" />
        <TierStations tier="services" specs={SERVICES} />
      </g>

      {/* The plan closes here; what follows is true at every level of it. */}
      <g>
        <path className="survey-rule" d="M36 480H1004" />
        <text className="survey-note" x="1004" y="468" textAnchor="end">
          {copy.concernsLabel}
        </text>
      </g>

      <g className="survey-tier" data-tier="identity">
        <text className="survey-tier__key" x="36" y="517">
          {label('identity')}
        </text>
        <path className="survey-rule survey-rule--quiet" d="M36 530H1004" />
        <TierStations tier="identity" specs={IDENTITY} />
      </g>

      <g className="survey-tier" data-tier="signal">
        <text className="survey-tier__key" x="36" y="557">
          {label('signal')}
        </text>
        <path className="survey-rule survey-rule--quiet" d="M36 570H1004" />
        <TierStations tier="signal" specs={SIGNAL} />
      </g>

      <g className="survey-tier" data-tier="delivery">
        <text className="survey-tier__key" x="36" y="597">
          {label('delivery')}
        </text>
        <path className="survey-rule survey-rule--quiet" d="M36 610H1004" />
        <TierStations tier="delivery" specs={DELIVERY} />
      </g>
    </svg>
  )
}
