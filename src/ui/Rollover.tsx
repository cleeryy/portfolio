import { useEffect, useRef, useState } from 'react'
import type { AnchorHTMLAttributes } from 'react'
import { gsap } from 'gsap'
import { effectiveReduced, subscribeMotion } from '../lib/motion'
import './rollover.css'

/* ============================================================================
   Rollover — the character rollover, and the sheet's two link registers
   ----------------------------------------------------------------------------
   A place on this sheet is announced by its label, not by an arrow. On a fine
   pointer the label's characters roll over themselves — each letter is a column
   holding two copies of itself, the pair travels one line height, and the
   columns are staggered so the word rolls rather than slides.

   How it is driven, and why:

   - **One timeline per label, paused.** Nothing is played by a tween of its own
     duration: the timeline's `progress` is written every ticker frame from an
     *integrated hover ratio* (±2 per second), so a pointer that leaves halfway
     reverses from exactly where the roll had reached. No queue, no fight.
   - **The ratio integrator idles at zero cost.** The ticker callback exists only
     while at least one label is moving; the moment every ratio has reached its
     goal the callback removes itself from `gsap.ticker`. An idle page pays
     nothing for this.
   - **The accessible name is whole.** The rolling copies are `aria-hidden`; the
     anchor keeps a single hidden text node carrying the real label. Focus runs
     the same rollover (a keyboard reader sees the same sign of life as a mouse
     reader), and no key event is ever intercepted, so `Tab` behaves natively.
   - **Two registers.** Below 900px, on a coarse pointer, or under reduced
     motion there is no split at all: the label is plain text and the host link
     draws its own hairline underline instead (`data-roll="plain"`, styled by
     the link itself). Nothing is animated that a reader cannot also see
     settle.
   ========================================================================== */

type Motion = {
  timeline: gsap.core.Timeline
  /** Where the timeline's progress is now. */
  ratio: number
  /** Where it is heading: 1 while hovered or focused, 0 otherwise. */
  goal: number
}

/** Labels currently in motion. Empty means the ticker has been removed. */
const moving = new Set<Motion>()

/** The hover ratio moves at ±2 per second, so a roll settles in half a second. */
const RATE = 2

let driving = false

/**
 * One ticker callback for every label on the page.
 *
 * The step is clamped to 64ms: a tab that was backgrounded hands back a huge
 * delta on return, and a roll must not jump its own gap.
 */
const tick = (_time: number, deltaMs: number) => {
  const dt = Math.min(deltaMs, 64) / 1000
  const step = RATE * dt

  for (const motion of moving) {
    const { goal } = motion
    if (motion.ratio < goal) motion.ratio = Math.min(goal, motion.ratio + step)
    else if (motion.ratio > goal) motion.ratio = Math.max(goal, motion.ratio - step)
    motion.timeline.progress(motion.ratio)
    if (motion.ratio === goal) moving.delete(motion)
  }

  if (moving.size === 0 && driving) {
    gsap.ticker.remove(tick)
    driving = false
  }
}

function drive(motion: Motion) {
  moving.add(motion)
  if (driving) return
  driving = true
  gsap.ticker.add(tick)
}

/* --------------------------------------------------------------------------
   The register decision
   ------------------------------------------------------------------------ */

const FINE = '(hover: hover) and (pointer: fine)'
/* 900px is the sheet's own portrait breakpoint: below it the wide-sheet hover
   language is unavailable anyway, so there is nothing to roll. */
const WIDE = '(min-width: 901px)'

/* The third condition is the motion preference, read through the sheet's one
   predicate: the system's answer, or the override set in the index panel. */
function canRoll(): boolean {
  return window.matchMedia(FINE).matches && window.matchMedia(WIDE).matches && !effectiveReduced()
}

/**
 * Split or not — decided synchronously on first render (there is no server
 * render here, so the markup never flips after paint), and re-decided when any
 * of the three conditions changes.
 */
function useSplit(): boolean {
  const [split, setSplit] = useState<boolean>(canRoll)

  useEffect(() => {
    const queries = [FINE, WIDE].map((query) => window.matchMedia(query))
    const update = () => setSplit(canRoll())
    for (const query of queries) query.addEventListener('change', update)
    // A roll is motion the reader did not ask for: the panel's override turns
    // the labels plain exactly as the system preference does.
    const release = subscribeMotion(update)
    update()
    return () => {
      for (const query of queries) query.removeEventListener('change', update)
      release()
    }
  }, [])

  return split
}

