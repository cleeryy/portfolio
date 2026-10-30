import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================================
   reveal.ts — motion system v2
   ----------------------------------------------------------------------------
   The section-level vocabulary of the sheet. Four gestures, and no fifth:

   1. A registration tick (`.rig-tick`, `[data-rig-tick]`) that draws along the
      section's top rule the first time the section comes into view. The same
      76px, the same 420ms in every section — a chapter that does not get its
      own trick.
   2. A mono coordinate (`[data-rig-coord]`) beside the `#section` reference
      that counts up to the section's real offset on the page. It is a
      measurement, not decoration: the number is `getBoundingClientRect()` of
      the section, printed after the instrument has finished counting.
   3. Block reveals (`[data-reveal-block]`) — whole paragraphs, never letters.
   4. `revealWords()`, used by `SplitText`, for every section heading.

   Rules kept everywhere in this file:

   - **Nothing is hidden by CSS.** Initial states are written by GSAP at mount,
     and only for content the reader has not reached yet. A failed script, a
     reload halfway down the page, or reduced motion all leave the sheet fully
     printed.
   - **One tempo.** Every number lives in `MOTION`, so five sections cannot
     drift apart by a few hundred milliseconds.
   - **Every trigger is owned.** Callers get a disposer and revert the context;
     nothing survives a language switch or an unmount.
   - **Reduced motion means final states**, not faster animation: no trigger is
     created, and the coordinate is printed at its real value immediately.
   ========================================================================== */

/** The whole sheet moves at these numbers. */
export const MOTION = {
  /** A heading word, and the gap between two words (18–28ms is the brief). */
  word: 0.82,
  wordStagger: 0.022,
  /** A paragraph or a lead. Whole block, one small rise. */
  block: 0.62,
  blockRise: 14,
  /** The registration tick along a section's top rule. */
  tick: 0.42,
  /** The coordinate readout. */
  coord: 0.9,
  /** A section counts as entered a little before it is fully in frame. */
  enter: 'top 85%',
} as const

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
const noop = () => {}

export function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_QUERY).matches
}

/**
 * True only for content the reader has not reached yet.
 *
 * This is what keeps the page honest: an element already inside the first
 * screen is never given an initial state, so nothing can stay invisible
 * because a trigger was created after its start line had been passed.
 */
function startsBelowFold(el: Element, ratio = 0.92): boolean {
  return el.getBoundingClientRect().top > window.innerHeight * ratio
}

/* --------------------------------------------------------------------------
   Headings — word by word
   ------------------------------------------------------------------------ */

/**
 * Rise a split heading's words from behind their masks, once, when it enters.
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
    gsap.fromTo(
      words,
      { yPercent: 108 },
      {
        yPercent: 0,
        duration: MOTION.word,
        ease: 'power3.out',
        stagger: MOTION.wordStagger,
        scrollTrigger: {
          trigger: scope,
          start: MOTION.enter,
          once: true,
        },
      },
    )
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
      gsap.set(tick, { scaleX: 0 })
      gsap.to(tick, {
        scaleX: 1,
        duration: MOTION.tick,
        ease: 'power2.inOut',
        scrollTrigger: { trigger: root, start: 'top 96%', once: true },
      })
    }

    for (const block of blocks) {
      if (!startsBelowFold(block)) continue
      gsap.set(block, { y: MOTION.blockRise, opacity: 0 })
      gsap.to(block, {
        y: 0,
        opacity: 1,
        duration: MOTION.block,
        ease: 'power2.out',
        scrollTrigger: { trigger: block, start: 'top 90%', once: true },
      })
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
