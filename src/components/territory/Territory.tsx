import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLang } from '../../lib/i18n'
import {
  territoryCopy,
  territoryGroups,
  territorySummary,
  type LegendKey,
} from '../../content/territory'
import './territory.css'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================================
   The plate
   ----------------------------------------------------------------------------
   A survey sheet, 1040 × 690 user units, rendered between ~916 and 1216 CSS px.
   A 12-unit annotation therefore lands between 10.6 and 14 px: the drawing can
   never fall to the 9px the design forbids. Below 1000px the sheet gives way to
   the register, which is the same information recomposed as a vertical section
   rather than a shrunken image.

   Three strata hang from labelled rules (edge → fabric → services); the three
   concerns are rows that cut across them, drawn lighter, because they are not
   layers of the path — they are true at every level.
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

/** Station glyphs: a cross for a place, a square for something served, a ring for a control point. */
function Glyph({ kind, x, y }: { kind: MarkKind; x: number; y: number }) {
  if (kind === 'service') {
    return (
      <rect
        className="survey-glyph survey-glyph--square"
        data-mark=""
        x={x - 3.5}
        y={y - 3.5}
        width={7}
        height={7}
      />
    )
  }

  if (kind === 'control') {
    return (
      <g data-mark="">
        <circle className="survey-glyph survey-glyph--ring" cx={x} cy={y} r={12} />
        <path className="survey-glyph" d={`M${x - 5} ${y}H${x + 5}M${x} ${y - 5}V${y + 5}`} />
      </g>
    )
  }

  return <path className="survey-glyph" data-mark="" d={`M${x - 6} ${y}H${x + 6}M${x} ${y - 6}V${y + 6}`} />
}