/* --------------------------------------------------------------------------
   The label
   ------------------------------------------------------------------------ */

type RolloverLabelProps = {
  /** The complete string. It is never broken for assistive tech. */
  text: string
  className?: string
}

/**
 * The label of a link or a button, with the rollover attached to its host.
 *
 * The host is the nearest `a` or `button`: hover, focus and blur are listened
 * for there, not on the label, so a CTA that also moves magnetically keeps one
 * hit area and the focus ring stays on the element the browser focuses.
 */
export function RolloverLabel({ text, className }: RolloverLabelProps) {
  const split = useSplit()
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const chars = Array.from(text)

  useEffect(() => {
    const root = rootRef.current
    const host = root?.closest<HTMLElement>('a, button')
    if (!root || !host) return

    // The stylesheet needs to know which register is live: the underline comes
    // back exactly when the rollover cannot run.
    host.dataset.roll = split ? 'chars' : 'plain'
    const release = () => {
      delete host.dataset.roll
    }

    if (!split) return release

    const stacks = root.querySelectorAll<HTMLElement>('[data-roll-stack]')
    if (stacks.length === 0) return release

    /* Two copies per character, one line height apart, inside a clipping box
       per character. `yPercent: -100` on the pair brings the second copy
       exactly into the first one's place. */
    const timeline = gsap.timeline({ paused: true }).to(stacks, {
      yPercent: -100,
      duration: 0.5,
      ease: 'power2.inOut',
      stagger: 0.05,
    })

    const motion: Motion = { timeline, ratio: 0, goal: 0 }
    let hovered = false
    let focused = false

    const sync = () => {
      motion.goal = hovered || focused ? 1 : 0
      drive(motion)
    }

    const onEnter = () => {
      hovered = true
      sync()
    }
    const onLeave = () => {
      hovered = false
      sync()
    }
    const onFocus = () => {
      focused = true
      sync()
    }
    const onBlur = () => {
      focused = false
      sync()
    }

    host.addEventListener('pointerenter', onEnter)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('focus', onFocus)
    host.addEventListener('blur', onBlur)

    return () => {
      host.removeEventListener('pointerenter', onEnter)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('focus', onFocus)
      host.removeEventListener('blur', onBlur)
      moving.delete(motion)
      // A language switch re-renders the same spans: put them back on copy one
      // before the timeline that owned them goes away.
      timeline.progress(0)
      timeline.kill()
      release()
    }
    // `chars` is derived from `text`; both are covered by the text dependency.
  }, [split, text])

  return (
    <span className={className ? `roll ${className}` : 'roll'} ref={rootRef}>
      {split ? (
        <>
          {/* The one real label. The rolling copies below are decoration. */}
          <span className="sr-only">{text}</span>
          <span className="roll__line" aria-hidden="true">
            {chars.map((char, index) => (
              <span className="roll__ch" key={index}>
                <span className="roll__stack" data-roll-stack="">
                  <span className="roll__g">{char === ' ' ? '\u00a0' : char}</span>
                  <span className="roll__g roll__g--b">{char === ' ' ? '\u00a0' : char}</span>
                </span>
              </span>
            ))}
          </span>
        </>
      ) : (
        text
      )}
    </span>
  )
}

/* --------------------------------------------------------------------------
   The link
   ------------------------------------------------------------------------ */

/**
 * The pointer HUD's label for a destination.
 *
 * In-page targets keep their `#id` (the same reference the index panel prints),
 * an address says `mailto`, and a URL is printed as its host and path — a
 * measurement of the destination, never a sentence about it.
 */
function hudLabel(href: string): string {
  if (href.startsWith('#')) return href
  if (href.startsWith('mailto:')) return 'mailto'
  return href.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}

type RolloverLinkProps = {
  href: string
  text: string
  className?: string
  /**
   * The pointer HUD's label. Omitted, it is derived from the href; `null` opts
   * the link out of the HUD entirely.
   */
  hud?: string | null
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children' | 'className'>

/**
 * An anchor that rolls its own label. Everything a caller needs from an anchor
 * — `aria-current`, `lang`, an `onClick` that intercepts the jump — passes
 * through untouched.
 */
export default function RolloverLink({ href, text, className, hud, ...rest }: RolloverLinkProps) {
  const label = hud === undefined ? hudLabel(href) : hud

  return (
    <a
      {...rest}
      className={className ? `roll-link ${className}` : 'roll-link'}
      href={href}
      data-hud={label ?? undefined}
    >
      <RolloverLabel text={text} />
    </a>
  )
}
