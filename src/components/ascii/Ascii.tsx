import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { initSectionRig } from '../../lib/reveal'
import { useLang } from '../../lib/i18n'
import {
  ENTRY_ID,
  EXIT_ID,
  territoryCopy,
  territoryGuests,
  territoryLinks,
  territoryPeers,
  territoryStations,
} from '../../content/territory'
import { asciiCopy } from '../../content/ascii'
import { PLATE_GRID, composePre } from './plate'
import SplitText from '../ui/SplitText'
import AsciiScene from './AsciiScene'
import './ascii.css'

/* ============================================================================
   #ascii — the schematic printed as text
   ----------------------------------------------------------------------------
   Between the territory and the passage: the survey resolves into type, then
   the type becomes a depth. The section owns the words, the plate and the
   reading line; the scene owns the drawing; the `<pre>` is the same drawing when
   there is no canvas, and it is composed from the same function.

   Why this section exists at all: a map is already a text — a set of marks with
   a key. Printing it in characters is not a gimmick, it is the same act at
   another resolution, and it makes the sheet's claim (nothing here is a picture;
   everything is a measurement) literal.

   The drawing is the real topology, not a new one: `territoryStations` and
   `territoryLinks` from the section above, projected flat. The crimson cluster
   is `opnsense`, the one control point, and the hover line is the same walk the
   territory prints.
   ========================================================================== */

type Mode = 'pending' | 'live' | 'fallback'

const STATION_BY_ID = new Map(territoryStations.map((station) => [station.id, station]))

/**
 * The phone. Exactly the breakpoint the stylesheet uses to switch the matrix,
 * read as an external store so the first render knows which plate to mount.
 */
const PHONE_QUERY = '(max-width: 899px)'

let phoneQuery: MediaQueryList | null = null

function subscribePhone(onChange: () => void): () => void {
  phoneQuery ??= window.matchMedia(PHONE_QUERY)
  phoneQuery.addEventListener('change', onChange)
  return () => phoneQuery?.removeEventListener('change', onChange)
}

function getPhone(): boolean {
  phoneQuery ??= window.matchMedia(PHONE_QUERY)
  return phoneQuery.matches
}

function usePhone(): boolean {
  return useSyncExternalStore(subscribePhone, getPhone, () => false)
}

/**
 * The `<pre>` is composed once per grid, on the only path that needs it. It is
 * a pure function of the same data the canvas reads — no fetch, no asset, no
 * second description of the network — and it is kept for the session so a
 * language switch or a resize never pays for it twice.
 */
const PRE_CACHE = new Map<string, string>()

function getPre(cols: number, rows: number): string {
  const key = `${cols}x${rows}`
  const cached = PRE_CACHE.get(key)
  if (cached !== undefined) return cached
  const text = composePre(cols, rows)
  PRE_CACHE.set(key, text)
  return text
}

export default function Ascii() {
  const { pick } = useLang()
  const copy = pick(asciiCopy)
  const territory = pick(territoryCopy)
  const phone = usePhone()
  const grid = phone ? PLATE_GRID.phone : PLATE_GRID.wide

  const rootRef = useRef<HTMLElement | null>(null)
  const [mode, setMode] = useState<Mode>('pending')
  const [focus, setFocus] = useState<string | null>(null)

  const onReady = useCallback(() => setMode('live'), [])
  const onUnavailable = useCallback(() => setMode('fallback'), [])
  const onFocus = useCallback((id: string | null) => setFocus(id), [])

  // The shared section rig: the tick on the top rule, the coordinate under the
  // ref, the lead rising as a block. Nothing is hidden by CSS.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const rig = initSectionRig(root)
    return () => rig.dispose()
  }, [])

  /* The reading line. Rest: the inventory and the gesture. On a mark: the same
     walk `#territory` prints — chain, host, or trunk — with the same words. */
  const station = focus ? STATION_BY_ID.get(focus) : undefined
  const peers = station ? territoryPeers(station.id) : []

  const token = (id: string) =>
    id === ENTRY_ID
      ? territory.annotations.entry
      : id === EXIT_ID
        ? territory.annotations.exit
        : id

  let readout = `${territoryStations.length} ${copy.counts.marks} · ${territoryLinks.length} ${copy.counts.links} · ${phone ? copy.readTap : copy.read}`

  if (mode === 'fallback') {
    readout = copy.fallbackLabel
  } else if (station) {
    if (peers.length > 0) {
      const carried = territoryGuests(station.id).length
      readout = `${station.id} — ${peers[0]} · ${territory.readout.trunk} · ${carried} ${territory.readout.guests}`
    } else {
      const walk = station.chain.map(token).join(' → ')
      readout = station.host ? `${walk} · ${territory.readout.on} ${station.host}` : walk
    }
  }

  const pre = mode === 'fallback' ? getPre(grid.cols, grid.rows) : ''

  return (
    <section className="asc" id="ascii" aria-labelledby="ascii-title" ref={rootRef}>
      <span className="rig-tick" data-rig-tick aria-hidden="true" />

      <div className="asc__inner">
        <header className="asc__head">
          <p className="asc__ref mono" aria-hidden="true">
            <span>#ascii</span>
            <span className="rig-coord" data-rig-coord="" />
          </p>

          <SplitText as="h2" className="asc__title" id="ascii-title" text={copy.title} reveal />

          <p className="asc__lead" data-reveal-block="">
            {copy.lead}
          </p>

          <dl className="asc__readings">
            <div>
              <dt>{copy.gridLabel}</dt>
              <dd>{`${grid.cols} × ${grid.rows}`}</dd>
            </div>
            <div>
              <dt>{copy.counts.marks}</dt>
              <dd>{territoryStations.length}</dd>
            </div>
            <div>
              <dt>{copy.counts.links}</dt>
              <dd>{territoryLinks.length}</dd>
            </div>
          </dl>
        </header>

        <figure className="asc__plate" aria-label={copy.plateLabel} aria-describedby="ascii-desc">
          <div className="asc__plate-head">
            <span className="asc__plate-meta mono">
              <span>{copy.plateLabel}</span>
              <span>{copy.plateScale}</span>
            </span>
          </div>

          <p className="asc__readout mono" aria-live={phone ? 'polite' : undefined}>
            {readout}
          </p>

          <p className="sr-only" id="ascii-desc">
            {copy.diagram}
          </p>

          <div className="asc__board" data-mode={mode} data-phone={phone ? 'true' : 'false'}>
            {mode === 'fallback' ? (
              <pre className="asc__pre" aria-hidden="true">{pre}</pre>
            ) : null}

            {mode !== 'fallback' ? (
              <AsciiScene
                cols={grid.cols}
                rows={grid.rows}
                onReady={onReady}
                onUnavailable={onUnavailable}
                onFocus={onFocus}
              />
            ) : null}
          </div>

          <ul className="asc__legend" role="list" aria-label={copy.legendLabel}>
            {copy.legend
              .filter((item) => mode !== 'fallback' || !item.field)
              .map((item) => (
                <li key={item.label}>
                  <span
                    className={
                      item.mark
                        ? 'asc__legend-glyph mono asc__legend-glyph--mark'
                        : 'asc__legend-glyph mono'
                    }
                    aria-hidden="true"
                  >
                    {item.glyph}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
          </ul>

          <p className="asc__note mono">{copy.legendNote}</p>
        </figure>
      </div>
    </section>
  )
}
