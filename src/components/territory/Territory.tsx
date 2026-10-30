import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { initSectionRig } from '../../lib/reveal'
import { useLang } from '../../lib/i18n'
import {
  ENTRY_ID,
  EXIT_ID,
  territoryCopy,
  territoryGroups,
  territoryStations,
  territorySummary,
  type LegendKey,
  type TierId,
} from '../../content/territory'
import SplitText from '../ui/SplitText'
import TerritoryPlate from './TerritoryPlate'
import TerritoryScene, { type TerritorySceneHandle } from './TerritoryScene'
import './territory.css'

/* ============================================================================
   The territory
   ----------------------------------------------------------------------------
   A plant cut: three plans stacked, one path through them. The section owns the
   words; the scene owns the drawing; the register below owns the inventory, and
   it is the version a screen reader and a copy-paste get.

   Everything in the drawing is derived from `content/territory.ts`, which is
   derived from the operator's own docs and reverse-proxy config. The mode is
   the only state that decides what is on screen: `pending` shows the SVG plate
   until the first WebGL frame exists, `live` shows the scene, `fallback` brings
   the plate back when the context is lost.
   ========================================================================== */

type Mode = 'pending' | 'live' | 'fallback'

const TIER_IDS: TierId[] = ['edge', 'fabric', 'services']

const STATION_CHAIN = new Map(territoryStations.map((station) => [station.id, station.chain]))

function LegendGlyph({ kind }: { kind: LegendKey }) {
  return (
    <svg
      className="tty__legend-glyph"
      viewBox="0 0 20 10"
      width="20"
      height="10"
      aria-hidden="true"
      focusable="false"
    >
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
      {kind === 'backup' ? <path className="survey-glyph survey-glyph--dashed" d="M1 5H19" /> : null}
    </svg>
  )
}

export default function Territory() {
  const { pick } = useLang()
  const copy = pick(territoryCopy)

  const rootRef = useRef<HTMLElement | null>(null)
  const sceneRef = useRef<TerritorySceneHandle | null>(null)
  const [mode, setMode] = useState<Mode>('pending')
  const [focus, setFocus] = useState<string | null>(null)
  const [activeTier, setActiveTier] = useState<TierId | null>(null)

  const onReady = useCallback(() => setMode('live'), [])
  const onUnavailable = useCallback(() => setMode('fallback'), [])
  const onFocus = useCallback((id: string | null) => setFocus(id), [])

  // The section's entry device, owned by the shared motion system: the
  // registration tick on the top rule, the coordinate under the ref, and the
  // block reveals. Nothing here is hidden by CSS, so a failed script still
  // leaves the sheet printed.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const rig = initSectionRig(root)
    return () => rig.dispose()
  }, [])

  const groups = new Map(territoryGroups.map((group) => [group.id, group]))
  const label = (id: string) => {
    const group = groups.get(id)
    return group ? pick(group.label) : id
  }

  const toggleTier = (tier: TierId) => {
    const next = activeTier === tier ? null : tier
    setActiveTier(next)
    sceneRef.current?.frame(next)
  }

  /**
   * The reading line. At rest it states the rule of the drawing; on a tier it
   * states that stratum's job; on a mark it spells the chain the drawing is
   * lighting, in words — which is the whole point of the hover.
   */
  const chain = focus ? STATION_CHAIN.get(focus) : null
  const token = (id: string) =>
    id === ENTRY_ID ? copy.annotations.entry : id === EXIT_ID ? copy.annotations.exit : id
  const readout = chain
    ? chain.map(token).join(' → ')
    : activeTier
      ? pick(groups.get(activeTier)?.role ?? { en: '', fr: '' })
      : copy.readInstruction

  return (
    <section className="tty" id="territory" aria-labelledby="territory-title" ref={rootRef}>
      <span className="rig-tick" data-rig-tick aria-hidden="true" />

      <div className="tty__inner">
        <header className="tty__head">
          <p className="tty__ref mono" aria-hidden="true">
            <span>#territory</span>
            <span className="rig-coord" data-rig-coord="" />
          </p>

          <SplitText as="h2" className="tty__title" id="territory-title" text={copy.title} reveal />

          <p className="tty__lead" data-reveal-block="">
            {copy.lead}
          </p>

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

        <figure
          className="tty__plate"
          aria-label={copy.plateLabel}
          aria-describedby="tty-plate-desc"
        >
          <div className="tty__plate-head">
            <span className="tty__plate-meta mono">
              <span>{copy.plateLabel}</span>
              <span>{copy.plateScale}</span>
            </span>

            <div className="tty__tiers" role="group" aria-label={copy.strataLabel}>
              {TIER_IDS.map((tier) => (
                <button
                  className="tty__tier"
                  key={tier}
                  type="button"
                  aria-pressed={activeTier === tier}
                  onClick={() => toggleTier(tier)}
                >
                  <span className="tty__tier-mark" aria-hidden="true" />
                  {label(tier)}
                </button>
              ))}
            </div>
          </div>

          <p className="tty__readout mono" id="tty-readout">
            {readout}
          </p>

          <p className="sr-only" id="tty-plate-desc">
            {copy.diagramDesc}
          </p>

          <div className="tty__plate-body" data-mode={mode}>
            <TerritoryPlate copy={copy} label={label} />

            {mode !== 'fallback' ? (
              <TerritoryScene
                entryLabel={copy.annotations.entry}
                exitLabel={copy.annotations.exit}
                tierLabels={{
                  edge: label('edge'),
                  fabric: label('fabric'),
                  services: label('services'),
                }}
                focus={focus}
                handleRef={sceneRef}
                onFocus={onFocus}
                onReady={onReady}
                onUnavailable={onUnavailable}
              />
            ) : (
              <p className="tty__plate-fallback mono">{copy.fallbackLabel}</p>
            )}
          </div>

          <ul className="tty__legend" role="list" aria-label={copy.legendLabel}>
            {copy.legend.map((item) => (
              <li key={item.key}>
                <LegendGlyph kind={item.key} />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>

          <p className="tty__plate-note mono">{copy.legendNote}</p>
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
                <div className="tty__group-head">
                  <h3 className="tty__group-key mono">{pick(group.label)}</h3>
                  <p className="tty__group-role">{pick(group.role)}</p>
                </div>
                <ul className="tty__nodes" role="list">
                  {group.nodes.map((node) => (
                    <li className="tty__station" key={node}>
                      <span className="tty__station-mark" aria-hidden="true" />
                      <span className="tty__station-name">{node}</span>
                    </li>
                  ))}
                </ul>
                <p className="tty__group-note" data-reveal-block="">
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
