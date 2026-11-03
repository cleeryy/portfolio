import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { effectiveReduced } from './motion'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================================
   reveal.ts — motion system v4 (the sheet's type, and the pacing between plates)
   ----------------------------------------------------------------------------
   The section-level vocabulary of the sheet. Three gestures, and no fourth:

   1. **The entry.** A content section arrives as one authored move, on one
      start line: its top hairline draws from the left, the reference label
      fades up 60 ms later, and the heading's masked words start 120 ms after
      that. The rule is drawn by this file (the section's own `border-top` is
      stood down while the rig is alive) so that a hairline can be drawn at all,
      and so that a failed script leaves the border exactly where it was.
   2. **The heading.** A section title rises out of its word masks; then, once
      the last word has landed, its width axis settles from `wdth 112` to the
      width the sheet gives it (104% for a section title, from `--width-heading`).
      The axis is Archivo's second voice: the lettering is cut wide like a map
      title and *relaxes* into the text position as it prints. It is reversible
      and it never runs during the mask.
   3. **The measurement.** A mono coordinate beside `#section` counts up to the
      section's real offset. It is a measurement, not decoration: the number is
      `getBoundingClientRect()` of the section, printed after the instrument has
      finished counting. A measurement is printed once — it does not re-count.
      Whole-block prose (`[data-reveal-block]`) rises with it.

   THE TABLE — every reveal on the sheet reads these values and nothing else:

   | token      | value                       | job                                |
   | ---------- | --------------------------- | ---------------------------------- |
   | duration   | 0.9 s                       | one reveal, in both directions     |
   | ease       | cubic-bezier(.16, 1, .3, 1) | the sheet's one curve              |
   | stagger    | 0.05 s                      | between the words of a heading     |
   | travel     | 124 (yPercent)              | a masked word's own line box + its clip allowance |
   | blockRise  | 14 px                       | whole-block prose                  |
   | tick       | 0.42 s                      | the registration segment           |
   | coord      | 0.9 s                       | the coordinate readout             |
   | enter      | top 85%                     | a section counts as entered here   |
   | leave      | bottom top                  | and as left once it is behind      |

   …and the v4 groups:

   | group | token        | value                   | job                                  |
   | ----- | ------------ | ----------------------- | ------------------------------------ |
   | width | start        | 112 (wdth)              | where a heading's settle begins      |
   | width | rest         | 100 (wdth)              | the fallback resting position        |
   | width | settle       | 1.10 s                  | 112 → the heading's own rest         |
   | width | step         | 0.50 (wdth)             | quantisation: one layout per ~70 ms  |
   | width | hover        | 106 (wdth)              | a link's width while pointed at it    |
   | width | hoverTime    | 0.22 s                  | and back again                        |
   | width | breath       | 9 s                     | the handle's one breath               |
   | width | breathLift   | 2 (wdth)                | ±2 around the plate width             |
   | width | breathStep   | 0.05                    | one write every ~110 ms               |
   | width | breathMin    | 901 px                  | below this the handle is still        |
   | entry | rule         | 0.90 s                  | the section's top hairline draws      |
   | entry | ref          | 0.42 s                  | the reference label fades up          |
   | entry | refAt        | 0.06 s                  | 60 ms after the rule starts           |
   | entry | refRise      | 8 px                    | how far the reference label rises     |
   | entry | titleAt      | 0.12 s                  | the heading's mask, 120 ms after      |
   | plate | enter        | top 30%                 | where the plate's rig starts          |
   | plate | measure      | 0.35 → 0.90 of the pin  | the hairline measure draws            |
   | plate | handover     | 0.93 → 1.00 of the pin  | the clip step that lifts the plate   |

   Rules kept everywhere in this file:

   - **Nothing is hidden by CSS.** Initial states are written by GSAP at mount,
     and only for content the reader has not reached yet. A failed script, a
     reload halfway down the page, or reduced motion all leave the sheet fully
     printed.
   - **Reversal is the same tween.** Each reveal is one paused timeline driven by
     its own trigger (`play none none reverse`): entering plays it, returning up
     across the start line masks it again. Nothing is queued, so a fast scroll in
     and out scrubs one animation rather than stacking two.
   - **The width axis is paint-sized, not layout-sized.** The axis is written by
     hand from one tween's progress, quantised to `width.step`, and the settle
     only starts at a position whose line box is *measured* to be identical: the
     widest start that keeps the heading's box height is found once, at mount,
     and the gesture falls back to a narrower start (or none) rather than reflow
     a printed line. See `widthStart()`.
   - **One tempo.** Every number lives in `MOTION`, so eight sections cannot
     drift apart by a few hundred milliseconds.
   - **Every trigger is owned.** Callers get a disposer and revert the context;
     nothing survives a language switch or an unmount, and any inline transform
     or width left on a reused node is removed before it can be re-measured.
   - **Reduced motion means final states**, not faster animation: no trigger is
     created, no width is written, and the coordinate is printed at its real
     value immediately.
   ========================================================================== */

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
  /** yPercent for a word inside its `overflow` line box. 124 is not a flourish:
   *  it is one line box *plus the mask's own allowances* (the 0.06em descender
   *  padding and the 0.16em clip margin). At 100 a masked word's ascenders
   *  printed in the clip margin — a bright sliver of letter-tops inside the
   *  mask, visible at 52px and conspicuous at plate scale. Travel far enough
   *  and the word starts fully outside its own mask; the rise then looks
   *  identical, because the word is unreadable either way until it enters. */
  travel: 124,
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

  /* Archivo's width axis (wdth 75–115), as the sheet's own gesture. */
  width: {
    /** Where a heading's settle begins, before the measurement below. */
    start: 112,
    /** The fallback resting position when no computed width can be read. */
    rest: 100,
    /** 112 → the heading's own rest (`--width-heading`). */
    settle: 1.1,
    /** Paint quantum: one layout invalidation per step, ~16 steps a settle. */
    step: 0.5,
    /** A pointed-at link rises to here… */
    hover: 106,
    /** …and falls back in this long. */
    hoverTime: 0.22,
    /** The handle's breathing period. */
    breath: 9,
    /** Its amplitude, in wdth units, above the plate position (112 → 114). */
    breathLift: 2,
    /** Paint quantum for the breath: one write every ~110 ms, not one a frame. */
    breathStep: 0.05,
    /** The breathing is a wide-sheet gesture; a phone keeps the handle still. */
    breathMin: 901,
  },

  /* The one entry move every content section shares. */
  entry: {
    /** The top hairline, drawn from the left. */
    rule: 0.9,
    /** The reference label fades up… */
    ref: 0.42,
    /** …while the rule is still drawing. */
    refAt: 0.06,
    /** px it rises while it fades. */
    refRise: 8,
    /** The heading's mask starts here: mask first, width after. */
    titleAt: 0.12,
  },

  /* The chapter plate between #about and #contact. */
  plate: {
    /** Its rig starts here: a plate's heading sits deep in the plate. */
    enter: 'top 30%',
    /** Where the measure draws, as a share of the pinned travel. */
    measure: [0.35, 0.9],
    /** Where the plate is clipped away, as a share of the pinned travel: a
     *  short, decisive step at the very end, so the type is not guillotined
     *  for a screen-length of scroll. */
    handover: [0.93, 1],
  },
} as const

