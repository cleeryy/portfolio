import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
// The tile is the veil's half of the sheet's dither: same 8 × 8 matrix, same
// module that generates it for the atmosphere's shader.
import { BAYER_SIZE, bayerMaskTile } from '../components/atmosphere/bayer'

/* ============================================================================
   veil.ts — the plate change
   ----------------------------------------------------------------------------
   A section boundary is a plate change: one dithered band of ink sweeps the
   sheet, once, and the page underneath is simply there, already composed.

   The rules this file enforces, and why each one exists:

   - **Once, and only on a boundary.** A ScrollTrigger on each section's start
     line (`top 60%`) fires in both directions — entering from below and
     returning from above are the same boundary. Nothing else triggers a sweep:
     no wheel event, no velocity threshold.
   - **Never twice.** One sweep at a time; a second request inside 1.1s of the
     last one is dropped. A momentum scroll that crosses three boundaries in
     400ms gets one plate change, not three.
   - **Never on the first paint.** The component arms itself 900ms after mount,
     so the boot plate, a reload halfway down the page, and a `#hash` deep link
     never open with a sweep.
   - **Never on a jump.** The nav scrolls with a 1.4s tween; every section
     boundary crossed during it would fire. A click on any in-page anchor, a
     `.nav` control, or a hash change suspends the sweep for 2.2s — a jump is
     instant, and it looks instant.
   - **Never on the chapter break.** The ink band is the site's own transition
     (DESIGN.md: "HARD CHAPTER BREAK"). A single ink colour cannot be right on a
     viewport that is half paper and half ink, so boundaries into and out of the
     band are left to the band.
   - **Never under reduced motion.** Not a faster sweep: no sweep, no triggers.

   The band is 140vh tall with a 28% plateau, travelling 208% of its own height
   in 620ms: any given pixel is at full ink for ~80ms, well inside the budget,
   and the plateau never covers more than two fifths of the viewport. It is
   `pointer-events: none` and sits under the nav, so nothing is ever blocked.
   ========================================================================== */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

/** Sweep length. The brief's window is 450–700ms. */
const SWEEP = 0.62

/** Percent of the band's own height, each way, from one edge to the other. */
const TRAVEL = 104

/** Quiet time after a sweep before another may start. */
const MIN_GAP_MS = 1100

/** The first paint is not a boundary. */
const WARMUP_MS = 900

/** Long enough to cover the nav's 1.4s tween and its settle. */
const JUMP_HOLD_MS = 2200

export type Veil = {
  dispose: () => void
}

export function initVeil(el: HTMLElement, onPulse: (() => void) | null): Veil {
  const reduced = window.matchMedia(REDUCED_QUERY).matches
  const noop: Veil = { dispose: () => {} }
  if (reduced) return noop

  const band = el.querySelector<HTMLElement>('.veil__band')
  if (!band) return noop

  // The tile is alpha-only; the ink is the element's own `--ink`. Its edge is
  // published with it so the stylesheet cannot drift from the matrix.
  const CELL = 3
  el.style.setProperty('--veil-mask', bayerMaskTile(CELL))
  el.style.setProperty('--veil-tile', `${BAYER_SIZE * CELL}px`)

  // Park the band above the viewport. The offset lives on the tween, not in CSS:
  // a CSS transform here would be folded into GSAP's matrix and the band would
  // land on the page at rest instead of off it.
  gsap.set(band, { yPercent: -TRAVEL })

  let running = false
  let lastEnd = Number.NEGATIVE_INFINITY
  let suspendedUntil = performance.now() + WARMUP_MS

  const now = () => performance.now()

  const sweep = () => {
    running = true
    el.dataset.running = 'true'
    onPulse?.()

    gsap.fromTo(
      band,
      { yPercent: -TRAVEL },
      {
        yPercent: TRAVEL,
        duration: SWEEP,
        ease: 'power1.inOut',
        overwrite: true,
        onComplete: () => {
          running = false
          lastEnd = now()
          el.dataset.running = 'false'
        },
      },
    )
  }

  const request = () => {
    const t = now()
    if (running || t < suspendedUntil || t - lastEnd < MIN_GAP_MS) return
    sweep()
  }

  const suspend = () => {
    suspendedUntil = now() + JUMP_HOLD_MS
  }

  /* ---- boundaries ------------------------------------------------------- */

  const sections = Array.from(document.querySelectorAll<HTMLElement>('main > section[id]'))
  const triggers: ScrollTrigger[] = []

  sections.forEach((section, index) => {
    if (section.classList.contains('on-deep')) return
    if (sections[index - 1]?.classList.contains('on-deep')) return
    // The passage is its own transition: it emerges from the sheet and hands
    // over to the ink band. A dithered sweep on top of it would be a second
    // curtain over an already-moving one.
    if (section.classList.contains('flt')) return
    if (sections[index - 1]?.classList.contains('flt')) return

    triggers.push(
      ScrollTrigger.create({
        trigger: section,
        start: 'top 60%',
        onEnter: request,
        onLeaveBack: request,
      }),
    )
  })

  /* ---- jumps ------------------------------------------------------------ */

  const onClick = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('a[href^="#"]') || target.closest('.nav')) suspend()
  }

  const onHashChange = () => suspend()

  document.addEventListener('click', onClick, true)
  window.addEventListener('hashchange', onHashChange)

  /* ---- teardown --------------------------------------------------------- */

  let disposed = false
  const media = window.matchMedia(REDUCED_QUERY)

  const dispose = () => {
    if (disposed) return
    disposed = true

    media.removeEventListener('change', onReducedChange)
    document.removeEventListener('click', onClick, true)
    window.removeEventListener('hashchange', onHashChange)
    for (const trigger of triggers) trigger.kill()
    gsap.killTweensOf(band)

    el.dataset.running = 'false'
    el.style.removeProperty('--veil-mask')
    el.style.removeProperty('--veil-tile')
  }

  /* A reader who turns reduced motion on mid-session stops the plate changes
     immediately — not at the next boundary. */
  const onReducedChange = () => {
    if (media.matches) dispose()
  }
  media.addEventListener('change', onReducedChange)

  return { dispose }
}
