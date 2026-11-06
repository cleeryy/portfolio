import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLang } from '../../lib/i18n'
import { BAYER_SIZE, bayerMaskTile } from '../../chrome/bayer'
import { flightCopy, type FlightCopy } from '../../content/flight'
import FlightScene, { type ClearBox } from './FlightScene'
import FlightStill from './FlightStill'
import { DEPTH_MAX, INK_FLIP, depthAt, handoff, inkAt } from './curve'
import './flight.css'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================================
   The passage — from the plate into the ink
   ----------------------------------------------------------------------------
   A tall track, a sticky plate, and a camera that is scrubbed, not steered.
   The scroll is never hijacked: Lenis keeps the page native, the track's own
   progress drives a single GSAP proxy (`scrub: 0.6`), and the eye damps after
   it. Take the canvas away and the section still says everything it has to say:
   the heading, the paragraph and the two readings are DOM, and the still plate
   underneath is the same composition, printed once.

   Why the track is tall and the plate is sticky, and not a pin: a pin inserts
   a spacer that moves `#operator` and every section below it. A sticky plate
   adds its own height and nothing else, so anchors keep landing on the sections
   they name — `#operator` after this, `#flight` itself at progress 0.

   **The cartouche is type, not a box.** A filled title block would be the only
   card on the site, and DESIGN.md §1 refuses one outright. So the copy is laid
   on the field the way the hero collar and the territory legend are: a mono
   reference, a heading, a paragraph, and a ruled scale carrying two readings —
   no fill, no border, no radius, no shadow. Legibility is not bought from a
   panel: the field's own shader is told where the type lives and clears itself
   there (`uClear`), so what passes behind the words is the sheet, not a label.

   **The seam is a torn edge, not a border.** This is the one light→ink break on
   the site, which is why the veil is told to skip it: the pin opens with a band
   of ink at the viewport's top edge that dissolves as the plate takes over. It
   is printed through the same Bayer screen as every other plate change, and it
   is gone by the hand-off's midpoint — a band that stayed for the three
   viewports of the track would be a frame, not a tear.
   ========================================================================== */

/**
 * The torn edge's screen: the same 8 × 8 matrix and 3px cell the veil prints
 * with, so the passage's break reads as the same press as every other boundary.
 * Built once at module load — the tile is a data URL and must never be rebuilt
 * inside a scrub.
 */
const SEAM_MASK = bayerMaskTile(3)
const SEAM_TILE = `${BAYER_SIZE * 3}px`

/** The band is a screen on the sheet, not a plate of ink: the veil prints at
 *  0.38, and the tear is allowed to be a little stronger because it is only
 *  visible while the passage pins. At 1 it reads as a header; at 0.55 it reads
 *  as the paper's edge. */
const SEAM_MAX = 0.55

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Pre-formatted readings. The readout changes on almost every frame of a
 * scrub, and building a string per frame would be the only allocation in the
 * loop. 1201 + 101 strings at module load is 14 KB and no churn at all.
 */
const DEPTH_TEXT = Array.from(
  { length: DEPTH_MAX + 1 },
  (_, i) => `depth ${String(i).padStart(4, '0')}`,
)
const INK_TEXT = Array.from({ length: 101 }, (_, i) => `ink ${String(i).padStart(3, '0')}`)

/**
 * Reduced motion is read as an external store, the way the width interactions
 * read their own conditions: a session that turns it on stops the canvas at
 * once, and a session that turns it back off is allowed to build it again. No
 * effect, no state mirrored from a media query.
 */
let reducedQuery: MediaQueryList | null = null

function subscribeReduced(onChange: () => void): () => void {
  reducedQuery ??= window.matchMedia(REDUCED_QUERY)
  reducedQuery.addEventListener('change', onChange)
  return () => reducedQuery?.removeEventListener('change', onChange)
}

function getReduced(): boolean {
  reducedQuery ??= window.matchMedia(REDUCED_QUERY)
  return reducedQuery.matches
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, getReduced, () => false)
}