/** The one predicate, from `lib/motion`: the system's query or the sheet's own
    override. Every caller asks once, when its rig is created. */
export function prefersReducedMotion(): boolean {
  return effectiveReduced()
}

/**
 * True only for content the reader has not reached yet.
 *
 * This is what keeps the page honest: an element already inside the first
 * screen is never given an initial state, so nothing can stay invisible
 * because a trigger was created after its start line had been passed — and a
 * reload halfway down the sheet prints everything instead of masking it.
 */
export function startsBelowFold(el: Element, ratio = 0.92): boolean {
  return el.getBoundingClientRect().top > window.innerHeight * ratio
}

/**
 * Attach a paused timeline (or tween) to its own reversible trigger.
 *
 * `onRefresh` is the guarantee against a heading stuck mid-mask: a refresh (a
 * webfont swap, a resize, a pin created above) happens at an arbitrary moment
 * in an animation's life, so an off-screen target is snapped to the state its
 * geometry asks for. An on-screen target is left alone — its trigger is live
 * and will finish the gesture itself.
 */
function attach(
  anim: gsap.core.Tween | gsap.core.Timeline,
  trigger: Element,
  start: string,
): gsap.core.Tween | gsap.core.Timeline {
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
   The width axis
   ------------------------------------------------------------------------ */

const HEADINGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])

