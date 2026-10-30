import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import type { Bi } from '../../lib/i18n'
import { useLang } from '../../lib/i18n'
import { handle } from '../../content/hero'
import { announceSheetReady } from './handoff'
import './boot.css'

/* ============================================================================
   BootGate — the sheet being ruled before it is drawn
   ----------------------------------------------------------------------------
   A full-viewport plate on the ground: the graticule draws in left to right
   (240ms), the handle rises from behind its mask, a scale is ruled, and a
   progress hairline grows along it. Then the plate lifts as a transform wipe,
   bottom edge first, revealing the page already composed underneath.

   What the three signals are — and nothing else:

   1. **the bundle** — this effect runs only once the main bundle has executed
      and React has committed, so it resolves immediately. It still counts: the
      scale starts at 1/3 because the sheet really does have something to draw.
   2. **the type** — `document.fonts.ready`.
   3. **the first WebGL frame** — the hero marks `data-scene="live"` (or
      `poster`) once its plot has actually rendered. Read from the DOM rather
      than from a prop, because the hero owns that state.

   No percentage, no file names, no counting to an invented target: the hairline
   only ever moves to the fraction of signals that have resolved, plus a creep
   that stops short of the next tick.

   Timing: release starts at `RELEASE_MIN` at the earliest (so the plate does not
   flash) and at `RELEASE_CEILING` at the latest, whatever has not resolved. The
   wipe is `WIPE` long, so the plate is gone — and interaction with the page
   underneath is unobstructed — well before 1300ms.

   It is never rendered when it cannot be honest about itself:
   - `prefers-reduced-motion` → no plate at all, content immediate;
   - a same-session return → no plate at all (not a faster one);
   - a deep link (`/#about`) → no plate, the reader asked for a place, not a
     title card.
   ========================================================================== */

const SESSION_KEY = 'portfolio:sheet'

/** Earliest lift, so the plate has time to be read instead of flashing. */
const RELEASE_MIN = 0.78
/** Latest lift. With the wipe below, the plate is gone by 1.30s. */
const RELEASE_CEILING = 0.92
const WIPE = 0.38

const TOTAL_SIGNALS = 3

type SignalKey = 'app' | 'fonts' | 'plot'
type BootStatus = 'idle' | 'drawing' | 'ready'

const STATUS_COPY: Record<Exclude<BootStatus, 'idle'>, Bi> = {
  drawing: { en: 'Drawing the sheet', fr: 'Tracé de la feuille' },
  ready: { en: 'Sheet drawn', fr: 'Feuille tracée' },
}

/**
 * Decided once per page load, before the first paint of the plate: a component
 * that mounts twice (React strict mode in development) must not boot twice, and
 * the same decision has to hold for every later mount in the session.
 */
let bootDecision: boolean | null = null

function shouldBoot(): boolean {
  if (bootDecision !== null) return bootDecision

  let skip = false
  try {
    skip =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.sessionStorage.getItem(SESSION_KEY) === '1' ||
      window.location.hash.length > 1
  } catch {
    // Storage blocked, or an exotic browser: draw the sheet rather than skip it.
    skip = false
  }

  bootDecision = !skip
  return bootDecision
}

