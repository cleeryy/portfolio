import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================================
   reveal.ts — motion system v3 (reversible)
   ----------------------------------------------------------------------------
   The section-level vocabulary of the sheet. Four gestures, and no fifth:

   1. A registration tick (`.rig-tick`, `[data-rig-tick]`) that draws along the
      section's top rule when the section comes into view and draws itself back
      when the reader returns above it.
   2. A mono coordinate (`[data-rig-coord]`) beside the `#section` reference
      that counts up to the section's real offset on the page. It is a
      measurement, not decoration: the number is `getBoundingClientRect()` of
      the section, printed after the instrument has finished counting. A
      measurement is printed once — it does not re-count.
   3. Block reveals (`[data-reveal-block]`) — whole paragraphs, never letters,
      never one tween per line.
   4. `revealWords()`, used by `SplitText`, for every section heading.

   THE TABLE — every reveal on the sheet reads these values and nothing else:

   | token      | value                       | job                                |
   | ---------- | --------------------------- | ---------------------------------- |
   | duration   | 0.9 s                       | one reveal, in both directions     |
   | ease       | cubic-bezier(.16, 1, .3, 1) | the sheet's one curve              |
   | stagger    | 0.05 s                      | between the words of a heading     |
   | travel     | 100 (yPercent)              | a masked word's own line box       |
   | blockRise  | 14 px                       | whole-block prose                  |
   | enter      | top 85%                     | a section counts as entered here   |
   | leave      | bottom top                  | and as left once it is behind      |

   Rules kept everywhere in this file:

   - **Nothing is hidden by CSS.** Initial states are written by GSAP at mount,
     and only for content the reader has not reached yet. A failed script, a
     reload halfway down the page, or reduced motion all leave the sheet fully
     printed.
   - **Reversal is the same tween.** Each reveal is one paused tween driven by
     its own trigger (`play none none reverse`): entering plays it, returning
     up across the start line masks it again. Nothing is queued, so a fast
     scroll in and out scrubs one animation rather than stacking two.
   - **One tempo.** Every number lives in `MOTION`, so seven sections cannot
     drift apart by a few hundred milliseconds.
   - **Every trigger is owned.** Callers get a disposer and revert the context;
     nothing survives a language switch or an unmount, and any inline transform
     left on a reused node is removed before it can be re-measured.
   - **Reduced motion means final states**, not faster animation: no trigger is
     created, and the coordinate is printed at its real value immediately.
   ========================================================================== */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
const noop = () => {}

/**
 * `cubic-bezier(.16, 1, .3, 1)` as a function GSAP can consume.
 *
 * GSAP has no bezier parser without a plug-in, and the sheet does not take a
 * dependency for one curve. This is the same Newton–Raphson solve browsers use
 * for CSS timing functions: one closure, allocated once at module load, then
 * called with a progress value and returning the eased value.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (p: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const curve = (t: number, a: number, b: number, c: number) => ((a * t + b) * t + c) * t
  const slope = (t: number, a: number, b: number, c: number) => (3 * a * t + 2 * b) * t + c

  return (p: number) => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    let t = p
    for (let i = 0; i < 6; i += 1) {
      const error = curve(t, ax, bx, cx) - p
      if (Math.abs(error) < 1e-4) return curve(t, ay, by, cy)
      const d = slope(t, ax, bx, cx)
      if (Math.abs(d) < 1e-6) break
      t -= error / d
      if (t < 0) t = 0
      else if (t > 1) t = 1
    }
    return curve(t, ay, by, cy)
  }
}

/** The sheet's one curve, from the table above. */
const EASE = cubicBezier(0.16, 1, 0.3, 1)