/**
 * The `wdth` position the stylesheet gives an element, in percent.
 *
 * Read from `font-stretch` rather than from a token: the hero handle is set at
 * the plate width (112), a section title at the heading width (104, from
 * `--width-heading`), and a link at the body width (100). The gesture has to
 * settle to whatever the sheet already asked for, not to a number of its own.
 */
export function restWidth(el: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(el).fontStretch)
  return Number.isFinite(value) && value > 0 ? value : MOTION.width.rest
}

/**
 * Write a width position.
 *
 * `font-variation-settings` is the low-level axis: it wins over `font-stretch`,
 * it is inert on a fallback font (so a fonts failure changes nothing), and it
 * is a paint-time property — no element is re-measured because of it. The
 * `font-stretch` declaration stays in the stylesheet as the resting truth.
 */
function writeWidth(el: HTMLElement, wdth: number): void {
  el.style.fontVariationSettings = `'wdth' ${wdth.toFixed(2)}`
}

/** Hand the element back to its stylesheet. */
function clearWidth(el: HTMLElement): void {
  el.style.removeProperty('font-variation-settings')
}

const quantise = (value: number, step: number) => Math.round(value / step) * step

/**
 * The widest start position this element's own line box can hold.
 *
 * A width change alters every glyph advance, so at some start position the
 * heading's last line either gains or loses a word and the block changes
 * height. That is a reflow in the middle of a settle, which is exactly the
 * defect the sheet refuses. So the start is *measured*, once, against the
 * height the element prints at rest: if `112` keeps the same box it is used;
 * otherwise the widest half-unit position that does is found by bisection, and
 * if nothing fits the settle is skipped (the heading still gets its mask).
 *
 * The probe is two writes and a handful of forced layouts at mount, on one
 * element, and it leaves the element exactly at its stylesheet position.
 */
function widthStart(el: HTMLElement, rest: number): number {
  const start = MOTION.width.start
  if (start <= rest) return rest

  let base = 0
  const holds = (value: number) => {
    writeWidth(el, value)
    return Math.abs(el.getBoundingClientRect().height - base) < 0.5
  }

  writeWidth(el, rest)
  base = el.getBoundingClientRect().height

  if (holds(start)) {
    clearWidth(el)
    return start
  }

  let low = rest
  let high: number = start
  for (let i = 0; i < 4; i += 1) {
    const mid = (low + high) / 2
    if (holds(mid)) low = mid
    else high = mid
  }

  clearWidth(el)
  return Math.max(rest, Math.floor(low * 2) / 2)
}

type WidthSettle = {
  tween: gsap.core.Tween
  /** Re-aim the start position (a webfont swap changes which start holds). */
  aim: (from: number) => void
}

/**
 * The settle itself: a tween on a progress value, painted by hand.
 *
 * GSAP cannot interpolate `font-variation-settings` (it is a list, not a
 * number), and the sheet does not want it to: the write is quantised so a
 * settle invalidates layout ~32 times instead of once a frame, and the element
 * is handed back to CSS the moment it reaches rest, so no inline width can
 * survive on a re-rendered heading.
 */
function settleWidth(el: HTMLElement, from: number, rest: number): WidthSettle {
  const state = { from, p: 0 }
  let painted = Number.NaN

  const paint = () => {
    const value = quantise(state.from + (rest - state.from) * state.p, MOTION.width.step)
    if (value === painted) return
    painted = value
    writeWidth(el, value)
  }

  writeWidth(el, state.from)

  const tween = gsap.fromTo(
    state,
    { p: 0 },
    {
      p: 1,
      duration: MOTION.width.settle,
      ease: MOTION.ease,
      onUpdate: paint,
      onComplete: () => clearWidth(el),
    },
  )

  return {
    tween,
    aim: (value: number) => {
      state.from = value
      painted = Number.NaN
      if (state.p === 0) paint()
    },
  }
}

/* --------------------------------------------------------------------------
   Headings — word by word, then width
   ------------------------------------------------------------------------ */

export type RevealOptions = {
  /** The element the reveal watches. Defaults to the heading itself. */
  trigger?: Element
  /** Where the heading counts as entered. Defaults to `MOTION.enter`. */
  start?: string
}