type CartoucheProps = {
  copy: FlightCopy
  scopeRef: RefObject<HTMLDivElement | null>
  depthRef: RefObject<HTMLSpanElement | null>
  inkRef: RefObject<HTMLSpanElement | null>
}

/**
 * The title block, drawn with the sheet's own instruments:
 *
 * - a crimson registration mark (76 × 2, the same length as the chapter mark
 *   and the hero collar's), because every section is registered;
 * - the `#flight` reference in mono at annotation scale;
 * - the heading at `--step-3`, the paragraph at `--step-0` on a 34ch measure;
 * - a ruled scale with three ticks, and the two readings hanging off it.
 *
 * The two readings are instruments, not decoration: `depth` is the track's own
 * progress (× 1200), `ink` is what the shader's coverage is actually printing.
 * They are `aria-hidden` — a number that changes sixty times a second is not a
 * sentence — and the paragraph carries the meaning, in the reading order.
 */
function Cartouche({ copy, scopeRef, depthRef, inkRef }: CartoucheProps) {
  return (
    <div className="flt__cartouche" ref={scopeRef}>
      <span className="flt__mark" aria-hidden="true" />

      <p className="flt__ref mono" aria-hidden="true">
        #flight
      </p>

      <h2 className="flt__title" id="flight-title">
        {copy.title}
      </h2>

      <p className="flt__lead">{copy.lead}</p>

      <div className="flt__scale" aria-hidden="true">
        <span className="flt__tick" />
        <span className="flt__tick flt__tick--mid" />
        <span className="flt__tick flt__tick--end" />
      </div>

      <p className="flt__readings mono" aria-hidden="true">
        <span ref={depthRef}>depth 0000</span>
        <span ref={inkRef}>ink 100</span>
      </p>
    </div>
  )
}

