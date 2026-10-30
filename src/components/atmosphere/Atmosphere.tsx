import { useEffect, useRef } from 'react'
import { initVeil } from '../../lib/veil'
import { createAtmosphere } from './scene'
import './atmosphere.css'

/* ============================================================================
   Atmosphere — the sheet, and the plate change that marks its chapters
   ----------------------------------------------------------------------------
   Two fixed layers with one owner. The canvas is the ground the whole page is
   printed on; the veil is the dithered sweep that fires when a section crosses
   the 60% line. They share a dither matrix (see bayer.ts), so the grain of the
   paper and the dots of the transition are literally the same screen.

   Both are chrome: `aria-hidden`, `pointer-events: none`, no content, no
   reading order. Nothing here can hide, delay or intercept the page — and with
   no WebGL, the canvas is simply never appended and the ground stays CSS.
   ========================================================================== */

export default function Atmosphere() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const veilRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    const veilEl = veilRef.current
    if (!host || !veilEl) return

    // The scene is disposable and may not exist at all (no WebGL, lost context).
    const scene = createAtmosphere(host)
    const veil = initVeil(veilEl, scene ? scene.pulse : null)

    return () => {
      veil.dispose()
      scene?.dispose()
    }
  }, [])

  return (
    <>
      <div className="atm" ref={hostRef} aria-hidden="true" />
      <div className="veil" ref={veilRef} aria-hidden="true" data-running="false">
        <span className="veil__band" />
      </div>
    </>
  )
}