/**
 * Rise a split heading's words from behind their masks when it enters, mask
 * them again when the reader scrolls back up past it, and settle the width
 * axis once the last word has landed.
 *
 * `scope` is the heading element (what the trigger watches); `words` are the
 * `[data-split-unit]` spans. The caller (SplitText) owns the accessible name:
 * this function only moves boxes that are already `aria-hidden`.
 *
 * The transform is written by `fromTo`, not by `set` + `to`: a language switch
 * re-renders the same spans, and `fromTo` reverts to *no transform at all*
 * rather than to the masked start state — so a heading can never be left
 * translated off its own line by a cleanup that lands mid-animation. The
 * explicit `clearStray` is the same guarantee for the reused DOM nodes, and it
 * now also removes any width left on the heading.
 */
export function revealWords(
  scope: HTMLElement,
  words: Element[],
  options: RevealOptions = {},
): () => void {
  if (words.length === 0) return noop

  const trigger = options.trigger ?? scope
  const start = options.start ?? MOTION.enter

  const clearStray = () => {
    for (const word of words) {
      if (word instanceof HTMLElement) word.style.removeProperty('transform')
    }
    clearWidth(scope)
  }

  if (prefersReducedMotion() || !startsBelowFold(scope)) {
    clearStray()
    return noop
  }

  const settles = HEADINGS.has(scope.tagName)
  const rest = settles ? restWidth(scope) : MOTION.width.rest
  const from = settles ? widthStart(scope, rest) : rest

  /* The width arrives when the last word of the mask has landed — never while
     a word is still travelling, because the mask box is the word's own box. */
  const maskEnd = MOTION.entry.titleAt + MOTION.duration + MOTION.stagger * Math.max(0, words.length - 1)

  let alive = true

  const ctx = gsap.context(() => {
    const tl = gsap.timeline({ paused: true })

    const mask = gsap.fromTo(
      words,
      { yPercent: MOTION.travel },
      {
        yPercent: 0,
        duration: MOTION.duration,
        ease: MOTION.ease,
        stagger: MOTION.stagger,
      },
    )

    tl.add(mask, MOTION.entry.titleAt)

    if (from > rest + 0.01) {
      const width = settleWidth(scope, from, rest)
      tl.add(width.tween, maskEnd)

      /* The probe above may have run against the fallback font (Archivo swaps
         in after first layout). Re-aim the start once the real face is in, but
         only while the gesture has not begun: a settle already in flight is
         left alone, and a finished one is already at rest. */
      document.fonts?.ready.then(() => {
        if (!alive || tl.isActive() || width.tween.progress() > 0) return
        width.aim(widthStart(scope, rest))
      })
    }

    attach(tl, trigger, start)
  }, scope)

  return () => {
    alive = false
    ctx.revert()
    clearStray()
  }
}

/* --------------------------------------------------------------------------
   Section rig — the rule, the reference, the coordinate, the prose
   ------------------------------------------------------------------------ */

export type SectionRig = {
  /** Revert everything this rig created. */
  dispose: () => void
}

export type SectionRigOptions = {
  /** Where the section counts as entered. Defaults to `MOTION.enter`. */
  enter?: string
}

/**
 * Wire the repeated entry signature of a section.
 *
 * Expected inside `root` (all optional, all decorative):
 * - `[data-rig-tick]`   the short rule segment drawn along the section's top rule
 * - `[data-rig-coord]`  the mono coordinate that counts up, inside the reference
 * - `[data-reveal-block]` paragraphs that rise as whole blocks
 *
 * The top rule is the section's own `border-top`. A border cannot be drawn, so
 * the rig stands the border's colour down, injects a 1px `.rig-rule` in exactly
 * the same place, and scales that. If the script never runs, the border is
 * still there — the sheet is ruled either way — and if the reader arrives with
 * the section already in view, the rule is simply printed (no initial state).
 */