export default function BootGate() {
  const { pick } = useLang()
  const [alive, setAlive] = useState(shouldBoot)
  const [status, setStatus] = useState<BootStatus>(() => (shouldBoot() ? 'drawing' : 'idle'))
  const plateRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const plate = plateRef.current
    if (!plate) return

    const graticule = plate.querySelector<HTMLElement>('.boot__graticule')
    const figure = plate.querySelector<HTMLElement>('.boot__figure')
    const handleEl = plate.querySelector<HTMLElement>('.boot__handle')
    const ruleLine = plate.querySelector<HTMLElement>('.boot__rule-line')
    const fill = plate.querySelector<HTMLElement>('.boot__fill')
    const caption = plate.querySelector<HTMLElement>('.boot__caption')
    const ticks = gsap.utils.toArray<HTMLElement>('.boot__tick', plate)
    if (!graticule || !figure || !handleEl || !ruleLine || !fill || !caption) return

    const t0 = performance.now()
    const cleanups: (() => void)[] = []
    // A stable non-null reference for the callbacks created below: they run
    // after this effect has returned, and TypeScript cannot carry the guard in.
    const plateEl: HTMLDivElement = plate
    let cancelled = false
    let released = false
    let timer: gsap.core.Tween | null = null

    const done: Record<SignalKey, boolean> = { app: false, fonts: false, plot: false }
    let left = TOTAL_SIGNALS

    const ctx = gsap.context(() => {
      // Final composition first, in one pass, so a killed timeline can only
      // ever leave the plate fully drawn — never half-ruled.
      gsap.set(graticule, { clipPath: 'inset(0% 100% 0% 0%)' })
      gsap.set(handleEl, { yPercent: 110 })
      gsap.set(ruleLine, { scaleX: 0 })
      gsap.set(fill, { scaleX: 0 })
      gsap.set(caption, { opacity: 0 })

      gsap
        .timeline({ defaults: { ease: 'power2.out' } })
        // The graticule is ruled first, left to right.
        .to(graticule, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.24, ease: 'power2.inOut' }, 0)
        // Then the figure.
        .to(handleEl, { yPercent: 0, duration: 0.42, ease: 'power3.out' }, 0.1)
        // Then the scale it will be measured against.
        .to(ruleLine, { scaleX: 1, duration: 0.34, ease: 'power2.inOut' }, 0.2)
        .to(caption, { opacity: 1, duration: 0.3 }, 0.26)
    }, plate)

    function paintScale(solved: number, first: boolean) {
      ctx.add(() => {
        gsap.killTweensOf(fill)
        gsap.to(fill, {
          scaleX: solved / TOTAL_SIGNALS,
          duration: 0.42,
          delay: first ? 0.18 : 0,
          ease: 'power2.out',
        })
        if (left > 0) {
          // Alive, but never past the next tick: the instrument is working, not
          // claiming progress that has not happened yet.
          gsap.to(fill, {
            scaleX: (solved + 0.42) / TOTAL_SIGNALS,
            duration: 2.4,
            delay: first ? 0.5 : 0.4,
            ease: 'power1.out',
          })
        }
      })
    }

    function scheduleAt(seconds: number) {
      if (cancelled || released) return
      timer?.kill()
      const elapsed = (performance.now() - t0) / 1000
      timer = gsap.delayedCall(Math.max(0.01, seconds - elapsed), lift)
    }

    function settle(key: SignalKey, first = false) {
      if (cancelled || released || done[key]) return
      done[key] = true
      left -= 1

      const tick = ticks[TOTAL_SIGNALS - left - 1]
      if (tick) tick.dataset.on = 'true'

      paintScale(TOTAL_SIGNALS - left, first)
      if (left === 0) scheduleAt(RELEASE_MIN)
    }

    function lift() {
      if (cancelled || released) return
      released = true

      // Interaction belongs to the page from the first millimetre of the wipe.
      plateEl.dataset.lifting = 'true'
      setStatus('ready')
      announceSheetReady({ path: 'boot', elapsed: Math.round(performance.now() - t0) })

      ctx.add(() => {
        gsap
          .timeline({ onComplete: finish })
          .to(figure, { yPercent: -7, opacity: 0, duration: 0.22, ease: 'power2.in' }, 0)
          .to(plateEl, { yPercent: -100, duration: WIPE, ease: 'power3.inOut' }, 0.02)
      })
    }

    function finish() {
      try {
        window.sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        /* Storage blocked: the next visit boots again. Harmless. */
      }
      if (!cancelled) setAlive(false)
    }

    /* 1. The bundle. This code only runs once the app has committed. */
    settle('app', true)

    /* 2. The type. */
    document.fonts.ready.then(() => settle('fonts'))

    /* 3. The first frame of the plot. */
    const hero = document.querySelector<HTMLElement>('.hero')
    const plotReady = () =>
      hero?.dataset.scene === 'live' || hero?.dataset.scene === 'poster'

    if (!hero || plotReady()) {
      settle('plot')
    } else {
      const observer = new MutationObserver(() => {
        if (plotReady()) settle('plot')
      })
      observer.observe(hero, { attributes: true, attributeFilter: ['data-scene'] })
      cleanups.push(() => observer.disconnect())
    }

    /* The ceiling. Whatever is still missing, the plate leaves. */
    scheduleAt(RELEASE_CEILING)

    return () => {
      cancelled = true
      timer?.kill()
      ctx.revert()
      for (const dispose of cleanups) dispose()
    }
  }, [])

  return (
    <>
      {alive ? (
        <div className="boot" ref={plateRef} aria-hidden="true">
          <div className="boot__graticule" />

          <div className="boot__figure">
            <span className="boot__mask">
              <span className="boot__handle">{handle}</span>
            </span>

            <span className="boot__rule">
              <span className="boot__rule-line" />
              <span className="boot__fill" />
              {Array.from({ length: TOTAL_SIGNALS }, (_, i) => (
                <span
                  key={i}
                  className="boot__tick"
                  style={{ insetInlineStart: `${((i + 1) / TOTAL_SIGNALS) * 100}%` }}
                />
              ))}
            </span>

            <p className="boot__caption">{pick(STATUS_COPY.drawing)}</p>
          </div>
        </div>
      ) : null}

      {/* The one line assistive tech gets. Outside the plate, which is decorative
          and `aria-hidden`, and it survives the plate's removal so the reader is
          told the sheet is ready rather than hearing the announcement vanish. */}
      <p className="sr-only" role="status" aria-live="polite">
        {status === 'idle' ? '' : pick(STATUS_COPY[status])}
      </p>
    </>
  )
}
