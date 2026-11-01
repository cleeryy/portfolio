import { useCallback, useRef, useState } from 'react'
import { useLang } from '../../lib/i18n'
import { RELIEF_REF, reliefCopy } from '../../content/relief'
import ReliefScene from './ReliefScene'
import {
  RELIEF_BOX,
  buildReliefPlate,
  getReliefModel,
  reliefCoarse,
  reliefLevels,
  type ReliefPlateData,
} from './reliefField'
import './relief.css'

/**
 * #relief — the terrain the network sits on
 * ----------------------------------------------------------------------------
 * An asset plate between the ledger and the map: the solid the next section
 * draws at full size. Nothing here is a chapter. The left margin carries the
 * cartouche (reference, name, one sentence, the coordinate), the object takes
 * the right two thirds and bleeds past the content measure to the sheet's trim,
 * and one crimson survey pin marks the point the coordinate names.
 *
 * Three renderers for one drawing, in order of what the reader's machine can
 * do: the WebGL solid, the SVG plate printed from the same height field, and —
 * under both — the copy, which is real text and does not depend on either.
 *
 * The plate is built lazily. `onUnavailable` is the only thing that needs it up
 * front, so a visitor with a working GPU never pays for the fallback's DOM.
 */
export default function Relief() {
  const { pick } = useLang()
  const copy = pick(reliefCopy)

  const coarse = reliefCoarse()
  const levels = reliefLevels(coarse)

  const [mode, setMode] = useState<'idle' | 'live' | 'fallback'>('idle')
  const [plate, setPlate] = useState<ReliefPlateData | null>(null)
  const plateRef = useRef<ReliefPlateData | null>(null)

  // The fallback is framed on the same NDC box the solid is fitted to, so a
  // lost context swaps one drawing for the other at the same size and place.
  const box = coarse ? RELIEF_BOX.coarse : RELIEF_BOX.fine
  const plateFrame = {
    inset: `${((1 - box.y1) / 2) * 100}% ${((1 - box.x1) / 2) * 100}% ${
      ((1 + box.y0) / 2) * 100
    }% ${((1 + box.x0) / 2) * 100}%`,
  }

  const onReady = useCallback(() => setMode('live'), [])

  const onUnavailable = useCallback(() => {
    setMode('fallback')
    // Built once, from the very model the scene would have drawn: the plate
    // cannot drift from the solid, and a lost context costs one path build.
    if (!plateRef.current) plateRef.current = buildReliefPlate(getReliefModel(coarse))
    setPlate(plateRef.current)
  }, [coarse])

  return (
    <section className="rlf" id="relief" aria-labelledby="relief-title">
      <div className="rlf__body">
        <div className="rlf__copy">
          <p className="rlf__ref mono" aria-hidden="true">
            {RELIEF_REF}
          </p>

          <h2 className="rlf__title" id="relief-title">
            {copy.title}
          </h2>

          <p className="rlf__line">{copy.line}</p>

          <p className="rlf__coord mono">{copy.coord}</p>
        </div>

        <div className="rlf__plot" data-mode={mode}>
          <ReliefScene coarse={coarse} onReady={onReady} onUnavailable={onUnavailable} />

          {plate ? (
            <div className="rlf__plate-frame" style={plateFrame}>
              <svg
                className="rlf__plate"
                viewBox={plate.viewBox}
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
                focusable="false"
              >
                {plate.paths.map((path, index) => (
                  <path
                    key={index}
                    className={
                      path.index ? 'rlf__contour rlf__contour--index' : 'rlf__contour'
                    }
                    d={path.d}
                  />
                ))}
                <path className="rlf__mark" d={plate.mark} />
              </svg>
            </div>
          ) : null}

          <p className="rlf__reading mono" aria-hidden="true">
            <span>{copy.contours.replace('{n}', String(levels))}</span>
            <span>{copy.scale}</span>
          </p>
        </div>
      </div>
    </section>
  )
}