export function initSectionRig(root: HTMLElement, options: SectionRigOptions = {}): SectionRig {
  const enter = options.enter ?? MOTION.enter
  const tick = root.querySelector<HTMLElement>('[data-rig-tick]')
  const coord = root.querySelector<HTMLElement>('[data-rig-coord]')
  const ref = coord?.closest<HTMLElement>('p') ?? null
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

  const below = startsBelowFold(root)

  /* The ruled edge, drawn. Only where the section actually carries a border:
     a section that sets no rule gets none. */
  const ruled = Number.parseFloat(getComputedStyle(root).borderTopWidth) > 0
  const rule = document.createElement('span')
  rule.className = 'rig-rule'
  rule.setAttribute('aria-hidden', 'true')
  if (ruled) {
    root.prepend(rule)
    root.style.borderTopColor = 'transparent'
  }

  const erase = () => {
    rule.remove()
    if (ruled) root.style.removeProperty('border-top-color')
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
    if (below) {
      // One start line for the whole move: rule, reference, then the heading
      // (whose own 120 ms offset lives in revealWords, on the same start).
      const entry = gsap.timeline({ paused: true })

      if (ruled) {
        entry.fromTo(
          rule,
          { scaleX: 0 },
          { scaleX: 1, duration: MOTION.entry.rule, ease: MOTION.ease },
          0,
        )
      }

      if (tick) {
        entry.fromTo(
          tick,
          { scaleX: 0 },
          { scaleX: 1, duration: MOTION.tick, ease: 'power2.inOut' },
          0,
        )
      }

      if (ref) {
        entry.fromTo(
          ref,
          { opacity: 0, y: MOTION.entry.refRise },
          { opacity: 1, y: 0, duration: MOTION.entry.ref, ease: MOTION.ease },
          MOTION.entry.refAt,
        )
      }

      entry.progress(0)
      attach(entry, root, enter)
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
          start: enter,
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
      erase()
    },
  }
}

/* --------------------------------------------------------------------------
   The width axis as an interaction — links, and the handle
   ------------------------------------------------------------------------ */

/**
 * Links whose labels are set in the display face. Measured strings (mono) and
 * body copy never get the width gesture: the axis is lettering, and the sheet
 * only cuts lettering wide.
 */
const WIDTH_LINKS = '.nav__link, .nav__brand, .nav__panel-link, .ct__mail, .clp__top'

type WidthRun = {
  el: HTMLElement
  value: number
  rest: number
  painted: number
  tween: gsap.core.Tween | null
}

/**
 * A pointed-at link widens in the axis and settles back when the pointer
 * leaves. One run at a time — the pointer can only be in one place — and the
 * element is handed back to the stylesheet at rest, so no inline width is left
 * behind by a nav that re-renders on a language switch.
 *
 * The sheet's hover language is a wide-sheet one (the rollover is gated on the
 * same breakpoint): a phone has no pointer to point with.
 */
function initWidthHover(): () => void {
  if (prefersReducedMotion()) return noop

  const wide = window.matchMedia(`(min-width: ${MOTION.width.breathMin}px)`)
  let run: WidthRun | null = null

  const paint = (state: WidthRun) => {
    const value = quantise(state.value, MOTION.width.step)
    if (value === state.painted) return
    state.painted = value
    writeWidth(state.el, value)
  }

  const aim = (state: WidthRun, target: number) => {
    state.tween?.kill()
    state.tween = gsap.to(state, {
      value: target,
      duration: MOTION.width.hoverTime,
      ease: MOTION.ease,
      onUpdate: () => paint(state),
      onComplete: () => {
        state.tween = null
        // At rest the stylesheet's own position takes over again.
        if (Math.abs(state.value - state.rest) < 0.01) clearWidth(state.el)
      },
    })
  }

  const resolve = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null
    return target.closest<HTMLElement>(WIDTH_LINKS)
  }

  const take = (el: HTMLElement) => {
    if (run?.el === el) return
    if (run) aim(run, run.rest)
    const rest = restWidth(el)
    const state: WidthRun = { el, value: rest, rest, painted: Number.NaN, tween: null }
    run = state
    paint(state)
    aim(state, Math.max(rest, MOTION.width.hover))
  }

  const drop = () => {
    if (!run) return
    const state = run
    run = null
    aim(state, state.rest)
  }

  const onOver = (event: PointerEvent) => {
    if (!wide.matches) return
    const el = resolve(event.target)
    if (el) take(el)
  }

  const onOut = (event: PointerEvent) => {
    if (!run) return
    const next = event.relatedTarget
    if (next instanceof Node && run.el.contains(next)) return
    if (resolve(next) === run.el) return
    drop()
  }

  const onFocusIn = (event: FocusEvent) => {
    if (!wide.matches) return
    const el = resolve(event.target)
    if (el) take(el)
  }

  const onFocusOut = (event: FocusEvent) => {
    if (!run) return
    const next = event.relatedTarget
    if (next instanceof Node && run.el.contains(next)) return
    drop()
  }

  document.addEventListener('pointerover', onOver, true)
  document.addEventListener('pointerout', onOut, true)
  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('focusout', onFocusOut, true)

  return () => {
    document.removeEventListener('pointerover', onOver, true)
    document.removeEventListener('pointerout', onOut, true)
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('focusout', onFocusOut, true)
    if (run) {
      run.tween?.kill()
      clearWidth(run.el)
      run = null
    }
  }
}