function Station({ tier, spec }: { tier: string; spec: StationSpec }) {
  const { id, x, y, kind, label, from } = spec
  const anchor = label === 'below' ? 'middle' : 'start'
  const labelX = label === 'below' ? x : x + (label === 'right' ? 16 : 9)
  const labelY = label === 'below' ? y + 26 : label === 'right' ? y + 4 : y - 13

  // A hit area wide enough for the mark and the label, so the whole station can
  // be pointed at — but nothing is clickable, so no cursor or affordance is added.
  const hit =
    label === 'below'
      ? { x: x - 46, y: y - 16, width: 92, height: 34 }
      : label === 'right'
        ? { x: x - 16, y: y - 15, width: 124, height: 30 }
        : { x: x - 10, y: y - 21, width: 116, height: 26 }

  return (
    <g className="survey-node" data-tier={tier}>
      <rect className="survey-node__hit" {...hit} />
      {from !== undefined ? (
        <path className="survey-link" data-line="" pathLength={1} d={`M${x} ${from}V${y - 7}`} />
      ) : null}
      <Glyph kind={kind} x={x} y={y} />
      <text className="survey-node__label" data-label="" x={labelX} y={labelY} textAnchor={anchor}>
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

function LegendGlyph({ kind }: { kind: LegendKey }) {
  return (
    <svg className="tty__legend-glyph" viewBox="0 0 20 10" width="20" height="10" aria-hidden="true" focusable="false">
      {kind === 'station' ? <path className="survey-glyph" d="M10 1V9M6 5H14" /> : null}
      {kind === 'service' ? (
        <rect className="survey-glyph survey-glyph--square" x="6.5" y="1.5" width="7" height="7" />
      ) : null}
      {kind === 'control' ? (
        <>
          <circle className="survey-glyph survey-glyph--ring" cx="10" cy="5" r="4.5" />
          <path className="survey-glyph" d="M10 2.5V7.5M7.5 5H12.5" />
        </>
      ) : null}
      {kind === 'cluster' ? (
        <>
          <path className="survey-glyph" d="M1 3.5H19" />
          <path className="survey-glyph" d="M1 6.5H19" />
        </>
      ) : null}
      {kind === 'backup' ? <path className="survey-glyph survey-glyph--dashed" d="M1 5H19" /> : null}
    </svg>
  )
}

/**
 * The territory, at full size.
 *
 * The drawing is a data graphic built from a station table, not an illustration.
 * Every mark on it is a thing that exists, taken from the operator's own config.
 * The same inventory follows as a register so the section survives a failed SVG,
 * a text selection, or a screen reader.
 */
export default function Territory() {
  const { pick } = useLang()
  const copy = pick(territoryCopy)
  const rootRef = useRef<HTMLElement | null>(null)
  const plateRef = useRef<HTMLDivElement | null>(null)

  const groups = new Map(territoryGroups.map((group) => [group.id, group]))
  const label = (id: string) => {
    const group = groups.get(id)
    return group ? pick(group.label) : id
  }

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      // 1. The plate draws itself: rules first, then the connectors of each
      // stratum, then the marks and the station names. Staggered by tier.
      const tiers = gsap.utils.toArray<SVGGElement>('.survey-tier')

      for (const tier of tiers) {
        // The dash pattern itself is CSS (`stroke-dasharray: 1` against
        // `pathLength="1"`), so a failed script leaves every line fully drawn:
        // only the offset is animated, and only when the script is alive.
        const lines = tier.querySelectorAll('[data-line]')
        const rest = tier.querySelectorAll('[data-mark], [data-label]')
        if (lines.length > 0) gsap.set(lines, { strokeDashoffset: 1 })
        if (rest.length > 0) gsap.set(rest, { opacity: 0 })
      }

      const draw = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } })

      tiers.forEach((tier, index) => {
        const lines = tier.querySelectorAll('[data-line]')
        const rest = tier.querySelectorAll('[data-mark], [data-label]')
        const at = index * 0.11
        if (lines.length > 0) {
          draw.to(lines, { strokeDashoffset: 0, duration: 0.72, stagger: 0.012 }, at)
        }
        if (rest.length > 0) {
          draw.to(
            rest,
            { opacity: 1, duration: 0.42, stagger: 0.008, ease: 'power1.out' },
            at + 0.28,
          )
        }
      })

      if (plateRef.current) {
        const plate = ScrollTrigger.create({
          trigger: plateRef.current,
          start: 'top 82%',
          once: true,
          onEnter: () => draw.play(),
        })
        // Deep links land past the trigger; ScrollTrigger only fires on enter.
        if (plate.progress > 0) draw.play()
      }

      // 2. The register: each row's rule builds left to right, the row's text
      // arrives after it. One trigger for the whole block, staggered by row.
      const rows = gsap.utils.toArray<HTMLElement>('.tty__group')
      if (rows.length > 0) {
        gsap.set(
          rows.map((row) => row.querySelector('.tty__group-rule')),
          { scaleX: 0 },
        )
        gsap.set(
          rows.flatMap((row) => Array.from(row.querySelectorAll<HTMLElement>('[data-reveal]'))),
          { opacity: 0, y: 10 },
        )

        const register = gsap.timeline({
          scrollTrigger: { trigger: '.tty__register', start: 'top 88%', once: true },
        })

        rows.forEach((row, index) => {
          const at = index * 0.07
          register.to(
            row.querySelector('.tty__group-rule'),
            { scaleX: 1, duration: 0.56, ease: 'power2.inOut' },
            at,
          )
          register.to(
            row.querySelectorAll('[data-reveal]'),
            { opacity: 1, y: 0, duration: 0.42, stagger: 0.04, ease: 'power2.out' },
            at + 0.12,
          )
        })
      }
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section className="tty" id="territory" aria-labelledby="territory-title" ref={rootRef}>
      <div className="tty__inner">
        <header className="tty__head">
          <p className="tty__ref mono" aria-hidden="true">
            #territory
          </p>

          <h2 className="tty__title" id="territory-title">
            {copy.title}
          </h2>

          <p className="tty__lead">{copy.lead}</p>

          <div className="tty__counts">
            <dl>
              <div>
                <dt>{copy.countLabels.published}</dt>
                <dd>{territorySummary.exposedPublicHosts}</dd>
              </div>
              <div>
                <dt>{copy.countLabels.internal}</dt>
                <dd>{territorySummary.internalHosts}</dd>
              </div>
            </dl>
            <p className="tty__counts-source mono">{pick(territorySummary.source)}</p>
          </div>
        </header>

        <figure className="tty__plate">
          <figcaption className="tty__plate-head">
            <span className="mono">{copy.plateLabel}</span>
            <span className="mono">{copy.plateScale}</span>
          </figcaption>

          <div className="tty__plate-body" ref={plateRef}>
            <svg
              className="survey"
              viewBox="0 0 1040 690"
              role="img"
              aria-labelledby="survey-title"
              aria-describedby="survey-desc"
            >
              <title id="survey-title">{copy.diagramTitle}</title>
              <desc id="survey-desc">{copy.diagramDesc}</desc>

              {/* The sheet: two neatline rules. Everything else hangs between them. */}
              <g className="survey-tier">
                <path className="survey-rule" data-line="" pathLength={1} d="M36 40H1004" />
                <path className="survey-rule" data-line="" pathLength={1} d="M36 650H1004" />
              </g>

              {/* EDGE — where the outside ends. The crossing comes from off-sheet. */}
              <g className="survey-tier" data-tier="edge">
                <text className="survey-tier__name" data-label="" x="36" y="80">
                  {label('edge')}
                </text>
                <path className="survey-rule" data-line="" pathLength={1} d="M36 88H1004" />
                <path className="survey-link" data-line="" pathLength={1} d="M190 14V100" />
                <path className="survey-link" data-line="" pathLength={1} d="M190 124V200" />
                <text className="survey-note" data-label="" x="200" y="22">
                  {copy.annotations.public}
                </text>
                <TierStations tier="edge" specs={EDGE} />
              </g>

              {/* FABRIC — what everything sits on. Cluster link, backup path, feed. */}
              <g className="survey-tier" data-tier="fabric">
                <text className="survey-tier__name" data-label="" x="36" y="192">
                  {label('fabric')}
                </text>
                <path className="survey-rule" data-line="" pathLength={1} d="M36 200H1004" />
                {/* One trunk through the cluster's midpoint: in from the edge
                    above, out to the services below. Two spurs here would close
                    the drawing into a box and say nothing extra. */}
                <path className="survey-link" data-line="" pathLength={1} d="M430 200V246" />
                <path className="survey-link" data-line="" pathLength={1} d="M300 246H560" />
                <path className="survey-link" data-line="" pathLength={1} d="M300 254H560" />
                <text className="survey-note" data-label="" x="414" y="238" textAnchor="end">
                  {copy.annotations.cluster}
                </text>
                {/* The backup path stays dashed, so it cannot be revealed by its
                    own dash pattern. A mask holds a solid copy of the same line:
                    that copy draws, and the dashes appear behind it. */}
                <mask
                  id="survey-backup-reveal"
                  maskUnits="userSpaceOnUse"
                  maskContentUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width="1040"
                  height="690"
                >
                  <path d="M520 254V320H1040" fill="none" stroke="white" strokeWidth={3} pathLength={1} data-line="" />
                </mask>
                <path
                  className="survey-link survey-link--dashed"
                  d="M520 254V320H1040"
                  mask="url(#survey-backup-reveal)"
                />
                <text className="survey-note" data-label="" x="528" y="304">
                  {copy.annotations.backup}
                </text>
                <text className="survey-note" data-label="" x="996" y="342" textAnchor="end">
                  {copy.annotations.offSite}
                </text>
                <path className="survey-link" data-line="" pathLength={1} d="M430 254V392" />
                <TierStations tier="fabric" specs={FABRIC} />
              </g>

              {/* SERVICES — what gets used every day, on one bus. */}
              <g className="survey-tier" data-tier="services">
                <text className="survey-tier__name" data-label="" x="36" y="384">
                  {label('services')}
                </text>
                <path className="survey-rule" data-line="" pathLength={1} d="M36 392H1004" />
                <TierStations tier="services" specs={SERVICES} />
              </g>

              {/* The plan closes here; what follows is true at every level of it. */}
              <g className="survey-tier">
                <path className="survey-rule" data-line="" pathLength={1} d="M36 480H1004" />
                <text className="survey-note" data-label="" x="1004" y="468" textAnchor="end">
                  {copy.concernsLabel}
                </text>
              </g>

              {/* CONCERNS — three annotation rows, drawn lighter than the strata. */}
              <g className="survey-tier" data-tier="identity">
                <text className="survey-tier__key" data-label="" x="36" y="517">
                  {label('identity')}
                </text>
                <path className="survey-rule survey-rule--quiet" data-line="" pathLength={1} d="M36 530H1004" />
                <TierStations tier="identity" specs={IDENTITY} />
              </g>

              <g className="survey-tier" data-tier="signal">
                <text className="survey-tier__key" data-label="" x="36" y="557">
                  {label('signal')}
                </text>
                <path className="survey-rule survey-rule--quiet" data-line="" pathLength={1} d="M36 570H1004" />
                <TierStations tier="signal" specs={SIGNAL} />
              </g>

              <g className="survey-tier" data-tier="delivery">
                <text className="survey-tier__key" data-label="" x="36" y="597">
                  {label('delivery')}
                </text>
                <path className="survey-rule survey-rule--quiet" data-line="" pathLength={1} d="M36 610H1004" />
                <TierStations tier="delivery" specs={DELIVERY} />
              </g>
            </svg>
          </div>

          <ul className="tty__legend" role="list" aria-label={copy.legendLabel}>
            {copy.legend.map((item) => (
              <li key={item.key}>
                <LegendGlyph kind={item.key} />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </figure>

        <div className="tty__register">
          <div className="tty__register-head">
            <p className="mono">{copy.registerLabel}</p>
            <p className="mono">{copy.registerNote}</p>
          </div>

          <ol className="tty__list" role="list">
            {territoryGroups.map((group) => (
              <li className="tty__group" key={group.id}>
                <span className="tty__group-rule" aria-hidden="true" />
                <div className="tty__group-head" data-reveal="">
                  <h3 className="tty__group-key mono">{pick(group.label)}</h3>
                  <p className="tty__group-role">{pick(group.role)}</p>
                </div>
                <ul className="tty__nodes" role="list" data-reveal="">
                  {group.nodes.map((node) => (
                    <li className="tty__station" key={node}>
                      <span className="tty__station-mark" aria-hidden="true" />
                      <span className="tty__station-name">{node}</span>
                    </li>
                  ))}
                </ul>
                <p className="tty__group-note" data-reveal="">
                  {pick(group.note)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