/** The whole sheet moves at these numbers. */
export const MOTION = {
  /** Every reveal, in both directions. */
  duration: 0.9,
  /** cubic-bezier(.16, 1, .3, 1), solved above. */
  ease: EASE,
  /** Between the words of a heading. */
  stagger: 0.05,
  /** yPercent for a word inside its `overflow` line box. */
  travel: 100,
  /** px, whole-block prose rises (it is never split per line). */
  blockRise: 14,
  /** The registration tick along a section's top rule. */
  tick: 0.42,
  /** The coordinate readout. */
  coord: 0.9,
  /** A section counts as entered a little before it is fully in frame. */
  enter: 'top 85%',
  /** …and as left once its bottom edge is above the viewport. */
  leave: 'bottom top',
} as const

export function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_QUERY).matches
}

/**
 * True only for content the reader has not reached yet.
 *
 * This is what keeps the page honest: an element already inside the first
 * screen is never given an initial state, so nothing can stay invisible
 * because a trigger was created after its start line had been passed — and a
 * reload halfway down the sheet prints everything instead of masking it.
 */
function startsBelowFold(el: Element, ratio = 0.92): boolean {
  return el.getBoundingClientRect().top > window.innerHeight * ratio
}

/**
 * Attach a paused tween to its own reversible trigger.
 *
 * `onRefresh` is the guarantee against a heading stuck mid-mask: a refresh (a
 * webfont swap, a resize, a pin created above) happens at an arbitrary moment
 * in an animation's life, so an off-screen target is snapped to the state its
 * geometry asks for. An on-screen target is left alone — its trigger is live
 * and will finish the gesture itself.
 */
function attach(anim: gsap.core.Tween, trigger: Element, start: string): gsap.core.Tween {
  ScrollTrigger.create({
    trigger,
    start,
    end: MOTION.leave,
    animation: anim,
    toggleActions: 'play none none reverse',
    onRefresh: (self) => {
      if (!self.isActive) anim.progress(self.progress > 0 ? 1 : 0)
    },
  })

  return anim
}

/* --------------------------------------------------------------------------
   Headings — word by word
   ------------------------------------------------------------------------ */

/**
 * Rise a split heading's words from behind their masks when it enters, and
 * mask them again when the reader scrolls back up past it.
 *
 * `scope` is the heading element (what the trigger watches); `words` are the
 * `[data-split-unit]` spans. The caller (SplitText) owns the accessible name:
 * this function only moves boxes that are already `aria-hidden`.
 *
 * The transform is written by `fromTo`, not by `set` + `to`: a language switch
 * re-renders the same spans, and `fromTo` reverts to *no transform at all*
 * rather than to the masked start state — so a heading can never be left
 * translated off its own line by a cleanup that lands mid-animation. The
 * explicit `clearStray` is the same guarantee for the reused DOM nodes.
 */
export function revealWords(scope: HTMLElement, words: Element[]): () => void {
  if (words.length === 0) return noop

  const clearStray = () => {
    for (const word of words) {
      if (word instanceof HTMLElement) word.style.removeProperty('transform')
    }
  }

  if (prefersReducedMotion() || !startsBelowFold(scope)) {
    clearStray()
    return noop
  }

  const ctx = gsap.context(() => {
    const anim = gsap.fromTo(
      words,
      { yPercent: MOTION.travel },
      {
        yPercent: 0,
        duration: MOTION.duration,
        ease: MOTION.ease,
        stagger: MOTION.stagger,
        paused: true,
      },
    )

    attach(anim, scope, MOTION.enter)
  }, scope)

  return () => {
    ctx.revert()
    clearStray()
  }
}

/* --------------------------------------------------------------------------
   Section rig — tick + coordinate + prose
   ------------------------------------------------------------------------ */

export type SectionRig = {
  /** Revert everything this rig created. */
  dispose: () => void
}

/**
 * Wire the repeated entry signature of a section.
 *
 * Expected inside `root` (all optional, all decorative):
 * - `[data-rig-tick]`   the short rule segment drawn along the section's top rule
 * - `[data-rig-coord]`  the mono coordinate that counts up
 * - `[data-reveal-block]` paragraphs that rise as whole blocks
 */