/**
 * The handle breathes: `wdth` between the plate position and +2, on a nine
 * second cycle, so the biggest piece of type on the sheet is never quite
 * still. It is the only width on the page that moves without the reader.
 *
 * Three gates, in this order: reduced motion, a wide sheet (≥901px), and the
 * handle being on screen. Off screen it is paused, and the phase is kept, so
 * coming back to the cover does not restart the breath from the trough.
 * Painted at 0.05 quantum — one write every ~110 ms — because a 168px heading
 * repainted sixty times a second for two units of axis is not a cost the page
 * should pay.
 */
function initHandleBreath(): () => void {
  if (prefersReducedMotion()) return noop

  const handle = document.querySelector<HTMLElement>('.hero__handle')
  if (!handle) return noop

  const wide = window.matchMedia(`(min-width: ${MOTION.width.breathMin}px)`)
  const rest = restWidth(handle)

  let running = false
  let onScreen = true
  let elapsed = 0
  let then = 0
  let painted = Number.NaN

  const paint = () => {
    const phase = (elapsed / (MOTION.width.breath * 1000)) * Math.PI * 2
    const value = rest + MOTION.width.breathLift * (0.5 - 0.5 * Math.cos(phase))
    const step = quantise(value, MOTION.width.breathStep)
    if (step === painted) return
    painted = step
    writeWidth(handle, step)
  }

  const tick = (time: number) => {
    // A backgrounded tab hands back a huge delta on return; one 250ms step is
    // the most the phase may advance without a frame being drawn.
    if (then > 0) elapsed += Math.min(time - then, 0.25) * 1000
    then = time
    paint()
  }

  const start = () => {
    if (running || !onScreen || !wide.matches) return
    running = true
    then = 0
    gsap.ticker.add(tick)
  }

  const stop = () => {
    if (!running) return
    running = false
    then = 0
    gsap.ticker.remove(tick)
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      onScreen = entry.isIntersecting
      if (onScreen) start()
      else stop()
    }
  })
  observer.observe(handle)

  const onWide = () => {
    if (wide.matches) start()
    else {
      stop()
      clearWidth(handle)
    }
  }
  wide.addEventListener('change', onWide)

  start()

  return () => {
    stop()
    observer.disconnect()
    wide.removeEventListener('change', onWide)
    clearWidth(handle)
  }
}

/* --------------------------------------------------------------------------
   Page-level housekeeping
   ------------------------------------------------------------------------ */

/**
 * One-time motion setup for the whole sheet. Returns a disposer.
 *
 * Type arrives after the first layout, and a pinned traverse — `#work` from
 * phase B onward — measures its travel from the type: without this refresh, a
 * heading that reflows when Archivo lands leaves the pin a few dozen pixels
 * short.
 *
 * It also installs the two width interactions that are not tied to a section
 * (the link hover and the handle's breath), so a page that mounts no plate
 * still gets them.
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

  // Sections that pin (path, ranges) add their spacer *after* mount, which
  // moves every trigger below them. One late refresh per layout settles the
  // offsets: fonts, then the pin spacers, then whatever the images did.
  const settles = [250, 900, 1800].map((ms) => gsap.delayedCall(ms / 1000, refresh))

  const hover = initWidthHover()
  const breath = initHandleBreath()

  return () => {
    disposed = true
    hover()
    breath()
    pending?.kill()
    settles.forEach((call) => call.kill())
    window.removeEventListener('load', onLoad)
  }
}
