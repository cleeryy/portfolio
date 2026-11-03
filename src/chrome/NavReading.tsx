import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { Link } from '../lib/router'
import { useReducedMotion } from '../lib/motion'
import { MOTION } from '../lib/reveal'

/* ============================================================================
   NavReading — the bar's live reading
   ----------------------------------------------------------------------------
   One line, printed in the mono face: the chapter under the reading line and its
   plate number on the cover (`territory · 05/08`), the document's own name and
   no number on a route (`the register`). It is a link to what it names, so the
   reading is an address a reader can use, not a decorative label.

   **Two devices, one tempo.** A change is a plate change, so it is printed the
   way the sheet prints a plate: the outgoing copy leaves upward and fades while
   the incoming arrives from below, inside a clipping box exactly 1.2 lines tall.
   The name moves as one string; the counter moves digit by digit, so `05/08` →
   `06/08` flips a single column instead of reprinting the number. Both run for
   180ms on the sheet's own curve (`MOTION.ease`).

   The rules that keep it honest:

   - **Never on a same-value render.** A scroll that stays inside one chapter, a
     language switch that leaves the reading alone, a parent re-render — none of
     them move anything. The previous value is the only trigger.
   - **The animated copy is decoration only.** The visual line is `aria-hidden`;
     a single `sr-only` mirror with `aria-live="polite"` carries the same string
     for assistive tech. A live region on a box that is being translated and
     cloned would announce the move, not the reading.
   - **Reduced motion is the final state, printed once.** No flip, no ghost, no
     transform left behind: the effect drops its inline styles and writes text.
   - **The resting DOM is text.** Both animations clean up after themselves:
     the ghost is removed on completion, the counter is rebuilt to one clean
     node per digit, and no tween survives an unmount.
   ========================================================================== */

/** One plate change: the same 180ms for the name and for every digit. */
const FLIP = 0.18

const DIGIT = /^[0-9]$/

type NavReadingProps = {
  /** The chapter or document under the reading line. */
  name: string
  /** `05/08` on the cover, `null` on a document. */
  number: string | null
  /** Where the reading leads: the register on the cover, the route on a page. */
  to: string
  /** The complete reading, for the polite live mirror. */
  live: string
}

/** One clean digit column per figure, and plain text for the separator. */
function printCount(box: HTMLElement, value: string): void {
  const fragment = document.createDocumentFragment()

  for (const char of value) {
    if (!DIGIT.test(char)) {
      fragment.append(document.createTextNode(char))
      continue
    }

    const slot = document.createElement('span')
    slot.className = 'nav__reading-digit'
    slot.dataset.value = char

    const digit = document.createElement('span')
    digit.className = 'nav__reading-in'
    digit.textContent = char

    slot.append(digit)
    fragment.append(slot)
  }

  box.replaceChildren(fragment)
}

export default function NavReading({ name, number, to, live }: NavReadingProps) {
  const reduced = useReducedMotion()
  const nameBox = useRef<HTMLSpanElement | null>(null)
  const nameLine = useRef<HTMLSpanElement | null>(null)
  const countBox = useRef<HTMLSpanElement | null>(null)
  const shownName = useRef<string | null>(null)
  const shownCount = useRef<string | null>(null)

  /* The name: one block that React owns, one ghost that carries the departing
     copy for the 180ms it takes to leave. */
  useLayoutEffect(() => {
    const box = nameBox.current
    const line = nameLine.current
    if (!box || !line) return

    const previous = shownName.current
    shownName.current = name

    if (previous === null || previous === name) return

    const ghost = document.createElement('span')
    ghost.className = 'nav__reading-out'
    ghost.setAttribute('aria-hidden', 'true')
    ghost.textContent = previous
    box.append(ghost)

    if (reduced) {
      ghost.remove()
      gsap.set(line, { clearProps: 'transform,opacity' })
      return
    }

    gsap.fromTo(
      ghost,
      { yPercent: 0, opacity: 1 },
      { yPercent: -100, opacity: 0, duration: FLIP, ease: MOTION.ease, onComplete: () => ghost.remove() },
    )
    gsap.fromTo(
      line,
      { yPercent: 100, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: FLIP, ease: MOTION.ease },
    )

    return () => {
      gsap.killTweensOf([ghost, line])
      ghost.remove()
      gsap.set(line, { clearProps: 'transform,opacity' })
    }
  }, [name, reduced])

  /* The counter: a column per digit, flipped only where the figure changed. */
  useLayoutEffect(() => {
    const box = countBox.current
    if (!box || number === null) {
      shownCount.current = null
      return
    }

    const previous = shownCount.current
    shownCount.current = number

    if (previous === null) {
      printCount(box, number)
      return
    }
    if (previous === number) return

    const slots = Array.from(box.querySelectorAll<HTMLElement>('.nav__reading-digit'))
    const figures = Array.from(number).filter((char) => DIGIT.test(char))

    // A format change (or a counter rebuilt by a language switch) is printed
    // whole; the common case is the same five glyphs and flips in place.
    if (slots.length !== figures.length) {
      printCount(box, number)
      return
    }

    let column = 0
    for (const char of number) {
      if (!DIGIT.test(char)) continue

      const slot = slots[column]
      column += 1

      const shown = slot.dataset.value ?? ''
      if (shown === char) continue
      slot.dataset.value = char

      const digit = slot.querySelector<HTMLElement>('.nav__reading-in')
      if (!digit) continue
      digit.textContent = char

      if (reduced) {
        slot.querySelectorAll('.nav__reading-out').forEach((node) => node.remove())
        gsap.set(digit, { clearProps: 'transform,opacity' })
        continue
      }

      const ghost = document.createElement('span')
      ghost.className = 'nav__reading-out'
      ghost.textContent = shown
      slot.append(ghost)

      gsap.fromTo(
        ghost,
        { yPercent: 0, opacity: 1 },
        { yPercent: -100, opacity: 0, duration: FLIP, ease: MOTION.ease, onComplete: () => ghost.remove() },
      )
      gsap.fromTo(
        digit,
        { yPercent: 100, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: FLIP, ease: MOTION.ease },
      )
    }

    return () => {
      const moving = box.querySelectorAll<HTMLElement>('.nav__reading-in, .nav__reading-out')
      moving.forEach((node) => gsap.killTweensOf(node))
      box.querySelectorAll('.nav__reading-out').forEach((node) => node.remove())
      box
        .querySelectorAll<HTMLElement>('.nav__reading-in')
        .forEach((node) => gsap.set(node, { clearProps: 'transform,opacity' }))
    }
  }, [number, reduced])

  return (
    <Link className="nav__reading" to={to} data-hud={to}>
      <span className="nav__reading-visual" aria-hidden="true">
        <span className="nav__reading-mask" ref={nameBox}>
          <span className="nav__reading-word" ref={nameLine}>
            {name}
          </span>
        </span>
        {number === null ? null : (
          <>
            <span className="nav__reading-sep">·</span>
            <span className="nav__reading-count" ref={countBox} />
          </>
        )}
      </span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {live}
      </span>
    </Link>
  )
}