export default function Flight() {
  const { pick } = useLang()
  const copy = pick(flightCopy)
  const reduced = useReducedMotion()

  const trackRef = useRef<HTMLDivElement | null>(null)
  const plateRef = useRef<HTMLDivElement | null>(null)
  const seamRef = useRef<HTMLSpanElement | null>(null)
  const cartoucheRef = useRef<HTMLDivElement | null>(null)
  const depthRef = useRef<HTMLSpanElement | null>(null)
  const inkRef = useRef<HTMLSpanElement | null>(null)

  // The proxies the scene and the scrub share. Stable objects, never state: a
  // scroll must not re-render React, and the scene reads them by identity.
  const [progress] = useState(() => ({ p: 0 }))
  const [enter] = useState(() => ({ p: 0 }))

  /**
   * Where the type sits, in the sticky box's own coordinates, so the field can
   * be cleared there. `offsetLeft`/`offsetTop` are read against the sticky
   * viewport — the offset parent — which is fixed relative to the canvas at
   * every scroll position, so one measurement holds for the whole dive.
   *
   * A ref, not state: re-measuring is a layout write the scene reads by
   * identity, and a component re-render for a box nobody paints in React would
   * be the wrong tool.
   */
  const clearRef = useRef<ClearBox>({ left: 0, top: 0, width: 0, height: 0, version: 0 })

  const [mode, setMode] = useState<'pending' | 'live' | 'still'>('pending')
  const [ground, setGround] = useState<'paper' | 'deep'>('paper')

  /** A lost context freezes the plate where it is, at one of its two honest states. */
  const frozen = useRef(false)
  const last = useRef({ depth: -1, ink: -1, plate: -1, seam: -1, inkPhase: '' })

  const paint = useCallback((value: number) => {
    const h = handoff(value)
    const depth = depthAt(value)
    const ink = inkAt(h)
    const seen = last.current

    if (depth !== seen.depth) {
      seen.depth = depth
      if (depthRef.current) depthRef.current.textContent = DEPTH_TEXT[depth]
    }

    if (frozen.current) return

    if (ink !== seen.ink) {
      seen.ink = ink
      if (inkRef.current) inkRef.current.textContent = INK_TEXT[ink]
    }

    // 64 steps is finer than the eye resolves on a 620ms fade, and it keeps a
    // style write off most frames of a slow scrub.
    if (plateRef.current) {
      const step = Math.round(h * 64) / 64
      if (step !== seen.plate) {
        seen.plate = step
        plateRef.current.style.opacity = String(step)
      }
    }

    // The seam is full at the pin (`enter.p = 1`, `h = 0`) and torn away by the
    // hand-off's midpoint. Quantised like the plate: a 6rem band is a style
    // write worth keeping off most frames of a slow scrub.
    const seam = Math.min(enter.p, Math.max(0, 1 - h * 2)) * SEAM_MAX
    const seamStep = Math.round(seam * 64) / 64
    if (seamRef.current && seamStep !== seen.seam) {
      seen.seam = seamStep
      seamRef.current.style.opacity = String(seamStep)
    }

    // The type reverses out at the luminance crossover. See `INK_FLIP`.
    const inkPhase = h >= INK_FLIP ? 'plate' : 'sheet'
    if (inkPhase !== seen.inkPhase) {
      seen.inkPhase = inkPhase
      if (cartoucheRef.current) cartoucheRef.current.dataset.ink = inkPhase
    }
    // `enter` is a stable proxy object (`useState`), so the callback identity
    // does not change; naming it satisfies the lint rule without re-creating
    // the function on every scroll, and the reading is still the live `p`.
  }, [enter])

  const onReady = useCallback(() => setMode('live'), [])

  // Not memoised on purpose: the scene keeps its callbacks in a ref, so a new
  // identity per render costs nothing, while a `useCallback` here would want
  // `progress.p` as a dependency — and reading a scrub proxy is exactly what a
  // dependency array must not do.
  const onUnavailable = () => {
    const deep = handoff(progress.p) > 0.5
    frozen.current = true
    setGround(deep ? 'deep' : 'paper')
    // The plate resolves to one of its two honest grounds rather than freezing
    // at half a wash — and it goes there over 320ms, because a GPU that dies
    // mid-passage must not blink the sheet white.
    if (plateRef.current) {
      gsap.to(plateRef.current, {
        opacity: deep ? 1 : 0,
        duration: 0.32,
        ease: 'power2.out',
        overwrite: true,
      })
    }
    if (cartoucheRef.current) cartoucheRef.current.dataset.ink = deep ? 'plate' : 'sheet'
    if (inkRef.current) {
      const value = inkAt(deep ? 1 : 0)
      inkRef.current.textContent = INK_TEXT[value]
      last.current.ink = value
    }
    setMode('still')
  }

  /* ---- the clearing the field leaves around the type -------------------- */

  const measureClear = useCallback(() => {
    const el = cartoucheRef.current
    if (!el) return
    const box = clearRef.current
    const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = el
    if (
      offsetLeft === box.left &&
      offsetTop === box.top &&
      offsetWidth === box.width &&
      offsetHeight === box.height
    ) {
      return
    }
    box.left = offsetLeft
    box.top = offsetTop
    box.width = offsetWidth
    box.height = offsetHeight
    box.version += 1
  }, [])

  useEffect(() => {
    const el = cartoucheRef.current
    if (!el) return

    measureClear()

    // The type's box changes with the words (a language switch re-renders it),
    // with the webfonts, and with the viewport. All three are layout events, so
    // one observer and one resize listener cover them.
    const observer = new ResizeObserver(measureClear)
    observer.observe(el)
    window.addEventListener('resize', measureClear)

    let alive = true
    const fonts = typeof document.fonts !== 'undefined' ? document.fonts.ready : null
    fonts?.then(
      () => {
        if (alive) measureClear()
      },
      () => {
        if (alive) measureClear()
      },
    )

    return () => {
      alive = false
      observer.disconnect()
      window.removeEventListener('resize', measureClear)
    }
    // `copy.lead` re-runs this on a language switch: the paragraph is what sets
    // the box's height, and it is new text.
  }, [measureClear, copy.lead])

  useEffect(() => {
    if (reduced) return
    const track = trackRef.current
    if (!track) return

    const proxy = progress
    const ramp = enter
    let verifyFrame = 0
    const cleanups: (() => void)[] = []

    const ctx = gsap.context(() => {
      const tween = gsap.to(proxy, {
        p: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: track,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
        onUpdate: () => paint(proxy.p),
      })

      const trigger = tween.scrollTrigger
      if (!trigger) return

      // A reload or a deep link lands mid-track: print the reading before the
      // first scroll instead of starting the plate at zero.
      proxy.p = trigger.progress
      paint(proxy.p)

      /**
       * ScrollTrigger caches absolute offsets. The chapters above this one own
       * pins, and a pin's spacer can still grow *after* a global refresh — a
       * webfont widening a strip changes its travel by more than a viewport.
       * That leaves every trigger below it short by that distance, and this one
       * would open the passage halfway through. So the track's own measure is
       * checked against the trigger's, and this trigger alone is re-read when
       * the two disagree: local, cheap, and it cannot move another section.
       */
      const verify = () => {
        const start = tween.scrollTrigger?.start
        if (start === undefined) return
        const real = track.getBoundingClientRect().top + (window.scrollY || 0)
        if (Math.abs(real - start) > 2) tween.scrollTrigger?.refresh()
      }

      const scheduleVerify = () => {
        if (verifyFrame) return
        verifyFrame = requestAnimationFrame(() => {
          verifyFrame = 0
          verify()
        })
      }

      // A pin's spacer changes the document's height; that is the signal.
      const documentObserver = new ResizeObserver(scheduleVerify)
      documentObserver.observe(document.documentElement)
      ScrollTrigger.addEventListener('refresh', scheduleVerify)
      cleanups.push(() => {
        documentObserver.disconnect()
        ScrollTrigger.removeEventListener('refresh', scheduleVerify)
        if (verifyFrame) cancelAnimationFrame(verifyFrame)
        verifyFrame = 0
      })
      scheduleVerify()

      const entry = ScrollTrigger.create({
        trigger: track,
        start: 'top bottom',
        end: 'top top',
        onUpdate: (self) => {
          ramp.p = self.progress
        },
      })
      ramp.p = entry.progress
      // The first paint above ran before the approach trigger existed, so on a
      // deep link (where `enter.p` is already 1) it saw a seam of zero. Print
      // the true state on the same frame rather than one scroll update later.
      paint(proxy.p)
    }, track)

    return () => {
      for (const undo of cleanups) undo()
      cleanups.length = 0
      ctx.revert()
    }
  }, [reduced, paint, progress, enter])

  return (
    <section
      className="flt"
      id="flight"
      data-mode={reduced ? 'still' : mode}
      data-ground={ground}
      aria-labelledby="flight-title"
    >
      <p className="sr-only">{copy.diagram}</p>

      {reduced ? (
        <div className="flt__static">
          <FlightStill />
          <Cartouche
            copy={copy}
            scopeRef={cartoucheRef}
            depthRef={depthRef}
            inkRef={inkRef}
          />
        </div>
      ) : (
        <div className="flt__track" ref={trackRef}>
          <div className="flt__viewport">
            <span
              className="flt__seam"
              ref={seamRef}
              aria-hidden="true"
              style={{ '--seam-mask': SEAM_MASK, '--seam-tile': SEAM_TILE } as CSSProperties}
            />
            <div className="flt__plate" ref={plateRef} aria-hidden="true" />
            {mode === 'still' ? (
              <FlightStill />
            ) : (
              <FlightScene
                progress={progress}
                enter={enter}
                clear={clearRef}
                onReady={onReady}
                onUnavailable={onUnavailable}
              />
            )}
            <Cartouche
              copy={copy}
              scopeRef={cartoucheRef}
              depthRef={depthRef}
              inkRef={inkRef}
            />
          </div>
        </div>
      )}
    </section>
  )
}