export function initSectionRig(root: HTMLElement): SectionRig {
  const tick = root.querySelector<HTMLElement>('[data-rig-tick]')
  const coord = root.querySelector<HTMLElement>('[data-rig-coord]')
  const blocks = gsap.utils.toArray<HTMLElement>('[data-reveal-block]', root)

  /* The section's distance from the top of the sheet, in CSS pixels. Measured
     lazily: a pin created above this section changes every offset below it, and
     by the time the reader has scrolled here the layout is final. */
  const offset = () => Math.max(0, Math.round(root.getBoundingClientRect().top + window.scrollY))

  const printCoord = (value: number, width: number) => {
    if (!coord) return
    const digits = String(Math.max(0, Math.round(value))).padStart(width, '0')
    coord.textContent = `y ${digits}`
  }

  if (prefersReducedMotion()) {
    // Final state, printed once. The number is a real reading, so it is shown
    // even when nothing is allowed to move.
    const value = offset()
    printCoord(value, String(value).length)
    return { dispose: noop }
  }

  let counted = false
  let counter: gsap.core.Tween | null = null

  const count = () => {
    if (counted) return
    counted = true
    const target = offset()
    const width = String(target).length
    const state = { v: 0 }
    printCoord(0, width)
    counter = gsap.to(state, {
      v: target,
      duration: MOTION.coord,
      ease: 'power2.out',
      onUpdate: () => printCoord(state.v, width),
      onComplete: () => printCoord(target, width),
    })
  }

  const ctx = gsap.context(() => {
    if (tick && startsBelowFold(root, 0.96)) {
      attach(
        gsap.fromTo(tick, { scaleX: 0 }, {
          scaleX: 1,
          duration: MOTION.tick,
          ease: 'power2.inOut',
          paused: true,
        }),
        root,
        'top 96%',
      )
    }

    for (const block of blocks) {
      if (!startsBelowFold(block)) continue
      attach(
        gsap.fromTo(block, { y: MOTION.blockRise, opacity: 0 }, {
          y: 0,
          opacity: 1,
          duration: MOTION.duration,
          ease: MOTION.ease,
          paused: true,
        }),
        block,
        'top 90%',
      )
    }

    if (coord) {
      // Already reached at mount (a reload further down the page, or a short
      // document): count now rather than wait for a trigger that will not fire.
      if (root.getBoundingClientRect().top <= window.innerHeight * 0.85) count()
      else
        ScrollTrigger.create({
          trigger: root,
          start: MOTION.enter,
          once: true,
          onEnter: count,
        })
    }
  }, root)

  return {
    dispose: () => {
      // The counter can be created after the context has run (from a trigger),
      // so it is killed by hand as well as by the revert.
      counter?.kill()
      ctx.revert()
    },
  }
}

/* --------------------------------------------------------------------------
   Page-level housekeeping
   ------------------------------------------------------------------------ */

/**
 * One-time motion setup for the whole sheet. Returns a disposer.
 *
 * Type arrives after the first layout, and the pinned traverse in `#ranges`
 * measures its travel from the type: without this refresh, a heading that
 * reflows when Archivo lands leaves the pin a few dozen pixels short.
 */
export function initMotionSystem(): () => void {
  let disposed = false

  const refresh = () => {
    if (!disposed) ScrollTrigger.refresh()
  }

  let pending: gsap.core.Tween | null = null
  document.fonts.ready.then(() => {
    if (disposed) return
    // One tick after the swap, so the reflow has happened before we measure.
    pending = gsap.delayedCall(0.06, refresh)
  })

  const onLoad = () => refresh()
  if (document.readyState === 'complete') onLoad()
  else window.addEventListener('load', onLoad, { once: true })

  return () => {
    disposed = true
    pending?.kill()
    window.removeEventListener('load', onLoad)
  }
}
